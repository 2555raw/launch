import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/guard";
import { acceptedAssets } from "@/lib/services/merchants";
import { PageHeader } from "@/components/app/PageHeader";
import { MerchantSettingsForm } from "./SettingsForm";
import { FEE_COPY } from "@/lib/services/fees";
import { Badge } from "@/components/ui/Status";

export const metadata: Metadata = { title: "Merchant settings · Payence" };

export default function MerchantSettingsPage() {
  const { merchant } = requireMerchant();

  return (
    <div>
      <PageHeader title="Merchant settings" />
      <div className="space-y-5 px-5 md:px-1">
        <section className="card px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[15px] font-semibold">Business</h2>
            <Badge tone={merchant.status === "verified" ? "positive" : "warning"}>
              {merchant.status === "verified" ? "Verified" : "Pending verification"}
            </Badge>
          </div>
          <div className="mt-5">
            <MerchantSettingsForm
              name={merchant.name}
              websiteUrl={merchant.websiteUrl ?? ""}
              settlementAsset={merchant.settlementAsset}
              pricingCurrency={merchant.pricingCurrency}
              accepted={acceptedAssets(merchant)}
            />
          </div>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Fees</h2>
          <dl className="mt-4 divide-y divide-hair text-[13.5px]">
            {[
              ["Payments received", FEE_COPY.merchant],
              ["Refunds", "Free. The original fee is not returned."],
              ["Converting settlement", FEE_COPY.conversion],
              ["Withdrawing on-chain", FEE_COPY.withdrawal],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Settlement to a bank account</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Paying out to a bank account means converting stablecoins to fiat, which is a regulated activity carried
            out by a licensed off-ramp partner. Payence holds your balance in stablecoins and can withdraw it on-chain.
            Fiat settlement is an integration point, not a feature of this build.
          </p>
        </section>
      </div>
    </div>
  );
}
