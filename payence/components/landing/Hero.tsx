import { Button } from "@/components/ui/Button";
import { PhoneMock } from "./PhoneMock";

/**
 * The positioning: not "crypto payments", but money that behaves like money.
 * The headline names the job (spend), not the technology.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-hair">
      <div className="shell grid gap-14 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-pill border border-hair bg-surface px-3 py-1.5 text-[12.5px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
            Digital euros and dollars, spendable today
          </p>

          <h1 className="mt-6 text-display font-extrabold">
            Spend stablecoins
            <br />
            <span className="text-coral">like money.</span>
          </h1>

          <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-muted md:text-[18.5px]">
            Hold digital euros and dollars in one balance, and pay with them in a shop, online, or to another person.
            It settles in seconds and costs a fraction of a cent. You never touch a gas fee, a seed phrase or an
            exchange.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/signup" size="lg">
              Open an account
            </Button>
            <Button href="/merchant" variant="secondary" size="lg">
              Accept payments
            </Button>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-hair pt-7">
            {[
              ["~2s", "to settle"],
              ["€0.02", "network fee"],
              ["0.6%", "merchant rate"],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="tnum text-[22px] font-bold tracking-tight">{v}</dt>
                <dd className="mt-1 text-[12.5px] text-muted">{k}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex justify-center md:justify-end">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}
