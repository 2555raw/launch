"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { Label } from "../ui/Bits";

const QA = [
  {
    q: "How does Nexora control agent spending?",
    a: "Every agent gets a policy: a ceiling per month and per authorization, a list of merchants it may pay, and a threshold above which a person signs off. The policy is evaluated on our side before the charge clears, so an agent cannot talk its way past it.",
  },
  {
    q: "What are Nexora virtual cards?",
    a: "Real card credentials issued to a single agent and bounded by that agent's policy. They can be scoped to one task and expire when it closes, so a card that leaks is worth nothing outside its allowlist.",
  },
  {
    q: "How secure are agent payments?",
    a: "Credentials never enter the model's context: the agent asks for an authorization and gets a decision, not a card number. Limits are enforced at the network, and every decision is written to an append-only log.",
  },
  {
    q: "Can cards be restricted by merchant?",
    a: "Yes. A card clears at the merchants you named and is declined everywhere else, at the network rather than in your code. You can change the list without reissuing the card.",
  },
  {
    q: "Can humans approve transactions?",
    a: "Anything above your threshold goes to an approval queue instead of being declined in silence. Approvers see the agent, the task, the amount and the policy that flagged it, and the charge completes the moment someone signs.",
  },
  {
    q: "Does Nexora support MCP integration?",
    a: "Yes. Add the Nexora MCP server to your agent's config and it sees issuing, checking balance and freezing as tools, with the policy already wrapped around each one.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const still = useReducedMotion();

  return (
    <section className="border-t border-hair bg-shell py-24 md:py-32">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[0.55fr_1.45fr] lg:gap-20">
        <Reveal>
          <Label>FAQ</Label>
          <h2 className="mt-6 text-title font-extrabold">Questions, answered.</h2>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="border-t border-hairStrong">
            {QA.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className="border-b border-hair">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${i}`}
                      className="flex w-full items-center justify-between gap-8 py-6 text-left"
                    >
                      <span className="text-[17px] font-medium tracking-tight md:text-[19px]">
                        {item.q}
                      </span>
                      <span
                        className={`relative h-4 w-4 shrink-0 transition-transform duration-300 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                        aria-hidden
                      >
                        <i className="absolute left-0 top-1/2 block h-px w-4 -translate-y-1/2 bg-ink" />
                        <i className="absolute left-1/2 top-0 block h-4 w-px -translate-x-1/2 bg-ink" />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-${i}`}
                        className="overflow-hidden"
                        initial={still ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={still ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.22, 0.65, 0.3, 1] }}
                      >
                        <p className="max-w-[62ch] pb-7 pr-10 text-[15px] leading-[1.7] text-muted">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
