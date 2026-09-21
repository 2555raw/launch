/**
 * The end-to-end journey, driven through a real browser.
 *
 *   npm run build && npm start &
 *   npx tsx --conditions=react-server scripts/journey.ts
 *
 * It signs a new person up, funds them, pays a merchant charge at the hosted
 * checkout, and checks the receipt and the merchant's books. This is the test
 * that proves the buttons do what they say.
 */
import { chromium, type Page } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EXECUTABLE = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const log: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  log.push(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function textOf(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  // A phone viewport: this is where most payments happen.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

  const stamp = Date.now();
  const email = `journey${stamp}@example.com`;
  const password = "a-decent-passphrase-2026";

  // --- sign up --------------------------------------------------------------
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.fill("#name", "Journey Tester");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  // Sign-ups are rate limited per address. If the redirect does not arrive,
  // report what the form actually said instead of a bare timeout.
  try {
    await page.waitForURL("**/dashboard", { timeout: 25_000 });
  } catch {
    const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    throw new Error(`Sign-up did not complete: ${shown.slice(0, 200)}`);
  }
  check("sign-up lands on the dashboard", page.url().includes("/dashboard"));
  check("dashboard greets the new user", (await textOf(page)).includes("Hello, Journey"));
  check("balance starts at zero", (await textOf(page)).includes("€0.00"));

  // --- empty states ---------------------------------------------------------
  await page.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" });
  check("activity shows an empty state", (await textOf(page)).includes("No transactions yet"));

  // --- fund the account (simulated chain) -----------------------------------
  await page.goto(`${BASE}/wallet/deposit`, { waitUntil: "domcontentloaded" });
  const depositText = await textOf(page);
  check("deposit page warns about the network", depositText.includes("Send only these assets on this network"));
  check("deposit page shows an address", /0x[a-f0-9]{8}/i.test(depositText));
  await page.fill("#sim-amount", "400");
  await page.click('form:has(#sim-amount) button[type="submit"]');
  await page.waitForFunction(() => !document.body.innerText.includes("Crediting"), undefined, { timeout: 20_000 });
  await page.goto(`${BASE}/wallet`, { waitUntil: "domcontentloaded" });
  check("deposit credited the balance", (await textOf(page)).includes("368.00"), await textOf(page));

  // --- insufficient balance is refused --------------------------------------
  await page.goto(`${BASE}/send`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="amount"]', "999999");
  await page.fill("#recipient", "alex");
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]', { timeout: 20_000 });
  const sendError = await textOf(page);
  check(
    "sending more than the balance is refused",
    sendError.includes("Not enough") || sendError.includes("daily limit") || sendError.includes("capped"),
    sendError.slice(0, 200)
  );

  // --- pay a merchant charge -------------------------------------------------
  // The charge is created through the public API so the test is repeatable:
  // a seeded one is consumed by the first run and "already paid" after it.
  const apiKey = process.env.PAYENCE_API_KEY;
  let code = process.env.CHECKOUT_CODE;
  let merchantName = "Roasted Coffee Bar";
  if (apiKey) {
    const res = await fetch(`${BASE}/api/v1/payment_requests`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ amount: "4.20", currency: "EUR", description: "Journey flat white" }),
    });
    const created = (await res.json()) as { code?: string; merchant?: { name?: string } };
    if (created.code) {
      code = created.code;
      merchantName = created.merchant?.name ?? merchantName;
    }
    check("API created a charge for the journey", Boolean(created.code), `status ${res.status}`);
  }

  if (code) {
    await page.goto(`${BASE}/checkout/${code}`, { waitUntil: "domcontentloaded" });
    const checkoutText = await textOf(page);
    check("checkout shows the merchant and the amount", checkoutText.includes(merchantName) && checkoutText.includes("€"));
    check("checkout shows the rate and the expiry", checkoutText.includes("Rate") && checkoutText.includes("Expires in"));
    await page.click('button[type="submit"]');
    await page.waitForURL("**/done**", { timeout: 20_000 });
    const doneText = await textOf(page);
    check("payment completes and shows a receipt", doneText.includes("Payment complete"));
    check("receipt carries a transaction id", /txn_[a-f0-9]{8}/.test(doneText));

    await page.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" });
    const activity = await textOf(page);
    check("the payment appears in activity", activity.includes(merchantName));

    // Paying the same charge twice must be refused, not silently repeated.
    await page.goto(`${BASE}/checkout/${code}`, { waitUntil: "domcontentloaded" });
    check("a paid charge cannot be paid again", (await textOf(page)).includes("Already paid"));
  } else {
    log.push("SKIP  checkout journey (set PAYENCE_API_KEY from `npm run seed`)");
  }

  // --- security settings -----------------------------------------------------
  await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded" });
  const security = await textOf(page);
  check("security page lists this device", security.includes("This device"));
  check("two-factor can be set up", security.includes("Set up two-factor"));

  // --- mobile layout ---------------------------------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no horizontal overflow on a 390px phone", overflow <= 1, `overflow ${overflow}px`);
  // Two navigations exist in the markup, the sidebar and the bottom bar; CSS
  // shows exactly one per breakpoint, so the visible one is what to measure.
  const navVisible = await page.locator('nav[aria-label="Main"]:visible').count();
  check("exactly one navigation is on screen", navVisible === 1, `visible navs: ${navVisible}`);
  const tapTargets = await page.evaluate(() => {
    const navs = [...document.querySelectorAll('nav[aria-label="Main"]')];
    const nav = navs.find((n) => n.getBoundingClientRect().height > 0);
    if (!nav) return [];
    return [...nav.querySelectorAll("a")].map((a) => Math.round(a.getBoundingClientRect().height));
  });
  check("navigation targets are at least 44px", tapTargets.every((h) => h >= 44), JSON.stringify(tapTargets));

  // --- sign out ---------------------------------------------------------------
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.click('form button:has-text("Sign out")');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  check("signing out closes the session", page.url().includes("/login"));

  check("no uncaught client errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log(log.join("\n"));
  console.log(`\n${log.filter((l) => l.startsWith("PASS")).length} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
