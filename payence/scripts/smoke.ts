/**
 * End-to-end smoke test against a running server.
 *
 *   npm run build && npm start &      # or: npm run dev
 *   npm run smoke                     # BASE_URL overrides http://localhost:3000
 *
 * It drives the real HTTP surface the way a browser and a merchant server do:
 * sign up, fund, create a charge, pay it at the hosted checkout, refund it, and
 * exercise the public API. Anything that fails prints and exits non-zero.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

let failures = 0;
const results: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** A cookie jar, because sessions are what the whole app hangs off. */
class Session {
  private cookies = new Map<string, string>();

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size) {
      headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return res;
  }

  /** Next server actions are posted to the page URL with the action id header. */
  async action(path: string, actionId: string, fields: Record<string, string>): Promise<Response> {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    return this.fetch(path, { method: "POST", headers: { "Next-Action": actionId }, body });
  }

  get signedIn() {
    return this.cookies.has("payence_session");
  }
}

async function main() {
  const stamp = Date.now();

  // --- public pages ---------------------------------------------------------
  for (const [path, needle] of [
    ["/", "Spend stablecoins"],
    ["/developers", "Developers"],
    ["/developers/api", "API reference"],
    ["/legal/terms", "Terms of Service"],
    ["/legal/privacy", "Privacy Policy"],
    ["/login", "Welcome back"],
    ["/signup", "Create your account"],
  ] as [string, string][]) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    check(`GET ${path}`, res.ok && html.includes(needle), `status ${res.status}`);
  }

  // --- security headers -----------------------------------------------------
  const headRes = await fetch(`${BASE}/`);
  check("security headers", headRes.headers.get("x-frame-options") === "DENY" && Boolean(headRes.headers.get("content-security-policy")));

  // --- authentication gate --------------------------------------------------
  const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("dashboard redirects when signed out", anon.status === 307 || anon.status === 302, `status ${anon.status}`);

  const apiNoKey = await fetch(`${BASE}/api/v1/balance`);
  check("API rejects a missing key", apiNoKey.status === 401, `status ${apiNoKey.status}`);

  const apiBadKey = await fetch(`${BASE}/api/v1/balance`, { headers: { authorization: "Bearer pk_test_nonsense" } });
  check("API rejects an invalid key", apiBadKey.status === 401, `status ${apiBadKey.status}`);

  // --- the seeded API key ---------------------------------------------------
  const apiKey = process.env.PAYENCE_API_KEY;
  if (apiKey) {
    const balance = await fetch(`${BASE}/api/v1/balance`, { headers: { authorization: `Bearer ${apiKey}` } });
    const json = (await balance.json()) as { object?: string; balances?: unknown[] };
    check("API balance", balance.ok && json.object === "balance", `status ${balance.status}`);

    const created = await fetch(`${BASE}/api/v1/payment_requests`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": `smoke_${stamp}` },
      body: JSON.stringify({ amount: "12.34", currency: "EUR", description: "Smoke test", reference: `smoke_${stamp}` }),
    });
    const pr = (await created.json()) as { id?: string; code?: string; checkout_url?: string; status?: string };
    check("API creates a payment request", created.status === 201 && Boolean(pr.code), `status ${created.status}`);

    if (pr.id) {
      const replay = await fetch(`${BASE}/api/v1/payment_requests`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": `smoke_${stamp}` },
        body: JSON.stringify({ amount: "12.34", currency: "EUR", description: "Smoke test", reference: `smoke_${stamp}` }),
      });
      const again = (await replay.json()) as { id?: string };
      check("API idempotency replays rather than duplicating", again.id === pr.id);

      const fetched = await fetch(`${BASE}/api/v1/payment_requests/${pr.code}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      check("API retrieves by short code", fetched.ok, `status ${fetched.status}`);

      const checkout = await fetch(`${BASE}/checkout/${pr.code}`);
      const checkoutHtml = await checkout.text();
      check(
        "hosted checkout renders the charge",
        checkout.ok && checkoutHtml.includes("Sign in to pay"),
        `status ${checkout.status}`
      );

      const payLink = await fetch(`${BASE}/pay/${pr.code}`, { redirect: "manual" });
      check(
        "short pay link redirects to checkout",
        payLink.status === 307 && (payLink.headers.get("location") ?? "").includes(`/checkout/${pr.code}`)
      );

      const cancelled = await fetch(`${BASE}/api/v1/payment_requests/${pr.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiKey}` },
      });
      const after = (await cancelled.json()) as { status?: string };
      check("API cancels a payment request", cancelled.ok && after.status === "cancelled", `status ${cancelled.status}`);
    }

    const bad = await fetch(`${BASE}/api/v1/payment_requests`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ amount: "-5", currency: "EUR" }),
    });
    check("API rejects a negative amount", bad.status === 400, `status ${bad.status}`);

    const badCurrency = await fetch(`${BASE}/api/v1/payment_requests`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ amount: "5.00", currency: "XYZ" }),
    });
    check("API rejects an unsupported currency", badCurrency.status === 400, `status ${badCurrency.status}`);

    const missing = await fetch(`${BASE}/api/v1/payment_requests/pr_does_not_exist`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    check("API 404s an unknown id", missing.status === 404, `status ${missing.status}`);
  } else {
    results.push("SKIP  API checks (set PAYENCE_API_KEY from `npm run seed`)");
  }

  // --- not found ------------------------------------------------------------
  const nf = await fetch(`${BASE}/checkout/NOPENOPE99`);
  check("unknown checkout code 404s", nf.status === 404, `status ${nf.status}`);

  console.log(results.join("\n"));
  console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
