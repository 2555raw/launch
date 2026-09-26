import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { SITE } from '../config/site';
import { chainMeta, explorerTx } from '../config/chains';
import { useWallet } from '../wallet/WalletProvider';
import { usePad } from '../backend/PadProvider';
import { shortAddr } from '../lib/format';
import { CopyButton } from './bits';
import { ConnectModal } from './ConnectModal';
import { Chevron, Close, Logo, Menu, Sparkle } from './icons';

/** Always in the bar (launching is the button beside them). */
export const NAV = [
  { to: '/swap', label: 'Swap' },
  { to: '/board', label: 'Board' },
  { to: '/portfolio', label: 'Portfolio' },
];

/** Under More in the bar. */
export const MORE = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/desk', label: 'Currency desk' },
  { to: '/proof', label: 'Proof' },
  { to: '/verify', label: 'Verify' },
  { to: '/faq', label: 'FAQ' },
];

/** Everything, for the phone menu. */
const ALL = [NAV[1], { to: '/launch', label: 'Launch a coin' }, NAV[0], NAV[2], ...MORE];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const here = MORE.some((n) => loc.pathname.startsWith(n.to));
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, []);
  return (
    <div className="more" ref={ref}>
      <button className={`more-btn ${here ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        More <Chevron />
      </button>
      {open && (
        <div className="more-menu glass" data-solid>
          {MORE.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletButton() {
  const w = useWallet();
  const pad = usePad();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  if (!w.address) {
    return (
      <button className="nav-connect" onClick={w.openModal}>
        Connect wallet
      </button>
    );
  }
  return (
    <div className="acct" ref={ref}>
      <button className={`acct-btn ${pad.wrongChain ? 'warn' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {w.walletIcon ? <img src={w.walletIcon} alt="" width={18} height={18} /> : <span className="dot" style={{ color: w.isGuest ? '#7cc4ff' : '#3ddc97' }} />}
        <span className="mono">{shortAddr(w.address, 5, 4)}</span>
      </button>
      {open && (
        <div className="acct-menu glass" data-solid>
          <div className="muted small">{w.isGuest ? 'Guest (playground only)' : w.walletName}</div>
          <div className="mono acct-addr">{w.address}</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <CopyButton text={w.address} label="Copy address" />
            {pad.wrongChain && pad.chainId && (
              <button className="copy-btn" onClick={() => w.switchChain(pad.chainId!)}>
                Switch to {chainMeta(pad.chainId).name}
              </button>
            )}
          </div>
          <Link className="btn btn-sm btn-block" to="/portfolio" onClick={() => setOpen(false)}>
            Portfolio
          </Link>
          <button
            className="btn btn-sm btn-block btn-ghost"
            onClick={() => {
              w.disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function ModeSwitch() {
  const pad = usePad();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  const label = pad.mode === 'live' && pad.chainId ? `LIVE · ${chainMeta(pad.chainId).name}` : 'PLAYGROUND';
  return (
    <div className="mode" ref={ref}>
      <button className={`mode-pill ${pad.mode}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Where the pad runs">
        <span className="dot live" /> {label}
      </button>
      {open && (
        <div className="mode-menu glass" data-solid>
          <button className={pad.mode === 'playground' ? 'on' : ''} onClick={() => (pad.setMode('playground'), setOpen(false))}>
            <b>Playground</b>
            <span>Everything works, simulated in your browser. No real money.</span>
          </button>
          <button
            className={pad.mode === 'live' ? 'on' : ''}
            disabled={!pad.canGoLive}
            onClick={() => (pad.setMode('live'), setOpen(false))}
          >
            <b>Live</b>
            <span>{pad.canGoLive ? 'The contracts on chain, signed with your wallet.' : 'Not deployed yet. Run npm run deploy to go live.'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CaBar() {
  const t = SITE.token;
  return (
    <div className="ca-bar glass" data-solid>
      <span className="ca-sym">{t.symbol}</span>
      <span className="ca-label">CA</span>
      {t.address ? (
        <>
          <span className="mono ca-addr">{t.address}</span>
          <CopyButton text={t.address} />
        </>
      ) : (
        <span className="ca-addr muted">
          <span className="ca-long">Not launched yet. The contract address appears here the moment it exists.</span>
          <span className="ca-short">coming soon</span>
        </span>
      )}
      <span className="ca-spacer" />
      <ModeSwitch />
    </div>
  );
}

function Toasts() {
  const pad = usePad();
  return (
    <div className="toasts" aria-live="polite">
      {pad.toasts.map((t) => {
        const href = t.detail && t.detail.startsWith('0x') && pad.chainId ? explorerTx(pad.chainId, t.detail) : '';
        const text =
          t.stage === 'approve'
            ? 'Approve the token in your wallet…'
            : t.stage === 'sign'
              ? pad.mode === 'live'
                ? 'Confirm in your wallet…'
                : 'Working…'
              : t.stage === 'pending'
                ? pad.mode === 'live'
                  ? 'Waiting for the chain…'
                  : 'Working…'
                : t.stage === 'done'
                  ? 'Done.'
                  : t.detail;
        return (
          <div key={t.id} className={`toast glass ${t.stage}`} data-solid>
            <div className="row-between">
              <b>{t.title}</b>
              <button className="icon-btn" onClick={() => pad.dismiss(t.id)} aria-label="Dismiss">
                <Close size={12} />
              </button>
            </div>
            <div className="small">{text}</div>
            {href && (
              <a className="small accent-text" href={href} target="_blank" rel="noreferrer">
                View transaction ↗
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Footer() {
  const pad = usePad();
  const pairs = pad.snap?.coins.length ?? 0;
  const currencies = pad.snap?.currencies.length ?? 0;
  const where = pad.mode === 'live' && pad.chainId ? `ON ${chainMeta(pad.chainId).name.toUpperCase()} · ` : '';
  return (
    <footer className="footer" data-solid>
      <div className="wrap">
        <div className="footer-top">
          <div>
            <Link to="/" className="brand">
              <Logo /> {SITE.name}
            </Link>
            <p className="muted small" style={{ marginTop: 10 }}>
              {SITE.footerLine}
            </p>
          </div>
          <nav className="footer-links">
            <Link to="/swap">Swap</Link>
            <Link to="/board">The board</Link>
            <Link to="/launch">Launch a coin</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/desk">Currency desk</Link>
            <Link to="/portfolio">Portfolio</Link>
            <Link to="/proof">Proof</Link>
            <Link to="/verify">Verify</Link>
            <Link to="/faq">Questions</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {SITE.name.toUpperCase()} · {SITE.tagline.toUpperCase()}
          </span>
          <span className="footer-live">
            <i aria-hidden="true" />
            {where}
            {pairs} PAIRS TRADING · {currencies} CURRENCIES
          </span>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="app">
      <div className="top" data-solid>
        <header className="nav glass">
          <Link to="/" className="brand" aria-label={`${SITE.name} home`}>
            <Logo /> <span>{SITE.name}</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `${n.to === '/swap' ? 'nav-swap ' : ''}${isActive ? 'on' : ''}`}>
                {n.label}
              </NavLink>
            ))}
            <MoreMenu />
          </nav>
          <div className="nav-actions">
            <WalletButton />
            <Link to="/launch" className="btn btn-primary btn-sm nav-cta">
              Launch a coin <Sparkle size={12} />
            </Link>
            <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
              {menu ? <Close /> : <Menu />}
            </button>
          </div>
        </header>
        {menu && (
          <nav className="sheet glass" aria-label="Main (mobile)">
            {ALL.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <CaBar />
      </div>
      <main>{children}</main>
      <Footer />
      <Toasts />
      <ConnectModal />
    </div>
  );
}
