import Image from "next/image";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "./Reveal";

export function CallToAction() {
  return (
    <section className="container pb-28">
      <Reveal>
        <div className="grain relative isolate overflow-hidden rounded-[36px] border border-white/10">
          <Image
            src="/images/trail-valley.jpg"
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
          </div>
        </div>
      </Reveal>
    </section>
  );
}
