import { useState } from 'react';
import { useWallet } from '../wallet/WalletProvider';
import { FEATURED, installedAs, isMobile } from '../wallet/discovery';
import type { DiscoveredWallet } from '../wallet/types';
import { usePad } from '../backend/PadProvider';
import { Modal } from './bits';
import { StarIcon } from './icons';

const ICONS = import.meta.env.BASE_URL;

export function ConnectModal() {
  const w = useWallet();
  const pad = usePad();
  const mobile = isMobile();
  const playground = pad.mode === 'playground';
  const [pending, setPending] = useState<string>();
  const here = typeof location !== 'undefined' ? location.href : '';

  const connect = (wal: DiscoveredWallet) => {
    setPending(wal.info.uuid);
    void w.connect(wal);
  };
  const state = (wal: DiscoveredWallet) => (w.status === 'connecting' && pending === wal.info.uuid ? 'Check your wallet…' : 'Detected');

  // MetaMask, Coinbase Wallet and Phantom always come first; any other wallet the
  // browser has installed is listed after them
  const featured = FEATURED.map((f) => ({ ...f, wallet: installedAs(f, w.wallets) }));
  const taken = new Set(featured.map((f) => f.wallet?.info.uuid));
  const others = w.wallets.filter((wal) => !taken.has(wal.info.uuid));

  return (
    <Modal open={w.modalOpen} onClose={w.closeModal} title="Connect a wallet">
      <p className="muted small" style={{ marginTop: 0 }}>
        {playground
          ? 'In the playground your wallet only lends its address. Nothing is signed and no real money moves.'
          : 'Transactions are signed in your wallet. The site never sees your keys.'}
      </p>

      <div className="wallet-list">
        {featured.map((f) =>
          f.wallet ? (
            <button key={f.name} className="wallet-row featured" onClick={() => connect(f.wallet!)} disabled={w.status === 'connecting'}>
              <img src={`${ICONS}${f.icon}`} alt="" width={36} height={36} />
              <span>{f.name}</span>
              <span className="wallet-state ready">{state(f.wallet)}</span>
            </button>
          ) : mobile ? (
            <a key={f.name} className="wallet-row featured" href={f.open(here)}>
              <img src={`${ICONS}${f.icon}`} alt="" width={36} height={36} />
              <span>{f.name}</span>
              <span className="wallet-state">Open in the app ↗</span>
            </a>
          ) : (
            <a key={f.name} className="wallet-row featured" href={f.install} target="_blank" rel="noreferrer">
              <img src={`${ICONS}${f.icon}`} alt="" width={36} height={36} />
              <span>{f.name}</span>
              <span className="wallet-state">Not installed · get it ↗</span>
            </a>
          ),
        )}
      </div>

      {others.length > 0 && (
        <>
          <div className="kicker wallet-others">Other wallets in this browser</div>
          <div className="wallet-list">
            {others.map((wal) => (
              <button key={wal.info.uuid} className="wallet-row" onClick={() => connect(wal)} disabled={w.status === 'connecting'}>
                {wal.info.icon ? (
                  <img src={wal.info.icon} alt="" width={28} height={28} />
                ) : (
                  <span className="wallet-fallback">
                    <StarIcon />
                  </span>
                )}
                <span>{wal.info.name}</span>
                <span className="wallet-state ready">{state(wal)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {playground && (
        <button className="wallet-row guest" onClick={w.connectGuest}>
          <span className="wallet-fallback">
            <StarIcon />
          </span>
          <span>Continue as a guest</span>
          <span className="muted small">Playground only · a random address kept in this browser</span>
        </button>
      )}

      {w.error && (
        <div className="callout warn" style={{ marginTop: 14 }}>
          {w.error}
        </div>
      )}
    </Modal>
  );
}
