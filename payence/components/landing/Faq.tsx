const QA: [string, string][] = [
  [
    "Do I need to understand crypto to use this?",
    "No. You add money, you see a balance in euros, and you pay. The blockchain is how the payment settles, the same way card rails are how a card payment settles. Nothing asks you to manage a wallet or pay a gas fee.",
  ],
  [
    "Is my balance going to change value overnight?",
    "Stablecoins track a currency: a USDC is designed to be worth a dollar, a EURC a euro. They are not investments and Payence does not offer trading. The value depends on the issuer holding real reserves, which is why only major regulated issuers are supported.",
  ],
  [
    "What happens if I send money to the wrong person?",
    "A transfer to another Payence account can only be returned by the person who received it. A payment to a merchant can be refunded by that merchant. A confirmed on-chain withdrawal cannot be reversed by anyone, which is why the withdrawal screen makes you check the address.",
  ],
  [
    "Why is it cheaper than a card?",
    "There is no issuer, no acquirer and no interchange between the two sides. A stablecoin transfer on a low-cost network costs a fraction of a cent, and Payence charges the merchant 0.6% to cover the ledger, the compliance work and support.",
  ],
  [
    "Can I get my money out as euros in a bank account?",
    "Converting stablecoins to bank-account euros is a regulated activity that needs a licensed off-ramp partner. Payence can hold your balance and send it on-chain to any wallet you control; fiat payout is an integration point, not something this build does.",
  ],
  [
    "Is Payence a bank?",
    "No, and it is not a licensed payment institution either. This is a working demonstration of the infrastructure. Do not put real customer funds through it.",
  ],
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-hair py-20 md:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[0.5fr_1.5fr] lg:gap-20">
        <h2 className="text-title font-extrabold">Questions</h2>
        <ul className="border-t border-hairStrong">
          {QA.map(([q, a]) => (
            <li key={q} className="border-b border-hair">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-5 text-[16px] font-medium tracking-tight md:text-[17.5px]">
                  {q}
                  <span className="relative h-4 w-4 shrink-0 transition-transform group-open:rotate-45" aria-hidden>
                    <i className="absolute left-0 top-1/2 block h-px w-4 -translate-y-1/2 bg-ink" />
                    <i className="absolute left-1/2 top-0 block h-4 w-px -translate-x-1/2 bg-ink" />
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-6 pr-8 text-[14.5px] leading-[1.7] text-muted">{a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
