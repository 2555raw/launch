import type { Metadata } from "next";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireMerchant } from "@/lib/auth/guard";
import { getDb, schema } from "@/lib/db";
import { PageHeader } from "@/components/app/PageHeader";
import { ApiKeyForm, WebhookForm } from "./Forms";
import { revokeApiKeyAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Status";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Developers · Payence" };

export default function MerchantDevelopersPage() {
  const { merchant } = requireMerchant();
  const db = getDb();
  const keys = db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.merchantId, merchant.id))
    .orderBy(desc(schema.apiKeys.createdAt))
    .all();
  const endpoints = db
    .select()
    .from(schema.webhookEndpoints)
    .where(eq(schema.webhookEndpoints.merchantId, merchant.id))
    .all();
  const deliveries = db
    .select()
    .from(schema.webhookDeliveries)
    .orderBy(desc(schema.webhookDeliveries.createdAt))
    .limit(8)
    .all()
    .filter((d) => endpoints.some((e) => e.id === d.endpointId));

  return (
    <div>
      <PageHeader
        title="Developers"
        subtitle="Take payments from your own site or point of sale."
        action={
          <Button href="/developers/api" variant="secondary" size="md">
            API reference
          </Button>
        }
      />

      <div className="space-y-5 px-5 md:px-1">
        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">API keys</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            A key is shown once, at creation. Payence stores only its hash, so a key that is lost has to be replaced
            rather than recovered. Keep keys on your server: a key in browser code is a key anyone can take.
          </p>
          <div className="mt-4">
            <ApiKeyForm />
          </div>

          {keys.length > 0 && (
            <ul className="mt-5 divide-y divide-hair border-t border-hair">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center gap-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{k.name}</p>
                    <p className="truncate font-mono text-[12px] text-muted">{k.prefix}…</p>
                    <p className="mt-0.5 text-[12px] text-faint">
                      {k.lastUsedAt
                        ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                        : "Never used"}
                    </p>
                  </div>
                  {k.revokedAt ? (
                    <Badge tone="neutral">Revoked</Badge>
                  ) : (
                    <form action={revokeApiKeyAction}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Revoke
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Webhooks</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Payence posts an event when a payment completes, fails, expires or is refunded. Every delivery is signed,
            and the signature covers a timestamp, so a captured request cannot be replayed later.
          </p>
          <div className="mt-4">
            <WebhookForm />
          </div>

          {endpoints.length > 0 && (
            <ul className="mt-5 divide-y divide-hair border-t border-hair">
              {endpoints.map((e) => (
                <li key={e.id} className="py-3.5">
                  <p className="truncate font-mono text-[12.5px]">{e.url}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    Added {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {deliveries.length > 0 && (
            <div className="mt-5 border-t border-hair pt-4">
              <h3 className="text-[13px] font-semibold">Recent deliveries</h3>
              <ul className="mt-2 space-y-2 text-[12.5px]">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4">
                    <span className="truncate font-mono">{d.event}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted">
                      {d.attempts > 0 && <span>{d.attempts} attempt{d.attempts === 1 ? "" : "s"}</span>}
                      <Badge tone={d.status === "delivered" ? "positive" : d.status === "failed" ? "danger" : "warning"}>
                        {d.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Quick start</h2>
          <p className="mt-2 text-[13.5px] text-muted">Create a charge and send the customer to its checkout URL.</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-ink px-4 py-4 font-mono text-[12px] leading-relaxed text-canvas">
{`curl ${config.appUrl}/api/v1/payment_requests \\
  -H "Authorization: Bearer pk_test_…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order_1043" \\
  -d '{
    "amount": "24.90",
    "currency": "EUR",
    "description": "Order 1043",
    "success_url": "https://example.com/thanks"
  }'`}
          </pre>
          <p className="mt-4 text-[13px] text-muted">
            The response carries <code className="font-mono text-[12px]">checkout_url</code>.{" "}
            <Link href="/developers/api" className="underline underline-offset-4 hover:text-ink">
              Full reference
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
