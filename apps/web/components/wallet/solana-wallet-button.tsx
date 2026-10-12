'use client';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';

const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).BaseWalletMultiButton, { ssr: false });

/** The wallet-adapter picker button with its built-in labels translated. */
export function SolanaWalletButton({ children, className }: { children?: ReactNode; className?: string }) {
  const t = useT();
  return (
    <WalletMultiButton
      className={className}
      labels={{
        'change-wallet': t('Change wallet'),
        connecting: t('Connecting…'),
        'copy-address': t('Copy address'),
        copied: t('Copied'),
        disconnect: t('Disconnect'),
        'has-wallet': t('Connect'),
        'no-wallet': t('Select wallet'),
      }}
    >
      {children}
    </WalletMultiButton>
  );
}
