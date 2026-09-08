import { Reveal } from "../ui/Reveal";

const TAGS = [
  "Virtual Cards",
  "Spend Limits",
  "Merchant Locks",
  "Audit Logs",
  "Webhooks",
  "MCP",
];

/** Hand-tokenised so the block needs no highlighting library on the client. */
const CODE = [
  [
    ["const ", "kw"],
    ["agent", "var"],
    [" = ", "op"],
    ["await", "kw"],
    [" payence.agents.", "plain"],
    ["create", "fn"],
    ["({", "op"],
  ],
  [
    ["  name: ", "plain"],
    ['"procurement-agent"', "str"],
  ],
  [["});", "op"]],
  [],
  [
    ["const ", "kw"],
    ["card", "var"],
    [" = ", "op"],
    ["await", "kw"],
    [" payence.cards.", "plain"],
    ["issue", "fn"],
    ["({", "op"],
  ],
  [
    ["  agent: ", "plain"],
    ["agent.id", "var"],
    [",", "op"],
  ],
  [
    ["  limit: ", "plain"],
    ["2500", "num"],
    [",", "op"],
  ],
  [
    ["  merchant: ", "plain"],
    ['"openai.com"', "str"],
  ],
  [["});", "op"]],
] as const;

const TONE: Record<string, string> = {
  kw: "text-coral",
  fn: "text-violet",
  str: "text-canvas",
  num: "text-positive",
  var: "text-canvas/90",
  op: "text-canvas/45",
  plain: "text-canvas/70",
};

export function Developers() {
  return (
    <section id="developers" data-nav-ink className="bg-ink py-24 text-canvas md:py-32">
      <div className="shell grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Reveal>
          <span className="font-mono text-label uppercase text-canvas/45">Developers</span>
          <h2 className="mt-6 text-title font-extrabold">
            Developer-First
            <br />
            Payment APIs
          </h2>
          <p className="mt-7 max-w-[44ch] text-[16.5px] leading-[1.65] text-canvas/65">
            Two calls to put a bounded card in an agent&apos;s hands. Idempotent REST, typed SDKs,
            signed webhooks, and a sandbox that returns the same errors production does.
          </p>

          <ul className="mt-10 flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <li
                key={t}
                className="rounded-pill border border-hairDark px-3.5 py-2 font-mono text-[11.5px] text-canvas/80"
              >
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-card border border-hairDark">
            <div className="flex items-center justify-between border-b border-hairDark px-5 py-3.5">
              <span className="font-mono text-[11.5px] text-canvas/55">issue-card.ts</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/40">
                Node · SDK v2
              </span>
            </div>
            <div className="overflow-x-auto">
              <pre className="p-6 font-mono text-[13px] leading-[1.85] md:p-8 md:text-[14.5px]">
                <code>
                  {CODE.map((line, i) => (
                    <span key={i} className="block whitespace-pre">
                      {line.length === 0
                        ? " "
                        : line.map(([text, tone], j) => (
                            <span key={j} className={TONE[tone]}>
                              {text}
                            </span>
                          ))}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
            <div className="grid grid-cols-2 divide-x divide-hairDark border-t border-hairDark sm:grid-cols-4">
              {[
                ["31 ms", "issue"],
                ["REST", "+ webhooks"],
                ["TS · PY · GO", "sdks"],
                ["MCP", "server"],
              ].map(([v, k]) => (
                <div key={k} className="px-4 py-4">
                  <p className="tnum font-mono text-[13px]">{v}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas/45">
                    {k}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
