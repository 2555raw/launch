import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";

const POINTS = [
  ["No chargebacks", "A settled stablecoin payment cannot be pulled back weeks later. Refunds are yours to issue, deliberately."],
  ["Money the same day", "Funds are in your balance the moment the customer confirms, not after a two-day settlement cycle."],
  ["One rate, 0.6%", "No monthly fee, no terminal rental, no interchange, no cross-border surcharge."],
  ["Works on paper", "A printed QR code is a full point of sale. Nothing to install, nothing to plug in."],
];

export function Merchants() {
  return (
    <section id="merchants" className="border-b border-hair bg-ink py-20 text-canvas md:py-28">
      <div className="shell grid gap-14 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-[12px] uppercase tracking-[0.1em] text-canvas/50">For business</p>
          <h2 className="mt-5 max-w-[16ch] text-title font-extrabold">Take payments without a card network.</h2>
          <p className="mt-6 max-w-[48ch] text-[16px] leading-relaxed text-canvas/70">
            Charge in euros, get paid in stablecoins, settle into the asset you choose. Generate a code at the counter,
            a link for an invoice, or call the API from your own checkout.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/merchant" variant="invert" size="lg">
              Set up a merchant account
            </Button>
            <Button href="/developers" variant="ghost" size="lg" className="text-canvas hover:bg-canvas/10">
              Read the docs
            </Button>
          </div>
        </div>

        <ul className="space-y-3">
          {POINTS.map(([title, body]) => (
            <li key={title} className="rounded-card border border-hairDark px-5 py-4">
              <p className="flex items-center gap-2.5 text-[15px] font-semibold">
                <Icon.check className="h-4 w-4 shrink-0 text-coral" />
                {title}
              </p>
              <p className="mt-1.5 pl-[26px] text-[13.5px] leading-relaxed text-canvas/60">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
