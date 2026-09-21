import { Icon } from "@/components/ui/Icons";

const STEPS = [
  {
    n: "01",
    icon: "plus" as const,
    title: "Add stablecoins",
    body: "Send USDC, USDT or EURC from an exchange or wallet to your Payence deposit address. It lands in your balance once the network confirms, usually in a few seconds.",
  },
  {
    n: "02",
    icon: "scan" as const,
    title: "Pay",
    body: "Scan the merchant's code or open their checkout link. You see the amount in euros, the exact stablecoin amount and the rate before you confirm.",
  },
  {
    n: "03",
    icon: "check" as const,
    title: "Done",
    body: "The merchant is paid instantly. You get a receipt with the fee, the rate, the network and the transaction hash, and they get their money without waiting for a card settlement cycle.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-hair py-20 md:py-28">
      <div className="shell">
        <h2 className="max-w-[16ch] text-title font-extrabold">Three steps, and none of them is about crypto.</h2>
        <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-muted">
          Under the surface this is a blockchain settling a stablecoin transfer. On the screen it is an amount, a
          merchant and a confirm button.
        </p>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => {
            const I = Icon[s.icon];
            return (
              <li key={s.n} className="card flex flex-col px-6 py-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-canvas">
                    <I className="h-[18px] w-[18px]" />
                  </span>
                  <span className="tnum text-[12px] text-faint">{s.n}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2.5 text-[14px] leading-[1.65] text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
