"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Reveal, SectionHeading } from "./Reveal";

const QUESTIONS = [
  {
    q: "Where do the rewards come from?",
    a: "Strydo pays them in ETH from its rewards wallet on Robinhood Chain. Rewards are counted in dollars and sent as ETH at the price of the day the payout is sent. Each verified day pays according to your steps, up to the daily maximum shown on the home page. Every payment is public onchain.",
  },
  {
    q: "How much will I earn?",
    a: "Every day you upload your steps and the team verifies your screenshot earns a reward, and you can request it to your wallet whenever you like. The more you walk, the more that day pays, up to the daily maximum. Rewards aren't guaranteed: days with too few steps, or screenshots that don't match, don't earn, and rates can change.",
  },
  {
    q: "Do I need to buy anything?",
    a: "No. Joining, walking and getting paid are all free. You don\'t need to buy or hold any token: your rewards arrive in your wallet as ETH on Robinhood Chain.",
  },
  {
    q: "Is there a weekly prize?",
    a: "Yes. Every week (Monday to Sunday, UTC) the walker with the most verified steps wins a bonus of $50 paid in ETH, on top of their daily pay. The weekly ranking shows who is in front.",
  },
  {
    q: "How are my steps verified?",
    a: "You upload your daily total with a screenshot from your phone's health app, and the team checks that the date and the steps match before the day counts. Duplicates, future dates and implausible numbers are rejected.",
  },
  {
    q: "Which wallet do I need?",
    a: "Phantom, MetaMask, Coinbase Wallet or Rabby. Strydo runs on Robinhood Chain, an Ethereum layer 2, and rewards are sent to your wallet there.",
  },
  {
    q: "When do I get paid?",
    a: "Once your rewards are approved, press Request payout in your dashboard. The team reviews the request and sends the money to your wallet. Every payment and its transaction hash appear in your dashboard.",
  },
  {
    q: "Is it safe to connect my wallet?",
    a: "Strydo only reads your public address and asks for one free signature to prove it is yours. It never asks for your seed phrase or private key, and never requests token approvals.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading index="05" label="FAQ" title="Questions from" accent="the trail.">
          Rewards, verification and wallets, answered plainly.
        </SectionHeading>
        <Reveal delay={0.1} className="glass rounded-3xl px-6 sm:px-8">
          {QUESTIONS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-white/10 last:border-0">
                <button
                  className="group flex w-full items-center justify-between gap-6 py-5 text-left"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">{item.q}</span>
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-lime-300 transition duration-300 group-hover:border-lime-400/50",
                      isOpen && "rotate-45 bg-lime-400/10",
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-white/60">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
