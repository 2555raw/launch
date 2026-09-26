import { useMemo, useState } from 'react';
import { usePad } from '../backend/PadProvider';
import type { Address, Currency } from '../backend/types';
import { POPULAR, REGIONS } from '../data/currencies';
import { compact } from '../lib/format';
import { unitsPerUsd } from '../lib/views';
import { CurrencyDot, Modal } from './bits';
import { Search } from './icons';

/** Choose the currency a coin will be paired with: search, popular first, grouped by region. */
export function CurrencyPicker({ value, onChange }: { value?: Address; onChange(token: Address): void }) {
  const pad = usePad();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = value ? pad.currencyByToken.get(value.toLowerCase()) : undefined;

  const groups = useMemo(() => {
    const list = pad.snap?.currencies ?? [];
    const needle = q.trim().toLowerCase();
    const match = (c: Currency) => !needle || `${c.code} ${c.name} ${c.region}`.toLowerCase().includes(needle);
    const popular = POPULAR.map((code) => list.find((c) => c.code === code)).filter((c): c is Currency => !!c && match(c));
    const byRegion = REGIONS.map((r) => [r, list.filter((c) => c.region === r && match(c))] as const).filter(([, l]) => l.length);
    return { popular: needle ? [] : popular, byRegion };
  }, [pad.snap, q]);

  return (
    <div className="cur-picker">
      <button type="button" className="cur-picker-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {current ? (
          <>
            <CurrencyDot c={current} size={26} />
            <span>
              <b>{current.code}</b> <span className="muted">— {current.name}</span>
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
          <input className="input" autoFocus placeholder={`Search ${pad.snap?.currencies.length ?? 148} currencies, metals and crypto`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="token-list">
          {groups.popular.length > 0 && <div className="kicker" style={{ padding: '6px 12px' }}>Popular</div>}
          {groups.popular.map((c) => (
            <Row key={`p${c.code}`} c={c} onPick={() => (onChange(c.token), setOpen(false))} />
          ))}
          {groups.byRegion.map(([region, list]) => (
            <div key={region}>
              <div className="kicker" style={{ padding: '14px 12px 6px' }}>
                {region}
              </div>
              {list.map((c) => (
                <Row key={c.code} c={c} onPick={() => (onChange(c.token), setOpen(false))} />
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
        <span className="muted small">{c.name}</span>
      </span>
      <span className="muted small num">{c.code === 'USD' ? '' : `1 USD = ${compact(unitsPerUsd(c), 4)}`}</span>
    </button>
  );
}
