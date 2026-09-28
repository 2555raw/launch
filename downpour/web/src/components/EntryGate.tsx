import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SITE } from '../config/site';

const KEY = 'starmint:entered';
/** Where "I do not accept" goes. */
export const LEAVE_TO = 'https://www.ponsfamily.com/launchpad';

function entered() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** The notice on arrival: the risks, and a choice. Accepting is remembered in this
 *  browser; declining leaves for Pons. The page behind is inert until then. */
export function EntryGate() {
  const [open, setOpen] = useState(() => !entered());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const app = document.querySelector('.app');
    const root = document.documentElement;
    const overflow = root.style.overflow;
    app?.setAttribute('inert', '');
    root.style.overflow = 'hidden';
    box.current?.focus({ preventScroll: true });
    return () => {
      app?.removeAttribute('inert');
      root.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  const accept = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* no storage (a private window): it asks again next visit */
    }
    setOpen(false);
  };

  return createPortal(
    <div className="gate-back">
      <div ref={box} tabIndex={-1} className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-body">
        <img className="gate-mark" src="/brand/mark-black.svg" alt="" width={46} height={46} />
        <h2 id="gate-title">Before you enter</h2>
        <div id="gate-body">
          <p>
            {SITE.name} is a token launchpad on Robinhood Chain where every coin is paired with a currency. Coins launched here are experimental and can go to
            zero. Nothing on this site is financial advice. Trades on chain cannot be reversed.
          </p>
          <p>
            By entering you confirm that you are of legal age where you live, that you are not in a restricted jurisdiction, and that you accept these
            risks.
          </p>
        </div>
        <div className="gate-actions">
          <a className="gate-btn gate-no" href={LEAVE_TO}>
            I do not accept
          </a>
          <button type="button" className="gate-btn gate-yes" onClick={accept}>
            Accept and enter
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
