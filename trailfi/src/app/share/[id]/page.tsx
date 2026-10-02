import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/PublicShell";
import { ButtonLink } from "@/components/ui/Button";
import { getShareEntry } from "@/lib/services/steps";

type Props = { params: Promise<{ id: string }> };

function fmtDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getShareEntry((await params).id);
  if (!entry) return { title: "Stepit" };
  const title = `${entry.steps.toLocaleString("en-US")} steps on Stepit`;
  const description = `Walked ${entry.steps.toLocaleString("en-US")} steps on ${fmtDay(entry.day)}. Walk, upload your steps and earn USDG on Stepit.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

/** Public page behind a shared link. Shows the steps, never the wallet, and invites the visitor to join. */
export default async function SharePage({ params }: Props) {
  const entry = await getShareEntry((await params).id);
  if (!entry) notFound();
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="label !text-lime-300">Walked on Stepit</div>
        <div className="mt-6 font-display text-[88px] font-bold leading-none tracking-tight text-lime-300 tabular sm:text-[120px]">
          {entry.steps.toLocaleString("en-US")}
        </div>
        <div className="mt-3 font-display text-2xl font-semibold">steps on {fmtDay(entry.day)}</div>
        <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-white/60">
          On Stepit you upload your daily steps with a screenshot, the team verifies them, and you get paid in USDG.
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
