'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Spinner } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';
import { SolanaCard } from '@/components/wallet/solana-card';
import { RobinhoodCard } from '@/components/wallet/robinhood-card';
import { LinkedWallets } from '@/components/wallet/linked-wallets';
import { SwapPanel } from '@/components/wallet/swap-panel';

function WalletCenter() {
  const t = useT();
  const params = useSearchParams();
  const swap = params.get('swap');
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('Wallet')} subtitle={t('Connect your wallets, link them to your account and swap on Solana through Jupiter. Keys never leave your wallet.')} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-4">
          <SolanaCard />
          <RobinhoodCard />
          <LinkedWallets />
        </div>
        <div id="swap">
          <SwapPanel preselectOutput={swap} />
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const t = useT();
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> {t('Loading…')}
        </div>
      }
    >
      <WalletCenter />
    </Suspense>
  );
}
