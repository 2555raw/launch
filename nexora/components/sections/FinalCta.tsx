"use client";

import { useState } from "react";
import { Reveal } from "../ui/Reveal";
import { Button } from "../ui/Button";

export function FinalCta() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section id="get-started" data-nav-ink className="border-t border-hair bg-ink pb-24 pt-28 text-canvas md:pb-28 md:pt-40">
      <div className="shell">
        <Reveal>
          <h2 className="max-w-[13ch] text-mega font-extrabold">
            The Financial Layer For <span className="text-coral">AI Agents.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-10 max-w-[40ch] text-[17px] leading-[1.6] text-canvas/60 md:text-[19px]">
            Build autonomous systems that can spend safely.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <form
            className="mt-12 flex max-w-xl flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="h-14 flex-1 rounded-pill border border-hairDark bg-transparent px-6 text-[15px] text-canvas placeholder:text-canvas/40 focus:border-canvas/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            />
            <Button type="submit" size="lg" variant="invert">
              Get Started
            </Button>
          </form>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-5 font-mono text-[11.5px] text-canvas/45" role="status">
            {sent
              ? "Thanks — we'll send your sandbox keys to that address."
              : "Sandbox keys in one email. No card required."}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
