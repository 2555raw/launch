import type { Metadata } from "next";
import { LaunchStudio } from "@/components/launch/LaunchStudio";
import { toPublic } from "@/lib/server/launches";
import { store } from "@/lib/server/store";

export const metadata: Metadata = {
  title: "Launch studio",
  description: "Draft a token for Pump.fun, Four.meme, Clanker and more in one form, then hand it to your agent to launch.",
  alternates: { canonical: "/launch" },
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LaunchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const draftId = one(sp.draft);
  const draft = draftId ? await store().getLaunch(draftId) : undefined;
  return (
    <LaunchStudio
      // Remount when a different draft is opened so the form resets to it.
      key={draft?.id ?? "new"}
      initial={{ chain: one(sp.chain), pad: one(sp.pad), pair: one(sp.pair), mode: one(sp.mode) }}
      draft={draft ? toPublic(draft) : null}
    />
  );
}
