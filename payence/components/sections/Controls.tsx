import { Reveal } from "../ui/Reveal";
import { Label } from "../ui/Bits";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CONTROLS = [
  {
    n: "01",
    title: "Merchant Restrictions",
    body: "Cards clear at the merchants you named and nowhere else.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M4 9h16M6 9V6h12v3M5 9v10h14V9" {...stroke} />
        <path d="M10 19v-5h4v5" {...stroke} />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Spending Caps",
    body: "A ceiling per agent, per card and per authorization.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M4 18a8 8 0 1 1 16 0" {...stroke} />
        <path d="M12 18l4.5-5" {...stroke} />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Human Approval Thresholds",
    body: "Above the line you set, a person signs before the money moves.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="8" r="3.2" {...stroke} />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" {...stroke} />
      </svg>
    ),
  },
  {
    n: "04",
    title: "Self-Destructing Cards",
    body: "One task, one card, expired the moment the task closes.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M5 7h14l-1 13H6z" {...stroke} />
        <path d="M9 7V4h6v3M10 11v6M14 11v6" {...stroke} />
      </svg>
    ),
  },
  {
    n: "05",
    title: "Fleet Kill Switch",
    body: "One call freezes every card the fleet holds.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="8" {...stroke} />
        <path d="M12 5v7" {...stroke} />
      </svg>
    ),
  },
  {
    n: "06",
    title: "Audit Logs",
    body: "Agent, task, policy and approver, chained to every charge.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M6 3h8l4 4v14H6z" {...stroke} />
        <path d="M9 12h6M9 16h4" {...stroke} />
      </svg>
    ),
  },
];

export function Controls() {
  return (
    <section className="border-t border-hair py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <Label>Core controls</Label>
          <h2 className="mt-6 max-w-[20ch] text-title font-extrabold">
            Six limits, enforced before the charge clears.
          </h2>
        </Reveal>

        <ul className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c, i) => (
            <Reveal as="li" key={c.n} delay={(i % 3) * 0.06} className="bg-canvas">
              <div className="group h-full p-7 transition-colors duration-300 hover:bg-shell md:p-9">
                <div className="flex items-center justify-between">
                  <span className="text-coral">{c.icon}</span>
                  <span className="tnum font-mono text-[11px] text-muted">{c.n}</span>
                </div>
                <h3 className="mt-8 text-[18px] font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2.5 max-w-[34ch] text-[14px] leading-relaxed text-muted">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
