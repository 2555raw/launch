import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth, optionalMerchant } from "@/lib/auth/guard";
import { OnboardingForm } from "./OnboardingForm";
import { Icon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Start accepting payments · Payence" };

const POINTS = [
  { icon: "bolt" as const, title: "Settles in seconds", body: "A payment clears while the customer is still at the counter." },
  { icon: "chart" as const, title: "0.6% per payment", body: "One rate. No monthly fee, no terminal rental, no chargeback fees." },
  { icon: "globe" as const, title: "Any country your customer is in", body: "Stablecoins do not care where the phone is." },
];

export default function OnboardingPage() {
  const { user } = requireAuth("/merchant");
  if (optionalMerchant(user.id)) redirect("/merchant/dashboard");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:px-0 md:py-16">
      <h1 className="text-[32px] font-extrabold tracking-[-0.035em] md:text-[40px]">Take stablecoin payments</h1>
      <p className="mt-3 max-w-[48ch] text-[15.5px] leading-relaxed text-muted">
        Charge in euros, get paid in stablecoins, settle into this account. In a shop with a QR code, online with a
        checkout link or the API.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {POINTS.map((p) => {
          const I = Icon[p.icon];
          return (
            <li key={p.title} className="card px-4 py-4">
              <I className="h-[18px] w-[18px] text-coral" />
              <p className="mt-3 text-[14px] font-semibold">{p.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{p.body}</p>
            </li>
          );
        })}
      </ul>

      <div className="card mt-8 px-5 py-6 md:px-7">
        <h2 className="text-[17px] font-semibold">Your business</h2>
        <div className="mt-5">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
