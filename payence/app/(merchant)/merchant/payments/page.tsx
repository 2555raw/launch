import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { ChargeForm } from "./ChargeForm";
import { listPaymentRequests, effectiveStatus } from "@/lib/services/merchants";
import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Status";
import { formatPrice } from "../dashboard/page";

export const metadata: Metadata = { title: "New charge · Payence" };

const STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  paid: "positive",
  expired: "neutral",
  cancelled: "neutral",
  refunded: "neutral",
  partially_refunded: "warning",
  processing: "warning",
};

export default function MerchantPaymentsPage() {
  const { merchant } = requireMerchant();
  const recent = listPaymentRequests(merchant.id, 12);

  return (
    <div>
      <PageHeader title="New charge" subtitle="Creates a QR code and a payment link the customer can pay from any device." />
      <div className="space-y-5 px-5 md:px-1">
        <section className="card px-5 py-6">
          <ChargeForm pricingCurrency={merchant.pricingCurrency} />
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-hair px-5 py-4 text-[15px] font-semibold">Recent charges</h2>
          {recent.length ? (
            <ul className="divide-y divide-hair">
              {recent.map((pr) => {
                const status = effectiveStatus(pr);
                return (
                  <li key={pr.id}>
                    <Link href={`/merchant/payments/${pr.code}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-shell/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{pr.description || "Charge"}</span>
                        <span className="block font-mono text-[12px] text-muted">{pr.code}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold">{formatPrice(pr.priceCurrency, pr.priceAmount)}</span>
                        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-6 text-[13.5px] text-muted">No charges created yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
