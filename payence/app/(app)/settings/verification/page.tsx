import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { TIER_LIMITS } from "@/lib/providers/compliance";
import { FiatAmount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Status";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { startKycAction } from "../actions";
import { Icon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Identity · Payence" };

export default function VerificationPage() {
  const { user } = requireAuth();
  const currency = user.displayCurrency;

  return (
    <div>
      <PageHeader title="Identity" back="/settings" subtitle="Verification decides how much you can move." />
      <div className="space-y-5 px-5 md:px-1">
        <section className="card px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[15px] font-semibold">Your level</h2>
            <Badge tone={user.kycStatus === "approved" ? "positive" : user.kycStatus === "pending" ? "warning" : "neutral"}>
              {TIER_LIMITS[user.kycTier].label}
            </Badge>
          </div>

          <ul className="mt-5 space-y-3">
            {Object.entries(TIER_LIMITS).map(([tier, limits]) => {
              const current = Number(tier) === user.kycTier;
              return (
                <li
                  key={tier}
                  className={`rounded-xl border px-4 py-3.5 ${current ? "border-ink bg-shell/60" : "border-hair"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-medium">{limits.label}</p>
                    {current && <Icon.check className="h-4 w-4 text-positive" />}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-[12.5px]">
                    <div>
                      <dt className="text-muted">Per payment</dt>
                      <dd className="mt-0.5 font-medium">
                        <FiatAmount cents={limits.perTransaction} currency={currency} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Daily</dt>
                      <dd className="mt-0.5 font-medium">
                        <FiatAmount cents={limits.daily} currency={currency} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Monthly</dt>
                      <dd className="mt-0.5 font-medium">
                        <FiatAmount cents={limits.monthly} currency={currency} />
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Verify your identity</h2>
          {user.kycStatus === "pending" ? (
            <Alert tone="warning" title="In review.">
              Your request is open. Identity checks are carried out by a regulated verification provider, which is not
              connected in this environment, so nothing will be approved automatically.
            </Alert>
          ) : user.kycStatus === "approved" ? (
            <Alert tone="success" title="Verified.">
              Your higher limits are active.
            </Alert>
          ) : (
            <>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                Verification needs a government ID and a selfie check, handled by a licensed provider (Sumsub, Persona
                or Onfido). Payence never stores your documents: it stores the result and the provider&apos;s reference.
              </p>
              <form action={startKycAction} className="mt-4">
                <Button type="submit" variant="secondary" size="md">
                  Start verification
                </Button>
              </form>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                No verification provider is configured in this environment, so this opens a case for manual review
                rather than approving anything.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
