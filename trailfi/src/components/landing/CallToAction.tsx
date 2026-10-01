import { Coins, ShieldCheck, Upload } from "lucide-react";
import Image from "next/image";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { ButtonLink } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Reveal } from "./Reveal";

export function CallToAction() {
  return (
    <section className="container pb-28">
      <Reveal>
        <div className="grain relative isolate overflow-hidden rounded-[36px] border border-white/10">
          <Image
            src="/images/trail-valley.webp"
            alt="Hiker with a yellow backpack walking through an alpine valley"
            fill
            sizes="(min-width: 1280px) 1240px, 100vw"
            className="-z-20 object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/95 via-ink-950/75 to-ink-950/25" />
          <div className="px-7 py-16 sm:px-14 sm:py-24">
            <div className="label !text-lime-300">Walk. Explore. Earn.</div>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] sm:text-6xl">
              The trail is open. Your next step counts.
            </h2>
            <p className="mt-5 max-w-lg text-[17px] text-white/70">
              Connect your wallet, reach your daily goal, and get rewarded for staying active in the real world.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ConnectWallet size="lg" />
              <ButtonLink href="/dashboard" variant="secondary" size="lg">
                Open dashboard
              </ButtonLink>
            </div>
            <ol className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { icon: Upload, title: "Upload your steps", sub: "A screenshot from your health app" },
                { icon: ShieldCheck, title: "Get verified", sub: "The team checks every upload" },
                { icon: Coins, title: "Get paid", sub: "In USDG on Robinhood Chain" },
              ].map((s, i) => (
                <li
                  key={s.title}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-lime-400/40"
                >
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime-400/15 text-lime-300">
                    {s.title === "Get paid" ? <TokenIcon className="h-6 w-6" /> : <s.icon className="h-4 w-4" />}
                    <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-lime-400 font-mono text-[9px] font-bold text-ink-950">
                      {i + 1}
                    </span>
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[14px] font-semibold">{s.title}</span>
                    <span className="block text-[11.5px] text-white/50">{s.sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
