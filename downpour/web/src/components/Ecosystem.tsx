import type { CSSProperties } from 'react';
import { SITE } from '../config/site';

interface EcoItem {
  name: string;
  logo: string;
  tile?: string;
}

/** A row of logos: the chain the token lives on and the projects around it. */
export function Ecosystem() {
  const items: readonly EcoItem[] = SITE.ecosystem.items;
  if (!items.length) return null;
  return (
    <section className="section eco" aria-labelledby="eco-title">
      <div className="wrap">
        <div className="panel eco-panel">
          <div className="kicker" id="eco-title">
            {SITE.ecosystem.title}
          </div>
          <ul className="eco-row">
            {items.map((it) => (
              <li key={it.name} className="eco-item">
                <img
                  src={it.logo}
                  alt=""
                  width={26}
                  height={26}
                  loading="lazy"
                  className={it.tile ? 'eco-tile' : undefined}
                  style={it.tile ? ({ '--tile': it.tile } as CSSProperties) : undefined}
                />
                <span>{it.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
