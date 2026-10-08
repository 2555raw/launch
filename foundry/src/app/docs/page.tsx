import Link from "next/link";
import { TopBar } from "@/components/game/TopBar";
import { getCurrentProject } from "@/server/project";
import { describeFormula } from "@/lib/economy";
import { GENERATORS } from "@/lib/content/generators";
import { UPGRADES } from "@/lib/content/upgrades";
import { ACHIEVEMENTS } from "@/lib/content/achievements";
import { fmt, fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Docs — FOUNDRY" };

export default async function DocsPage() {
  const p = await getCurrentProject();
  return (
    <div>
      <TopBar user={null} symbol={p.symbol} slug={p.slug} />
      <article className="prose-foundry mx-auto max-w-3xl space-y-8 px-4 py-8 text-slate-300">
        <header>
          <div className="label text-ember">Documentation</div>
          <h1 className="mt-1 font-display text-4xl font-bold text-slate-50">How FOUNDRY works</h1>
          <p className="mt-3 text-lg text-slate-400">A community clicker that decides how much of a commodity token&apos;s supply is burned before it launches on Solana.</p>
        </header>

        <Section title="The loop">
          <pre className="panel p-3 font-mono text-xs text-brand-soft">CLICK → EARN → BUY CURSORS → AUTOMATE → UPGRADE → RAISE BURN POWER → TOKEN LAUNCH</pre>
          <p>Click the deposit to produce units. Spend them on cursors and buildings that produce automatically. Buy upgrades to multiply production and burn efficiency. Everything you produce becomes burn power, and the community&apos;s total burn power decides how many tokens are removed from the launch supply.</p>
        </Section>

        <Section title={`Current launch: $${p.symbol}`}>
          <ul className="list-disc space-y-1 pl-5">
            <li>Initial supply: <b>{fmtFull(p.initialSupply)}</b></li>
            <li>Maximum burn: <b>{p.maxBurnPercent}%</b> ({fmtFull((p.initialSupply * p.maxBurnPercent) / 100)} tokens)</li>
            <li>Burn formula: <code className="text-brand-soft">{describeFormula(p)}</code></li>
            <li>Community allocation: <b>{p.communityAllocationPercent}%</b> of the final supply, split pro rata to burn power</li>
            <li>Launch window: <b>{p.launchDurationHours} hours</b> once started · status <b>{p.status}</b></li>
            <li>Chain: Solana ({process.env.SOLANA_CLUSTER ?? "devnet"}), Token-2022 with on-chain metadata</li>
          </ul>
        </Section>

        <Section title="Burn power">
          <p>Each building has a burn weight. Your burn power per second is the sum of every building&apos;s production × its burn weight × your burn efficiency (from Burn Protocol upgrades). Each accepted click adds click power × burn efficiency.</p>
          <p>The final supply is <code>initialSupply − burned</code>, and <code>burned</code> is always clamped between 0 and the maximum burn, so the supply can never go negative.</p>
        </Section>

        <Section title="Launch lifecycle">
          <ol className="list-decimal space-y-1 pl-5">
            <li><b>Countdown</b>: the admin starts the launch window. Every action counts.</li>
            <li><b>Freeze</b>: when the countdown ends, every player&apos;s production is settled up to that instant and the game stops accepting actions.</li>
            <li><b>Finalize</b>: the final burn power, burned supply and final supply are locked.</li>
            <li><b>Mint</b>: the token is created on Solana, the initial supply is minted, the burned amount is destroyed on-chain and the mint authority is revoked.</li>
            <li><b>Publish</b>: the project page shows live on-chain data and opens claims.</li>
          </ol>
        </Section>

        <Section title="Claims">
          <p>Link a wallet (Phantom, Solflare or any Wallet Standard wallet) from Options. Linking means signing a message with a one-time nonce; it sends no transaction and reveals no key. After launch, the project page shows your share and a Claim button; the treasury transfers your allocation on-chain. One claim per player per launch.</p>
        </Section>

        <Section title="Fair play">
          <p>The server never trusts the browser. It credits production from its own clock, accepts at most {p.maxClicksPerSecond} clicks per second (extra clicks are dropped and flagged), re-prices every purchase, checks every unlock and upgrade requirement, rate-limits requests, and rejects anything after the freeze instant. Offline production is capped at {p.offlineCapHours} hours.</p>
        </Section>

        <Section title="Buildings">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-slate-500"><th className="py-1">Name</th><th>Base cost</th><th>Base output</th><th>Burn weight</th></tr></thead>
            <tbody>
              {GENERATORS.map((g) => (
                <tr key={g.id} className="border-t border-white/[0.05]"><td className="py-1">{g.name}</td><td className="num">{fmt(g.baseCost)}</td><td className="num">{fmt(g.baseProduction)}/s</td><td className="num">{g.burnWeight}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">Each additional unit costs 15% more. Leveling a building adds +50% output per level.</p>
        </Section>

        <Section title="Upgrades">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {UPGRADES.map((u) => <li key={u.id} className="rounded border border-white/[0.05] px-2 py-1"><b>{u.name}</b> · {u.description} · <span className="num text-slate-500">{fmt(u.cost)}</span></li>)}
          </ul>
        </Section>

        <Section title="Achievements">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => <li key={a.id} className="rounded border border-white/[0.05] px-2 py-1"><b>{a.name}</b> · {a.description}</li>)}
          </ul>
        </Section>

        <p className="text-sm text-slate-500">Questions about data? See the <Link href="/privacy" className="underline">privacy page</Link>.</p>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-bold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}
