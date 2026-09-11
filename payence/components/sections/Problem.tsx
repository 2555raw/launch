import { Reveal } from "../ui/Reveal";
import { Label, Status } from "../ui/Bits";

const FEED = [
  { agent: "procurement-agent", detail: "openai.com · $20.00", tone: "approved" as const, t: "12:04:21" },
  { agent: "research-agent", detail: "aws.amazon.com · $48.00", tone: "approved" as const, t: "12:04:08" },
  { agent: "ops-agent", detail: "unknown-vendor.io · $310.00", tone: "blocked" as const, t: "12:03:52" },
  { agent: "billing-agent", detail: "vercel.com · $29.00", tone: "approved" as const, t: "12:03:30" },
];

export function Problem() {
  return (
    <section id="product" className="border-t border-hair py-24 md:py-32">
      <div className="shell grid grid-cols-1 gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <Reveal>
            <Label>The gap</Label>
            <h2 className="mt-6 text-title font-extrabold">
              AI agents can act.
              <br />
              Now they can pay.
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-8 max-w-[52ch] text-[17px] leading-[1.65] text-muted">
              An agent can read a contract, pick a vendor and file the ticket. Then it reaches the
              payment screen and stops, because the only options are a shared company card or a key
              in an environment variable. Payence replaces both with a card the agent owns, bounded
              by a policy it cannot argue with.
            </p>
          </Reveal>

          <Reveal delay={0.14}>
            <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-3">
              {[
                ["Reason", "Plans the work and picks the vendor"],
                ["Execute", "Calls the API and files the task"],
                ["Pay", "Blocked, until the card is its own"],
              ].map(([k, v], i) => (
                <div key={k} className="bg-canvas p-6">
                  <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
                  <dt className={`mt-3 text-[17px] font-semibold ${i === 2 ? "text-coral" : ""}`}>
                    {k}
                  </dt>
                  <dd className="mt-2 text-[13.5px] leading-relaxed text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="lg:pt-16">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-hair px-5 py-4">
              <p className="font-mono text-[12px]">agent activity</p>
              <Status tone="live" pulse>
                Live
              </Status>
            </div>
            <ul>
              {FEED.map((row) => (
                <li
                  key={row.t}
                  className="flex items-center justify-between gap-4 border-b border-hair px-5 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px]">{row.agent}</p>
                    <p className="mt-1 truncate tnum font-mono text-[11.5px] text-muted">
                      {row.detail}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Status tone={row.tone}>{row.tone === "blocked" ? "Blocked" : "Approved"}</Status>
                    <span className="tnum font-mono text-[10.5px] text-muted">{row.t}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-hair px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
              Sample activity
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
