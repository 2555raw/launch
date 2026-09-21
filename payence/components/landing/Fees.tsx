import { FEE_COPY } from "@/lib/services/fees";

const ROWS: [string, string, string][] = [
  ["Sending to another Payence account", FEE_COPY.transfer, "Any amount, any country."],
  ["Paying a merchant", "Free for you", "The merchant pays 0.6% of the payment."],
  ["Adding money", FEE_COPY.deposit, "You pay whatever the sending network charges."],
  ["Withdrawing on-chain", FEE_COPY.withdrawal, "Passed through at cost, from €0.02 on Base."],
  ["Converting between assets", FEE_COPY.conversion, "Taken at the reference rate shown before you confirm."],
];

export function Fees() {
  return (
    <section id="fees" className="border-b border-hair py-20 md:py-28">
      <div className="shell">
        <h2 className="max-w-[18ch] text-title font-extrabold">Every fee, on one page.</h2>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-muted">
          There is no spread hidden in the exchange rate and no monthly charge. What is listed here is what is taken.
        </p>

        <div className="mt-10 overflow-hidden rounded-card border border-hair bg-surface">
          <table className="w-full text-left">
            <caption className="sr-only">Payence fee schedule</caption>
            <thead>
              <tr className="border-b border-hair text-[12px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-5 py-3.5 font-medium">What you do</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Fee</th>
                <th scope="col" className="hidden px-5 py-3.5 font-medium sm:table-cell">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {ROWS.map(([what, fee, detail]) => (
                <tr key={what}>
                  <th scope="row" className="px-5 py-4 text-[14px] font-medium">
                    {what}
                    <span className="mt-1 block text-[12.5px] font-normal text-muted sm:hidden">{detail}</span>
                  </th>
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] font-semibold">{fee}</td>
                  <td className="hidden px-5 py-4 text-[13.5px] text-muted sm:table-cell">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
