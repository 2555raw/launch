import { ASSET_IDS, asset } from "@/lib/assets";
import { NETWORK_IDS, network } from "@/lib/networks";
import { AssetMark } from "@/components/ui/Amount";

/** Assets and networks are read from the registries, so this cannot go stale. */
export function Assets() {
  return (
    <section className="border-b border-hair bg-shell py-20 md:py-24">
      <div className="shell grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-title font-extrabold">What you hold</h2>
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-muted">
            Stablecoins, not volatile assets. Each one tracks a currency you already think in, so a balance of 100 USDC
            is worth about 100 dollars tomorrow as well as today.
          </p>
          <ul className="mt-8 space-y-2.5">
            {ASSET_IDS.map((id) => {
              const a = asset(id);
              return (
                <li key={id} className="flex items-center gap-3.5 rounded-card border border-hair bg-surface px-4 py-3.5">
                  <AssetMark assetId={id} size={34} />
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">{a.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {a.symbol} · tracks the {a.peg === "EUR" ? "euro" : "US dollar"} · issued by {a.issuer}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
            A stablecoin is not a bank deposit. Its value depends on the issuer holding the reserves it claims, and it
            is not covered by a deposit guarantee scheme.
          </p>
        </div>

        <div>
          <h2 className="text-title font-extrabold">Where it settles</h2>
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-muted">
            Payence picks the network. You see a fee in euros, not a gas estimate, and a confirmation time in seconds,
            not a block count. The detail is on the receipt if you want it.
          </p>
          <ul className="mt-8 divide-y divide-hair rounded-card border border-hair bg-surface">
            {NETWORK_IDS.filter((n) => !network(n).testnet).map((id) => {
              const n = network(id);
              return (
                <li key={id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">{n.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {Object.keys(n.tokens).join(", ")}
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-right text-[12.5px] text-muted">
                    ~{n.confirmationSeconds * n.confirmations}s
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
            Adding a network or a token is a configuration entry, not a rebuild: the app reads both from a registry.
          </p>
        </div>
      </div>
    </section>
  );
}
