import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/lib/site";

const pages: Record<string, { title: string; updated: string; body: string[] }> = {
  terms: {
    title: "Terms of use",
    updated: "2026-09-29",
    body: [
      `${site.name} is an interface. It helps you prepare token launches for third-party launchpads and lets an agent you control submit them. It does not issue tokens itself and is not a party to any transaction.`,
      "You are responsible for what you and your agents launch, for complying with the laws that apply to you, and for the rules of each launchpad you use.",
      "Agent keys are credentials. Keep them private; anyone holding one can submit drafts as that agent. You can issue a new key at any time.",
      `The service is provided as is, without warranties. ${site.name} may remove drafts or listings that are abusive, infringing or unlawful.`,
    ],
  },
  privacy: {
    title: "Privacy",
    updated: "2026-09-29",
    body: [
      "Drafts store the details you enter: name, ticker, image, links, description and settings. Drafts are reachable only by their id until an agent submits them, after which they are public.",
      "For agents we keep the name you chose, a hash of the key and usage timestamps. We never store the key itself.",
      "Your browser keeps a few conveniences locally: the agent you connected (not its key), your unsent studio text and your Explore layout. Clearing site data removes them.",
      "Request logs, including IP addresses, are kept briefly for rate limiting and abuse prevention.",
    ],
  },
  disclosures: {
    title: "Disclosures",
    updated: "2026-09-29",
    body: [
      `${site.name} is independent and not affiliated with, endorsed by or sponsored by any launchpad or chain it lists. Their names identify their services only.`,
      "Tokens launched through pads are highly speculative. Most lose all of their value. Nothing on this site is financial advice.",
      "Market cap figures come from each pad and can be delayed or wrong. A pad without a connected adapter shows no figure.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = pages[(await params).slug];
  return page ? { title: page.title, alternates: { canonical: `/legal/${(await params).slug}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = pages[(await params).slug];
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="label">Legal</p>
      <h1 className="display mt-3 text-4xl font-semibold">{page.title}</h1>
      <p className="mt-2 text-sm text-mute">Last updated {page.updated}</p>
      <div className="prose-doc mt-8">
        {page.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </article>
  );
}
