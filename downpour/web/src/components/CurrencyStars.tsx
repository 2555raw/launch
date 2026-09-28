import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { CURRENCIES, POPULAR, currencyColor, dropGlyph } from '../data/currencies';
import { Orb } from './bits';
import { skyStyle } from './CoinCard';

/** The currencies a coin can live in, as stars in their own patches of sky, each a link to
 *  launch the first coin priced in it: what a board with no coins yet shows instead of nothing. */
export function CurrencyStars({ limit, title = 'Light the first star' }: { limit?: number; title?: string }) {
  const pad = usePad();
  const listed = pad.snap?.currencies ?? [];
  const byCode = new Map(listed.map((c) => [c.code, c]));
  // every currency, the desk's own first as they are, the rest as a coin can be priced in them
  const all = CURRENCIES.map((s) => {
    const l = byCode.get(s.code);
    return { code: s.code, name: l?.name ?? s.name, color: l?.color ?? currencyColor(s.code) };
  });
  const order = [...POPULAR.map((code) => all.find((c) => c.code === code)).filter((c): c is (typeof all)[number] => !!c), ...all.filter((c) => !POPULAR.includes(c.code))];
  const shown = limit ? order.slice(0, limit) : order;
  // a stable patch of sky per currency, from its code
  const sky = (code: string, color: string) => skyStyle('0x' + code.split('').map((ch) => ch.charCodeAt(0).toString(16)).join('').padEnd(8, '7'), color);
  return (
    <div className="panel star-board" data-solid>
      <div className="kicker">No coins yet</div>
      <h3 className="card-title">{title}</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Every star is a currency a coin can live in. Tap one to launch the first coin priced in it.
      </p>
      <div className="star-grid">
        {shown.map((c) => (
          <Link key={c.code} to={`/launch?currency=${c.code}`} className="card coin-card star-tile" style={sky(c.code, c.color)} title={`Launch a coin priced in ${c.name}`}>
            <div className="cc-sky">
              <span className="cc-code">{c.code}</span>
              <div className="cc-orb">
                <Orb color={c.color} glyph={dropGlyph(c.code)} size={54} />
              </div>
              <span className="cc-ticker">{c.name}</span>
            </div>
          </Link>
        ))}
      </div>
      {limit && order.length > limit && (
        <Link to="/board" className="link" style={{ marginTop: 14, display: 'inline-flex' }}>
          All {order.length} currencies →
        </Link>
      )}
    </div>
  );
}
