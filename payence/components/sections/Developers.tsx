import { Reveal } from "../ui/Reveal";
import { Label } from "../ui/Bits";

/** The surface those two calls sit on, named the way the docs name it. */
const ENDPOINTS: [string, string, string][] = [
  ["POST", "/v1/cards", "Issue a virtual card"],
  ["POST", "/v1/policies", "Set ceilings and thresholds"],
  ["PATCH", "/v1/policies/:id", "Lock the card to merchants"],
  ["GET", "/v1/ledger", "Read the audit trail"],
  ["POST", "/v1/webhooks", "Subscribe to decisions"],
  ["MCP", "npx @payence/mcp", "Hand the tools to the agent"],
];

const METHOD_TONE: Record<string, string> = {
  POST: "text-coral",
  PATCH: "text-violet",
  GET: "text-positive",
  MCP: "text-canvas/70",
};

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
          <Label className="!text-canvas/50">Developers</Label>
          <h2 className="mt-6 text-title font-extrabold">
            Developer-First
            <br />
            Payment APIs
          </h2>
          <p className="mt-7 max-w-[44ch] text-[16.5px] leading-[1.65] text-canvas/65">
            Two calls to put a bounded card in an agent&apos;s hands. Idempotent REST, typed SDKs,
            signed webhooks, and a sandbox that returns the same errors production does.
          </p>

          <dl className="mt-10 border-t border-hairDark">
            {ENDPOINTS.map(([method, path, what]) => (
              <div
                key={path}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairDark py-3"
              >
                <dt className="flex min-w-0 items-baseline gap-3 font-mono text-[12.5px]">
                  <span className={`w-12 shrink-0 text-[10.5px] ${METHOD_TONE[method]}`}>
                    {method}
                  </span>
                  <span className="truncate text-canvas/85">{path}</span>
                </dt>
                <dd className="ml-auto text-[12.5px] text-canvas/50">{what}</dd>
              </div>
            ))}
          </dl>
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
