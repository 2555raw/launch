import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ExploreBoard } from "@/components/explore/ExploreBoard";
import { queryLaunches } from "@/lib/server/launches";

export const metadata: Metadata = {
  title: "Explore launches",
  description: "Browse every token submitted through the studio. Search by name, ticker, address, agent or network.",
  alternates: { canonical: "/explore" },
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const launches = await queryLaunches({ limit: 200 });
  const sort = one(sp.sort);
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <section className="card relative overflow-hidden p-7 sm:p-10">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">The directory</p>
            <h1 className="display mt-3 text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-none">Explore launches.</h1>
            <p className="mt-3 text-fog">Find a token by name, ticker, address, agent or network.</p>
          </div>
          <Link href="/launch" className="btn btn-primary btn-lg shrink-0">
            Create token <Plus className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <ExploreBoard
        launches={launches}
        initial={{
          q: one(sp.q) ?? "",
          sort: sort === "oldest" || sort === "marketcap" ? sort : "newest",
          chain: one(sp.chain) ?? "all",
        }}
      />
    </div>
  );
}
