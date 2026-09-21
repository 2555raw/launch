import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { QrCode } from "@/components/app/QrCode";
import { Copyable } from "@/components/ui/Copyable";
import { Button } from "@/components/ui/Button";
import { config } from "@/lib/config";
import { handleLink } from "@/lib/qr";

export const metadata: Metadata = { title: "Receive · Payence" };

export default function ReceivePage() {
  const { user } = requireAuth();
  const link = handleLink(config.appUrl, user.handle);

  return (
    <div>
      <PageHeader title="Receive" subtitle="Show this to get paid by another Payence account." back="/dashboard" />

      <div className="space-y-5 px-5 md:px-1">
        <section className="card flex flex-col items-center px-6 py-8">
          <QrCode data={link} label={`QR code for paying @${user.handle}`} />
          <p className="mt-6 text-[20px] font-bold tracking-tight">@{user.handle}</p>
          <p className="mt-1 text-[13.5px] text-muted">{user.name}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <Copyable value={`@${user.handle}`} label="Copy handle" />
            <Copyable value={link} label="Copy link" />
          </div>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Receiving from outside Payence</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            To receive stablecoins from an exchange or another wallet, use a deposit address instead. Each network has
            its own address, and sending an asset over the wrong network loses the funds.
          </p>
          <Button href="/wallet/deposit" variant="secondary" size="md" className="mt-4">
            Deposit addresses
          </Button>
        </section>
      </div>
    </div>
  );
}
