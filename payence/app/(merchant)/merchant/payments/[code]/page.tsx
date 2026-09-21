import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMerchant } from "@/lib/auth/guard";
import { getPaymentRequest, effectiveStatus } from "@/lib/services/merchants";
import { PageHeader } from "@/components/app/PageHeader";
import { QrCode } from "@/components/app/QrCode";
import { Copyable } from "@/components/ui/Copyable";
import { Badge } from "@/components/ui/Status";
import { config } from "@/lib/config";
import { payLink } from "@/lib/qr";
import { formatPrice } from "../../dashboard/page";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Charge · Payence" };

/** The counter screen: a big code, the amount, and nothing else competing with it. */
export default function ChargePage({ params }: { params: { code: string } }) {
  const { merchant } = requireMerchant();
  const pr = getPaymentRequest(params.code);
  if (!pr || pr.merchantId !== merchant.id) notFound();

  const status = effectiveStatus(pr);
  const link = payLink(config.appUrl, pr.code);
  const checkout = `${config.appUrl}/checkout/${pr.code}`;

  return (
    <div>
      <PageHeader title="Charge" back="/merchant/payments" />
      <div className="space-y-5 px-5 md:px-1">
        <section className="card flex flex-col items-center px-6 py-8">
          <p className="text-[40px] font-extrabold tracking-[-0.04em]">{formatPrice(pr.priceCurrency, pr.priceAmount)}</p>
          {pr.description && <p className="mt-1 text-[14px] text-muted">{pr.description}</p>}
          <div className="mt-4">
            <Badge tone={status === "paid" ? "positive" : status === "open" ? "warning" : "neutral"}>
              {status.replace("_", " ")}
            </Badge>
          </div>

          {status === "open" ? (
            <>
              <div className="mt-7">
                <QrCode data={link} size={240} label={`Payment QR for ${formatPrice(pr.priceCurrency, pr.priceAmount)}`} />
              </div>
              <p className="mt-5 font-mono text-[20px] tracking-[0.2em]">{pr.code}</p>
              <p className="mt-2 max-w-[34ch] text-center text-[13px] leading-relaxed text-muted">
                The customer scans this with the Payence app, or types the code on the Pay screen.
              </p>
            </>
          ) : (
            <p className="mt-6 max-w-[38ch] text-center text-[13.5px] leading-relaxed text-muted">
              {status === "paid"
                ? "This charge was paid. Create a new one for the next customer."
                : "This charge is no longer payable. Create a new one."}
            </p>
          )}

          {pr.expiresAt && status === "open" && (
            <p className="mt-4 text-[12.5px] text-muted">
              Expires at{" "}
              {new Date(pr.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Share it</h2>
          <dl className="mt-4 space-y-4 text-[13px]">
            <div>
              <dt className="text-muted">Payment link</dt>
              <dd className="mt-1 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{link}</span>
                <Copyable value={link} label="Copy" />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Hosted checkout</dt>
              <dd className="mt-1 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{checkout}</span>
                <Copyable value={checkout} label="Copy" />
              </dd>
            </div>
            {pr.reference && (
              <div>
                <dt className="text-muted">Your reference</dt>
                <dd className="mt-1 font-medium">{pr.reference}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button href={checkout} variant="secondary" size="sm">
              Open checkout
            </Button>
            <Button href="/merchant/payments" variant="ghost" size="sm">
              New charge
            </Button>
          </div>
        </section>

        {pr.paidTransactionId && (
          <p className="pb-4 text-center text-[13px]">
            <Link href="/merchant/transactions" className="text-muted underline underline-offset-4 hover:text-ink">
              See this payment in the ledger
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
