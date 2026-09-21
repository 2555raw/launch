import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentRequest, effectiveStatus, merchantOf, acceptedAssets, quoteForRequest } from "@/lib/services/merchants";
import { currentAuth } from "@/lib/auth/session";
import { getBalances } from "@/lib/services/ledger";
import { CheckoutPanel } from "./CheckoutPanel";
import { CheckoutFrame, PriceBlock } from "./Frame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { token } from "@/lib/ids";
import { asset } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

export const metadata: Metadata = { title: "Checkout · Payence" };

/**
 * The hosted checkout. One job: show exactly what is being charged, by whom,
 * in what asset, at what rate, and let the person confirm. Anyone can open it;
 * paying requires signing in, and the request is preserved across that.
 */
export default async function CheckoutPage({ params }: { params: { code: string } }) {
  const pr = getPaymentRequest(params.code);
  if (!pr) notFound();
  const merchant = merchantOf(pr.merchantId);
  if (!merchant) notFound();

  const status = effectiveStatus(pr);
  const auth = currentAuth();
  const assets = acceptedAssets(merchant);

  const quotes = await Promise.all(
    assets.map(async (a) => {
      const q = await quoteForRequest(pr, a);
      return { asset: a, amount: q.amount.toString(), rate: q.rate, decimals: asset(a).decimals };
    })
  );

  if (status !== "open") {
    return (
      <CheckoutFrame merchant={merchant.name} website={merchant.websiteUrl}>
        <PriceBlock currency={pr.priceCurrency} amount={pr.priceAmount} description={pr.description} />
        <div className="mt-6">
          {status === "paid" ? (
            <Alert tone="success" title="Already paid.">
              This charge has been settled. If you think you paid twice, the receipt in your activity will show it.
            </Alert>
          ) : status === "expired" ? (
            <Alert tone="warning" title="This payment request expired.">
              Payment windows close so a price cannot be paid at a stale exchange rate. Ask {merchant.name} for a new
              code.
            </Alert>
          ) : (
            <Alert tone="warning" title="This payment request is no longer active.">
              It was cancelled or refunded. Ask {merchant.name} for a new one.
            </Alert>
          )}
        </div>
        {pr.cancelUrl && (
          <div className="mt-5">
            <Button href={pr.cancelUrl} variant="secondary" size="md" full>
              Back to {merchant.name}
            </Button>
          </div>
        )}
      </CheckoutFrame>
    );
  }

  if (!auth) {
    return (
      <CheckoutFrame merchant={merchant.name} website={merchant.websiteUrl}>
        <PriceBlock currency={pr.priceCurrency} amount={pr.priceAmount} description={pr.description} />
        <ul className="mt-6 space-y-2 text-[13.5px] text-muted">
          {quotes.map((q) => (
            <li key={q.asset} className="flex justify-between border-b border-hair pb-2">
              <span>Pay in {q.asset}</span>
              <span className="tnum font-medium text-ink">
                {formatUnits(BigInt(q.amount), q.decimals, 2)} {q.asset}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-7 space-y-3">
          <Button href={`/login?next=/checkout/${pr.code}`} size="lg" full>
            Sign in to pay
          </Button>
          <Button href={`/signup?next=/checkout/${pr.code}`} variant="secondary" size="lg" full>
            Create an account
          </Button>
        </div>
        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted">
          Payence never sees your card details, because there are none. You pay from a stablecoin balance you control.
        </p>
      </CheckoutFrame>
    );
  }

  const balances = Object.fromEntries(
    getBalances({ type: "user", id: auth.user.id }).map((b) => [b.asset, b.available.toString()])
  );

  return (
    <CheckoutFrame merchant={merchant.name} website={merchant.websiteUrl}>
      <PriceBlock currency={pr.priceCurrency} amount={pr.priceAmount} description={pr.description} />
      <div className="mt-6">
        <CheckoutPanel
          code={pr.code}
          quotes={quotes}
          balances={balances}
          expiresAt={pr.expiresAt}
          merchantName={merchant.name}
          idempotencyKey={token(16)}
        />
      </div>
      <p className="mt-6 text-center text-[12.5px] text-muted">
        Signed in as {auth.user.name}.{" "}
        <Link href="/dashboard" className="underline underline-offset-4 hover:text-ink">
          Your wallet
        </Link>
      </p>
    </CheckoutFrame>
  );
}
