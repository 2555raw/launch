import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { depositAddressFor } from "@/lib/services/payments";
import { networksFor, NETWORKS, type NetworkId } from "@/lib/networks";
import { QrCode } from "@/components/app/QrCode";
import { Copyable } from "@/components/ui/Copyable";
import { Alert } from "@/components/ui/Alert";
import { SIMULATED_CHAIN } from "@/lib/config";
import { SimulateDeposit } from "./SimulateDeposit";
import { ASSET_IDS } from "@/lib/assets";

export const metadata: Metadata = { title: "Add money · Payence" };

export default async function DepositPage({ searchParams }: { searchParams: { network?: string } }) {
  const { user } = requireAuth();
  const usable = networksFor("USDC", true);
  const selected = (usable.find((n) => n.id === searchParams.network) ?? usable[0]).id as NetworkId;
  const address = await depositAddressFor(user.id, selected);
  const net = NETWORKS[selected];
  const assetsHere = ASSET_IDS.filter((a) => net.tokens[a]);

  return (
    <div>
      <PageHeader title="Add money" subtitle="Send stablecoins from an exchange or wallet." back="/wallet" />

      <div className="space-y-5 px-5 md:px-1">
        <nav aria-label="Network" className="flex gap-2 overflow-x-auto pb-1">
          {usable.map((n) => (
            <a
              key={n.id}
              href={`/wallet/deposit?network=${n.id}`}
              aria-current={n.id === selected ? "page" : undefined}
              className={`shrink-0 rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors ${
                n.id === selected ? "border-ink bg-ink text-canvas" : "border-hair hover:border-hairStrong"
              }`}
            >
              {n.name}
            </a>
          ))}
        </nav>

        <Alert tone="warning" title="Send only these assets on this network.">
          {assetsHere.join(", ")} on {net.name}. Anything else sent to this address is lost and cannot be recovered.
        </Alert>

        <section className="card flex flex-col items-center px-6 py-8">
          <QrCode data={address.address} label={`Deposit address on ${net.name}`} />
          <p className="mt-6 break-all text-center font-mono text-[13px] leading-relaxed">{address.address}</p>
          <div className="mt-4">
            <Copyable value={address.address} label="Copy address" />
          </div>
          <dl className="mt-6 grid w-full grid-cols-2 gap-4 border-t border-hair pt-5 text-[13px]">
            <div>
              <dt className="text-muted">Network</dt>
              <dd className="mt-0.5 font-medium">{net.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Credited after</dt>
              <dd className="mt-0.5 font-medium">
                {net.confirmations} confirmation{net.confirmations === 1 ? "" : "s"} (~{net.confirmationSeconds * net.confirmations}s)
              </dd>
            </div>
          </dl>
        </section>

        {SIMULATED_CHAIN && <SimulateDeposit network={selected} assets={assetsHere} />}
      </div>
    </div>
  );
}
