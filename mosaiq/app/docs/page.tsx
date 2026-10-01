import type { Metadata } from "next";
import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";
import { chains, padsOn, pairsLabel } from "@/lib/pads";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description: `How ${site.name} works: who can launch, connecting an agent, the MCP tools, supported pads and what happens after a launch.`,
  alternates: { canonical: "/docs" },
};

const toc = [
  { id: "who", label: "Who can launch" },
  { id: "agent", label: "Connect an agent" },
  { id: "mcp", label: "MCP tools" },
  { id: "pads", label: "Pads and pairs" },
  { id: "after", label: "After it launches" },
];

const mcpExample = `curl -s ${site.url}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${site.keyPrefix}…" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_launch","arguments":{"draft_id":"drf_…"}}}'`;

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="order-2 hidden pt-6 lg:order-1 lg:block">
        <DocsToc items={toc} />
      </aside>
      <article className="order-1 min-w-0 lg:order-2">
        <div className="card p-4 sm:p-6">
        <header className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#1a2215,#0a0d09)] p-7 sm:p-10">
          <div aria-hidden="true" className="absolute -right-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" />
          <p className="label relative">The guide</p>
          <h1 className="display relative mt-3 text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-none">How {site.name} works</h1>
          <p className="relative mt-4 max-w-2xl text-fog">
            One launch form for {chains.map((c) => c.name).join(", ")}. You draft; an agent with a {site.name} key submits. Start in the{" "}
            <Link href="/launch" className="text-bone underline decoration-accent/60 underline-offset-4">
              launch studio
            </Link>
            .
          </p>
        </header>

        <div className="prose-doc mt-10 space-y-14 px-2 pb-6 sm:px-4">
          <section id="who" aria-labelledby="who-h">
            <h2 id="who-h" className="display mb-4 text-2xl font-semibold">Who can launch</h2>
            <p>
              Anyone can fill the studio form and launch from their own wallet on Pump.fun, Pons, Flap, StonkFun and Argus. For everything else, only an agent holding a {site.name} key can submit a draft to a pad.
              A request to <code>submit_launch</code> without a valid key is rejected, whoever sends it.
            </p>
            <p>
              The split keeps signing in one place: the agent owns the wallet and pays the pad&apos;s fees and any opening buy.{" "}
              {site.name} never holds funds or private keys.
            </p>
          </section>

          <section id="agent" aria-labelledby="agent-h">
            <h2 id="agent-h" className="display mb-4 text-2xl font-semibold">Connect an agent</h2>
            <p>
              Press <strong className="text-bone">Connect your agent</strong> in the top bar and name it. {site.name} issues a key that starts
              with <code>{site.keyPrefix}</code> and shows it once, with a ready-made MCP client config. Only a SHA-256 hash of the key is
              stored, so a lost key means issuing a new one.
            </p>
            <p>
              After you save a draft, the studio gives you a note with the draft id. Paste it to your agent, or let it read the draft itself
              with <code>get_draft</code>.
            </p>
          </section>

          <section id="mcp" aria-labelledby="mcp-h">
            <h2 id="mcp-h" className="display mb-4 text-2xl font-semibold">MCP tools</h2>
            <p>
              The server lives at <code>/api/mcp</code> and speaks JSON-RPC 2.0 over HTTP POST (<code>initialize</code>,{" "}
              <code>tools/list</code>, <code>tools/call</code>).
            </p>
            <div className="not-prose mt-5 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-mute">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-normal">Tool</th>
                    <th scope="col" className="px-4 py-2.5 font-normal">Key</th>
                    <th scope="col" className="px-4 py-2.5 font-normal">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-fog">
                  {[
                    ["list_pads", "no", "Chains, pads and the pairs each accepts."],
                    ["draft_launch", "no", "Saves a draft and returns its id and studio link."],
                    ["get_draft", "no", "Reads a draft plus the handoff note the person saw."],
                    ["submit_launch", "yes", "Sends a draft to its pad and records it in the ledger."],
                    ["prepare_launch", "no", "Pump.fun + SOL: returns the unsigned create transaction for your wallet and a fresh mint."],
                    ["confirm_launch", "no", "Checks the signature on Solana and marks the launch live."],
                    ["list_launches", "no", "Searches the public ledger."],
                  ].map(([t, k, d]) => (
                    <tr key={t}>
                      <td className="px-4 py-3 font-mono text-[13px] text-bone">{t}</td>
                      <td className="px-4 py-3">{k}</td>
                      <td className="px-4 py-3">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre className="mt-5 overflow-x-auto rounded-2xl border border-line bg-ink-2 p-5 font-mono text-[12.5px] leading-relaxed text-fog">{mcpExample}</pre>
          </section>

          <section id="pads" aria-labelledby="pads-h">
            <h2 id="pads-h" className="display mb-4 text-2xl font-semibold">Pads and pairs</h2>
            <p>Each token lives on its own pad and chain. {site.name} only fills in the form those pads already use.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {chains.map((c) => (
                <div key={c.id} className="card p-4">
                  <p className="flex items-center gap-2 font-medium">
                    <ChainDot chain={c.id} /> {c.name}
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {padsOn(c.id).map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 text-sm">
                        <PadGlyph pad={p.id} size="sm" />
                        <span className="flex-1 text-bone">{p.name}</span>
                        <span className="font-mono text-xs text-mute">{pairsLabel(p)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="after" aria-labelledby="after-h">
            <h2 id="after-h" className="display mb-4 text-2xl font-semibold">After it launches</h2>
            <p>
              A submitted draft joins the ledger as <code>queued</code> and turns <code>live</code> once the pad&apos;s adapter confirms the
              contract. It shows up on the home page, in <Link href="/explore">Explore</Link> and in <Link href="/analytics">Analytics</Link>.
            </p>
            <p>Market cap is read from the pad. Launch counts are the tokens in the ledger; drafts are never counted.</p>
          </section>
        </div>
        </div>
      </article>
    </div>
  );
}
