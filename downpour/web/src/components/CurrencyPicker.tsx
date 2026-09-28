import { useMemo, useState } from 'react';
import type { Currency } from '../backend/types';
import { POPULAR, REGIONS } from '../data/currencies';
import { compact } from '../lib/format';
import { unitsPerUsd } from '../lib/views';
import { CurrencyDot, Modal } from './bits';
import { Search } from './icons';

/** Choose the currency a coin lives in, by code: search, popular first, grouped by region.
 *  `options` is what is on offer: the desk's currencies, or every currency where a coin can
 *  be priced in one the desk does not list (those carry `paidIn`, the token buyers pay in). */
export function CurrencyPicker({ value, options, onChange }: { value?: string; options: Currency[]; onChange(code: string): void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = value ? options.find((c) => c.code === value) : undefined;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (c: Currency) => !needle || `${c.code} ${c.name} ${c.region}`.toLowerCase().includes(needle);
    const popular = POPULAR.map((code) => options.find((c) => c.code === code)).filter((c): c is Currency => !!c && match(c));
    const byRegion = REGIONS.map((r) => [r, options.filter((c) => c.region === r && match(c))] as const).filter(([, l]) => l.length);
    return { popular: needle ? [] : popular, byRegion };
  }, [options, q]);

  return (
    <div className="cur-picker">
      <button type="button" className="cur-picker-btn" onClick={() => (setQ(''), setOpen(true))} aria-haspopup="dialog">
        {current ? (
          <>
            <CurrencyDot c={current} size={26} />
            <span>
              <b>{current.code}</b> <span className="muted">{current.name}</span>
            </span>
          </>
        ) : (
          <span className="muted">Pick a currency</span>
        )}
        <span className="muted" style={{ marginLeft: 'auto' }}>
          ▾
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Pair your coin with…" wide>
        <div className="search" style={{ maxWidth: 'none', marginBottom: 14 }}>
          <Search />
          <input className="input" autoFocus placeholder={`Search ${options.length} currencies, metals and crypto`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="token-list">
          {groups.popular.length > 0 && <div className="kicker" style={{ padding: '6px 12px' }}>Popular</div>}
          {groups.popular.map((c) => (
            <Row key={`p${c.code}`} c={c} onPick={() => (onChange(c.code), setOpen(false))} />
          ))}
          {groups.byRegion.map(([region, list]) => (
            <div key={region}>
              <div className="kicker" style={{ padding: '14px 12px 6px' }}>
                {region}
              </div>
              {list.map((c) => (
                <Row key={c.code} c={c} onPick={() => (onChange(c.code), setOpen(false))} />
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Row({ c, onPick }: { c: Currency; onPick(): void }) {
  return (
    <button type="button" className="token-row" onClick={onPick}>
      <span className="token-mini">
        <CurrencyDot c={c} size={30} />
      </span>
      <span className="name">
        <b>{c.code}</b>
        <span className="muted small">
          {c.name}
          {c.paidIn ? ` · paid in ${c.paidIn}` : ''}
        </span>
      </span>
      <span className="muted small num">{c.code === 'USD' ? '' : `1 USD = ${compact(unitsPerUsd(c), 4)}`}</span>
    </button>
  );
}
