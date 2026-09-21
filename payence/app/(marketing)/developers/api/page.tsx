import type { Metadata } from "next";
import { Badge } from "@/components/ui/Status";

export const metadata: Metadata = {
  title: "API reference · Payence",
  description: "Payment requests, refunds, transactions and balance over a REST API.",
};

type Endpoint = {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  title: string;
  body: string;
  params?: [string, string, string][];
  example: string;
  response: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: "create",
    method: "POST",
    path: "/api/v1/payment_requests",
    title: "Create a payment request",
    body: "Creates a charge and returns the hosted checkout URL and the short code behind its QR.",
    params: [
      ["amount", "string", "Decimal string. Two places for fiat, up to the asset's precision for a stablecoin."],
      ["currency", "string", "EUR, USD, or an asset id such as USDC."],
      ["description", "string?", "Shown to the customer on the checkout."],
      ["reference", "string?", "Your own order id. Returned on the webhook."],
      ["success_url", "string?", "Where to send the customer after paying."],
      ["cancel_url", "string?", "Where to send them if they back out."],
      ["reusable", "boolean?", "A code that can be paid many times, for a tip jar or a stall."],
      ["expires_in_minutes", "number?", "Default 30. Maximum 14 days."],
      ["metadata", "object?", "Anything you want back on the webhook."],
    ],
    example: `curl https://your-host/api/v1/payment_requests \\
  -H "Authorization: Bearer pk_test_…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order_1043" \\
  -d '{"amount":"24.90","currency":"EUR","description":"Order 1043"}'`,
    response: `{
  "id": "pr_9f3c…",
  "object": "payment_request",
  "code": "K4M9TRQ2XB",
  "status": "open",
  "price": { "currency": "EUR", "amount": "2490" },
  "accepted_assets": ["USDC", "USDT", "EURC"],
  "checkout_url": "https://your-host/checkout/K4M9TRQ2XB",
  "expires_at": 1758414600000
}`,
  },
  {
    id: "retrieve",
    method: "GET",
    path: "/api/v1/payment_requests/:id",
    title: "Retrieve a payment request",
    body: "Accepts the id or the short code. Expiry is evaluated on read, so the status is always current.",
    example: `curl https://your-host/api/v1/payment_requests/K4M9TRQ2XB \\
  -H "Authorization: Bearer pk_test_…"`,
    response: `{ "id": "pr_9f3c…", "status": "paid", "paid_transaction_id": "txn_be21…" }`,
  },
  {
    id: "list",
    method: "GET",
    path: "/api/v1/payment_requests",
    title: "List payment requests",
    body: "Newest first. Takes `limit` (up to 100) and `status`.",
    example: `curl "https://your-host/api/v1/payment_requests?status=open&limit=10" \\
  -H "Authorization: Bearer pk_test_…"`,
    response: `{ "object": "list", "data": [ … ], "has_more": false }`,
  },
  {
    id: "cancel",
    method: "DELETE",
    path: "/api/v1/payment_requests/:id",
    title: "Cancel a payment request",
    body: "Stops an unpaid request being payable. A paid one returns 409; refund it instead.",
    example: `curl -X DELETE https://your-host/api/v1/payment_requests/pr_9f3c… \\
  -H "Authorization: Bearer pk_test_…"`,
    response: `{ "id": "pr_9f3c…", "status": "cancelled" }`,
  },
  {
    id: "refund",
    method: "POST",
    path: "/api/v1/refunds",
    title: "Refund a payment",
    body: "Returns all or part of a settled payment to the account that paid. Send an Idempotency-Key: without one, a retry refunds twice.",
    params: [
      ["transaction_id", "string", "The payment to refund."],
      ["amount", "string?", "Partial amount in the payment's asset. Omit to refund it all."],
      ["reason", "string?", "Kept on the record; not shown to the customer."],
    ],
    example: `curl https://your-host/api/v1/refunds \\
  -H "Authorization: Bearer pk_test_…" \\
  -H "Idempotency-Key: refund_1043" \\
  -d '{"transaction_id":"txn_be21…","amount":"10.00"}'`,
    response: `{ "id": "txn_c7a4…", "type": "refund", "status": "completed", "amount": "10000000" }`,
  },
  {
    id: "transaction",
    method: "GET",
    path: "/api/v1/transactions/:id",
    title: "Retrieve a transaction",
    body: "A payment or refund on your merchant account, with its fee, fiat value and network details.",
    example: `curl https://your-host/api/v1/transactions/txn_be21… \\
  -H "Authorization: Bearer pk_test_…"`,
    response: `{ "id": "txn_be21…", "type": "payment", "asset": "USDC", "amount": "27065217", "fee": "162392" }`,
  },
  {
    id: "balance",
    method: "GET",
    path: "/api/v1/balance",
    title: "Retrieve your balance",
    body: "Settled and pending balances per asset, plus your settlement and accepted assets.",
    example: `curl https://your-host/api/v1/balance -H "Authorization: Bearer pk_test_…"`,
    response: `{ "object": "balance", "balances": [ { "asset": "USDC", "available": "27065217", "pending": "0" } ] }`,
  },
];

