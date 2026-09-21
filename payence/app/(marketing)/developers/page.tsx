import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Status";

export const metadata: Metadata = {
  title: "Developers · Payence",
  description: "Take stablecoin payments from your own website, app or point of sale.",
};

const INTEGRATIONS = [
  {
    title: "Hosted checkout",
    status: "Working",
    tone: "positive" as const,
    body: "Create a payment request from your server, send the customer to its checkout URL, and get a webhook when it is paid. Nothing to build beyond one API call and one endpoint.",
    href: "/developers/api#create",
  },
  {
    title: "Payment links",
    status: "Working",
    tone: "positive" as const,
    body: "Every payment request has a short link and a QR code. Put it on an invoice, in an email, or on a sticker at the till.",
    href: "/developers/api#create",
  },
  {
    title: "Counter QR",
    status: "Working",
    tone: "positive" as const,
    body: "Generate a code in the merchant dashboard and show it on any screen. The customer scans it in the app and confirms.",
    href: "/merchant",
  },
  {
    title: "Embedded checkout",
    status: "Not built",
    tone: "neutral" as const,
    body: "A drop-in component that renders the payment sheet inside your own page. The hosted checkout does the same job today, with a redirect instead of an iframe.",
    href: null,
  },
  {
    title: "NFC and tap to pay",
    status: "Needs a native app",
    tone: "warning" as const,
    body: "Contactless needs access to the phone's secure element, which a web app cannot have. It also needs a card issuing partner. QR covers the same counter today.",
    href: null,
  },
  {
    title: "Terminal integrations",
    status: "Needs a partner",
    tone: "warning" as const,
    body: "Running on an existing point-of-sale terminal means certifying with that vendor. The API is the integration surface when you do.",
    href: null,
  },
];

const EVENTS = [
  ["payment.completed", "A payment request was paid and the merchant balance was credited."],
  ["payment.failed", "A payment attempt did not go through. Nothing was charged."],
  ["payment.expired", "A payment request reached its expiry without being paid."],
  ["payment_request.created", "A charge was created, by the API or in the dashboard."],
  ["refund.completed", "All or part of a payment was returned to the customer."],
];

export default function DevelopersPage() {
  return (
    <div className="shell max-w-4xl py-14 md:py-20">
      <h1 className="text-display font-extrabold">Developers</h1>
      <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-muted">
        One call creates a charge. One webhook tells you it was paid. Everything else is optional.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/developers/api" size="lg">
          API reference
        </Button>
        <Button href="/merchant" variant="secondary" size="lg">
          Get an API key
        </Button>
      </div>

      <section className="mt-16">
        <h2 className="text-title font-extrabold">Start here</h2>
        <pre className="mt-6 overflow-x-auto rounded-card bg-ink px-5 py-5 font-mono text-[12.5px] leading-[1.8] text-canvas">
{`# 1. Create a charge on your server
curl https://your-payence-host/api/v1/payment_requests \\
  -H "Authorization: Bearer $PAYENCE_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order_1043" \\
  -d '{"amount":"24.90","currency":"EUR","reference":"order_1043",
       "success_url":"https://shop.example/thanks"}'

# 2. Send the customer to checkout_url from the response.

# 3. Handle the webhook when it is paid.
POST /payence/webhook
Payence-Signature: t=1758412800,v1=6f2b…
{"type":"payment.completed","data":{"payment":{…}}}`}
        </pre>
      </section>

      <section id="physical" className="mt-16">
        <h2 className="text-title font-extrabold">What exists, and what does not</h2>
        <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-muted">
          Nothing on this list is described as working unless it is. Where a capability needs hardware, a native app or
          a licensed partner, it says so.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {INTEGRATIONS.map((i) => (
            <li key={i.title} className="card px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[16px] font-bold tracking-tight">{i.title}</h3>
                <Badge tone={i.tone}>{i.status}</Badge>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">{i.body}</p>
              {i.href && (
                <Link href={i.href} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-4">
                  Read more
                  <Icon.chevron className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-title font-extrabold">Webhook events</h2>
        <dl className="mt-6 divide-y divide-hair rounded-card border border-hair bg-surface">
          {EVENTS.map(([name, body]) => (
            <div key={name} className="px-5 py-4">
              <dt className="font-mono text-[13px] font-medium">{name}</dt>
              <dd className="mt-1 text-[13.5px] text-muted">{body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 max-w-[64ch] text-[13.5px] leading-relaxed text-muted">
          Every delivery carries a <code className="font-mono text-[12.5px]">Payence-Signature</code> header of the form{" "}
          <code className="font-mono text-[12.5px]">t=&lt;unix&gt;,v1=&lt;hex&gt;</code>, where the hex is an HMAC-SHA256 of{" "}
          <code className="font-mono text-[12.5px]">&quot;&lt;t&gt;.&lt;body&gt;&quot;</code> under your endpoint secret. Verify it, and reject
          anything older than five minutes: the timestamp is signed precisely so a captured delivery cannot be replayed.
          Failed deliveries retry six times with growing backoff.
        </p>
      </section>
    </div>
  );
}
