import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/PublicShell";
import { ButtonLink } from "@/components/ui/Button";
import { getSharePayout } from "@/lib/services/notices";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getSharePayout((await params).id);
  if (!p) return { title: "Strydo" };
  const title = `Paid $${Number(p.usdAmount).toFixed(2)} in ${p.token} for walking`;
  const description = `Got paid $${Number(p.usdAmount).toFixed(2)} in ${p.token} on Strydo for ${p.steps.toLocaleString("en-US")} verified steps. Walk, upload your steps and earn ETH.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

/** Public page behind a shared payout. Shows the amount and steps, never the wallet, and invites the visitor to join. */
export default async function PaidSharePage({ params }: Props) {
  const p = await getSharePayout((await params).id);
  if (!p) notFound();
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="label !text-lime-300">Paid on Strydo</div>
        <div className="mt-6 font-display text-[88px] font-bold leading-none tracking-tight text-lime-300 tabular sm:text-[120px]">
          +${Number(p.usdAmount).toFixed(2)}
        </div>
        <div className="mt-3 font-display text-2xl font-semibold">
          in {p.token} for {p.steps.toLocaleString("en-US")} verified steps
        </div>
        <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-white/60">
          On Strydo you upload your daily steps with a screenshot, the team verifies them, and you get paid in ETH on Robinhood Chain.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/steps" size="lg">
            Start walking
          </ButtonLink>
          <ButtonLink href="/#how-it-works" variant="secondary" size="lg">
            How it works
          </ButtonLink>
        </div>
      </div>
    </PublicShell>
  );
}