const ERRORS: [string, string, string][] = [
  ["401", "missing_api_key / invalid_api_key", "No bearer token, or a key that was revoked."],
  ["400", "invalid_parameter / invalid_amount", "The body did not validate. The message names the field."],
  ["402", "insufficient_funds", "A refund exceeds the merchant balance."],
  ["404", "not_found", "No such object on this account. Never leaks whether it exists elsewhere."],
  ["409", "already_paid", "The request was already settled."],
  ["413", "payload_too_large", "Bodies are capped at 64 KB."],
  ["429", "rate_limited", "120 requests a minute per key. Back off and retry."],
];

const METHOD_TONE = { GET: "positive", POST: "live", DELETE: "danger" } as const;

export default function ApiReferencePage() {
  return (
    <div className="shell max-w-4xl py-14 md:py-20">
      <h1 className="text-display font-extrabold">API reference</h1>
      <p className="mt-6 max-w-[58ch] text-[16.5px] leading-relaxed text-muted">
        REST over HTTPS, JSON in and out. Authenticate with a bearer key from the merchant dashboard. Amounts are
        strings: fiat in the currency&apos;s minor units on the way out, decimal on the way in, and stablecoins in the
        asset&apos;s base units. Nothing is a float, because a float loses cents.
      </p>

      <section className="mt-12 rounded-card border border-hair bg-surface px-5 py-5">
        <h2 className="text-[15px] font-semibold">Authentication and idempotency</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          Send <code className="font-mono text-[12.5px]">Authorization: Bearer pk_test_…</code> on every request. Keep
          the key on your server. Send{" "}
          <code className="font-mono text-[12.5px]">Idempotency-Key</code> on anything that moves money: a repeat with
          the same key returns the original result instead of charging or refunding twice.
        </p>
      </section>

      <div className="mt-14 space-y-14">
        {ENDPOINTS.map((e) => (
          <section key={e.id} id={e.id} className="scroll-mt-24">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={METHOD_TONE[e.method]} dot={false}>
                {e.method}
              </Badge>
              <code className="font-mono text-[14px] font-medium">{e.path}</code>
            </div>
            <h2 className="mt-4 text-[22px] font-bold tracking-tight">{e.title}</h2>
            <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">{e.body}</p>

            {e.params && (
              <dl className="mt-5 divide-y divide-hair rounded-card border border-hair bg-surface">
                {e.params.map(([name, type, desc]) => (
                  <div key={name} className="px-5 py-3">
                    <dt className="flex flex-wrap items-baseline gap-2">
                      <code className="font-mono text-[13px] font-medium">{name}</code>
                      <span className="font-mono text-[11.5px] text-faint">{type}</span>
                    </dt>
                    <dd className="mt-1 text-[13.5px] text-muted">{desc}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {/* min-w-0: a grid item defaults to min-width:auto, so a wide <pre>
                  stretches the track instead of scrolling inside it. */}
              <div className="min-w-0">
                <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">Request</p>
                <pre className="overflow-x-auto rounded-card bg-ink px-4 py-4 font-mono text-[12px] leading-[1.8] text-canvas">
                  {e.example}
                </pre>
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">Response</p>
                <pre className="overflow-x-auto rounded-card border border-hair bg-surface px-4 py-4 font-mono text-[12px] leading-[1.8]">
                  {e.response}
                </pre>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-title font-extrabold">Errors</h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
          Errors come back as{" "}
          <code className="font-mono text-[12.5px]">{`{ "error": { "type", "code", "message" } }`}</code> with a matching
          HTTP status. The message is written to be shown to a developer, never to a customer.
        </p>
        <div className="mt-6 overflow-x-auto rounded-card border border-hair bg-surface">
        <table className="w-full min-w-[320px] text-left">
          <thead>
            <tr className="border-b border-hair text-[12px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3 font-medium">Code</th>
              <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {ERRORS.map(([status, code, when]) => (
              <tr key={code}>
                <td className="tnum px-5 py-3 text-[13.5px] font-medium">{status}</td>
                <td className="break-all px-5 py-3 font-mono text-[12.5px]">
                  {code}
                  <span className="mt-1 block font-sans text-[12.5px] text-muted sm:hidden">{when}</span>
                </td>
                <td className="hidden px-5 py-3 text-[13.5px] text-muted sm:table-cell">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
