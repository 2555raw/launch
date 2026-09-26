import { useWallet } from '../wallet/WalletProvider';
import { isMobile, mobileDeepLinks } from '../wallet/discovery';
import { usePad } from '../backend/PadProvider';
import { Modal } from './bits';
import { DropIcon } from './icons';

const INSTALL = [
  { name: 'MetaMask', href: 'https://metamask.io/download/' },
  { name: 'Rabby', href: 'https://rabby.io/' },
  { name: 'Coinbase Wallet', href: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'Phantom', href: 'https://phantom.com/download' },
];

export function ConnectModal() {
  const w = useWallet();
  const pad = usePad();
  const mobile = isMobile();
  const playground = pad.mode === 'playground';

  return (
    <Modal open={w.modalOpen} onClose={w.closeModal} title="Connect a wallet">
      <p className="muted small" style={{ marginTop: 0 }}>
        {playground
          ? 'In the playground your wallet only lends its address. Nothing is signed and no real money moves.'
          : 'Transactions are signed in your wallet. The site never sees your keys.'}
      </p>

      {w.wallets.length > 0 && (
        <div className="wallet-list">
          {w.wallets.map((wal) => (
            <button key={wal.info.uuid} className="wallet-row" onClick={() => w.connect(wal)} disabled={w.status === 'connecting'}>
              {wal.info.icon ? <img src={wal.info.icon} alt="" width={28} height={28} /> : <span className="wallet-fallback"><DropIcon /></span>}
              <span>{wal.info.name}</span>
              <span className="muted small">{w.status === 'connecting' ? 'Check your wallet…' : 'Detected'}</span>
            </button>
          ))}
        </div>
      )}

      {w.wallets.length === 0 && (
        <div className="callout" style={{ marginBottom: 14 }}>
          <b>No wallet found in this browser.</b>{' '}
          {mobile ? 'Open this page inside your wallet app:' : 'Install one, then reload this page:'}
          <div className="wallet-links">
            {(mobile ? mobileDeepLinks() : INSTALL).map((l) => (
              <a key={l.name} className="chip" href={l.href} target="_blank" rel="noreferrer">
                {l.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {playground && (
        <button className="wallet-row guest" onClick={w.connectGuest}>
          <span className="wallet-fallback">
            <DropIcon />
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
