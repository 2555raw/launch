import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { fmtAmount, fmtDate, fmtSteps } from "@/lib/format";
import { transparencyReport } from "@/lib/services/transparency";
import { fmtEth } from "@/lib/web3/native";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Transparency",
  description: "Every Strydo payout, with its transaction on Robinhood Chain.",
};

export default async function TransparencyPage() {
  const r = await transparencyReport();
  const tiles = [
    { label: "Paid to walkers", value: `$${fmtAmount(r.paidUsd)}`, sub: r.paidEth > 0 ? `${fmtEth(r.paidEth)} ETH sent` : "in ETH" },
    { label: "Payouts", value: r.payoutCount.toLocaleString("en-US"), sub: `to ${r.paidWalkers.toLocaleString("en-US")} ${r.paidWalkers === 1 ? "walker" : "walkers"}` },
    { label: "Verified steps", value: fmtSteps(r.verifiedSteps), sub: "checked by the team" },
    { label: "Walkers", value: r.walkers.toLocaleString("en-US"), sub: "signed up" },
  ];

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl">
        <div className="label !text-lime-300">Transparency</div>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-[-0.02em] sm:text-6xl">Every payout, out in the open.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
          Strydo pays walkers in ETH on Robinhood Chain. Each payout below links to its transaction, so anyone can check
          who was paid, how much and when.
        </p>

        <dl className="mt-12 grid grid-cols-2 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-4">
          {tiles.map((t, i) => (
            <div
              key={t.label}
              className={`px-6 py-6 ${i % 2 === 1 ? "border-l border-white/10" : ""} ${i > 1 ? "border-t border-white/10 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <dt className="label !text-[10px]">{t.label}</dt>
              <dd className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{t.value}</dd>
              <dd className="mt-1 text-[13px] text-white/45">{t.sub}</dd>
            </div>
          ))}
        </dl>

        {r.rewardWallets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-lime-400/25 bg-lime-400/[0.05] px-5 py-4 text-[14px] text-white/70">
            <ShieldCheck className="h-5 w-5 shrink-0 text-lime-400" />
            <span>{r.rewardWallets.length === 1 ? "Rewards wallet" : "Rewards wallets"}:</span>
            {r.rewardWallets.map((w) =>
              w.url ? (
                <a
                  key={w.address}
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 break-all font-mono text-[13px] text-lime-300 hover:text-lime-200"
                >
                  {w.address} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                <span key={w.address} className="break-all font-mono text-[13px] text-lime-300">
                  {w.address}
                </span>
              ),
            )}
          </div>
        )}

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-tight">All payouts</h2>
        <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02]">
          {r.payouts.length === 0 ? (
            <div className="px-6 py-14 text-center text-white/50">
              No payouts yet. The first one will show up here with its transaction.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Wallet</th>
                  <th className="px-5 py-3 text-right font-medium">Steps</th>
                  <th className="px-5 py-3 text-right font-medium">Paid</th>
                  <th className="px-5 py-3 text-right font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                {r.payouts.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3.5 text-white/60">{fmtDate(p.paidAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-5 py-3.5 font-mono text-white/80">{p.wallet}</td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-white/70">{fmtSteps(p.steps)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono tabular-nums text-lime-300">${fmtAmount(p.usdAmount)}</span>{" "}
                      <span className="inline-flex items-center gap-1 text-[12.5px] text-white/45">
                        {p.token === "ETH" ? `${fmtEth(p.amount)}` : "in"} <TokenIcon symbol={p.token} className="h-3.5 w-3.5" /> {p.token}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.txUrl ? (
                        <a href={p.txUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lime-300 hover:text-lime-200">
                          View <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-white/30">Demo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-4 text-[13px] text-white/40">
          Amounts are counted in dollars and sent as ETH at the price of the moment the payout was made.
        </p>
      </div>
    </PublicShell>
  );
}
