import { useMemo, useState } from 'react';
import { usePad } from '../backend/PadProvider';
import type { Address } from '../backend/types';
import { compact } from '../lib/format';
import { amount } from '../lib/views';
import { CoinOrb, CurrencyDot, Modal, PairBadge } from './bits';
import { Search } from './icons';

type Filter = 'all' | 'coins' | 'currencies';

/** Pick any coin or currency. Coins are always shown with the currency they are paired with. */
export function TokenSelect({
  open,
  onClose,
  onPick,
  exclude,
  only,
}: {
  open: boolean;
  onClose(): void;
  onPick(token: Address): void;
  exclude?: string;
  only?: 'currencies' | 'coins';
}) {
  const pad = usePad();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(only ?? 'all');
  const snap = pad.snap;

  const rows = useMemo(() => {
    if (!snap) return [];
    const needle = q.trim().toLowerCase();
    const out: Array<{ token: Address; kind: 'coin' | 'currency'; label: string; sub: string; bal: bigint; usd: number }> = [];
    if (filter !== 'currencies') {
      for (const c of snap.coins) {
        const cur = pad.currencyOf(c);
        const hay = `${c.symbol} ${c.name} ${cur?.code ?? ''} ${cur?.name ?? ''} ${c.address}`.toLowerCase();
        if (needle && !hay.includes(needle)) continue;
        const bal = pad.balances[c.address.toLowerCase()] ?? 0n;
        out.push({ token: c.address, kind: 'coin', label: c.symbol, sub: c.name, bal, usd: pad.usdValue(c.address, bal) });
      }
    }
    if (filter !== 'coins') {
      for (const c of snap.currencies) {
        const hay = `${c.code} ${c.name} ${c.region} ${c.token}`.toLowerCase();
        if (needle && !hay.includes(needle)) continue;
        const bal = pad.balances[c.token.toLowerCase()] ?? 0n;
        out.push({ token: c.token, kind: 'currency', label: c.code, sub: c.name, bal, usd: pad.usdValue(c.token, bal) });
      }
    }
    return out
      .filter((r) => r.token.toLowerCase() !== exclude?.toLowerCase())
      .sort((a, b) => b.usd - a.usd || (a.kind === b.kind ? 0 : a.kind === 'coin' ? -1 : 1));
  }, [snap, q, filter, exclude, pad]);

  return (
    <Modal open={open} onClose={onClose} title="Select a token" wide>
      <div className="search" style={{ maxWidth: 'none', marginBottom: 12 }}>
        <Search />
        <input className="input" autoFocus placeholder="Search a coin, a currency, or paste an address" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!only && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {(['all', 'coins', 'currencies'] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'coins' ? 'Coins' : 'Currencies'}
            </button>
          ))}
        </div>
      )}
      <div className="token-list">
        {rows.slice(0, 250).map((r) => {
          const coin = r.kind === 'coin' ? pad.coinByAddress.get(r.token.toLowerCase()) : undefined;
          const cur = coin ? pad.currencyOf(coin) : pad.currencyByToken.get(r.token.toLowerCase());
          const dec = r.kind === 'currency' ? cur?.decimals ?? 18 : 18;
          return (
            <button
              key={r.token}
              className="token-row"
              onClick={() => {
                onPick(r.token);
                onClose();
              }}
            >
              <span className="token-mini">{coin ? <CoinOrb coin={coin} currency={cur} size={26} /> : cur && <CurrencyDot c={cur} size={30} />}</span>
              <span className="name">
                {coin ? <PairBadge coin={coin} currency={cur} size="sm" /> : <b>{r.label}</b>}
                <span className="muted small">{coin ? `${r.sub} · priced in ${cur?.name}` : r.sub}</span>
              </span>
              <span className="num small" style={{ textAlign: 'right' }}>
                {r.bal > 0n ? compact(amount(r.bal, dec)) : <span className="muted">0</span>}
              </span>
            </button>
          );
        })}
        {!rows.length && <div className="empty small">Nothing matches “{q}”.</div>}
      </div>
    </Modal>
  );
}
