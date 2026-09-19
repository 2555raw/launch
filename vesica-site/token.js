/* The contract address, in one place.

   Two slots on the site show it: the chip in the nav and the bar under the
   hero. Neither holds a copy. While `address` is null they look exactly as
   they do today — the label, and an empty slot — and the moment it is set they
   both fill in, become copyable and link into Blockscout.

   There are two ways to set it, and only one of them needs a deploy:

     1. Edit `address` below and push.
     2. Set TOKEN_CA in the host's environment. server.mjs substitutes it into
        this file as it is served, so the address can be published from the
        Railway dashboard without touching the repository. The variable is
        already provisioned on that service.

   Anything that is not twenty hex bytes is ignored and the site stays in its
   pre-launch state, so a half-typed address cannot put a broken link in front
   of anyone. */

const TOKEN = {
  address: null,          // '0x…' — 20 bytes, or null before launch
  chainId: 4663,          // Robinhood Chain; 46630 is its testnet
  symbol: 'VESICA',
};

const TOKEN_CHAINS = {
  4663:  { name: 'Robinhood Chain',         explorer: 'https://robinhoodchain.blockscout.com' },
  46630: { name: 'Robinhood Chain Testnet', explorer: 'https://explorer.testnet.chain.robinhood.com' },
};

/** The address, only if it is one. */
function tokenAddress() {
  const a = TOKEN.address;
  if (typeof a !== 'string') return null;
  const t = a.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
  if (/^0x0+$/.test(t)) return null;
  return t;
}

const tokenLive = () => !!tokenAddress();

function tokenExplorerUrl() {
  const a = tokenAddress(), c = TOKEN_CHAINS[TOKEN.chainId];
  return a && c ? `${c.explorer}/token/${a}` : null;
}

const shortCA = a => a.slice(0, 6) + '…' + a.slice(-4);

/* One writer for both slots. `full` gets the whole address, the nav gets it
   shortened, and neither is told anything the other is not. */
function paintCA(el, { full = false } = {}) {
  if (!el) return;
  const a = tokenAddress();

  if (!a) {
    el.classList.remove('is-live');
    el.innerHTML = full
      ? '<b>CA</b><span class="hm-ca-slot" aria-hidden="true"></span>'
      : '<b>CA</b>';
    el.title = 'Contract address — at launch';
    return;
  }

  const url = tokenExplorerUrl();
  const shown = full ? a : shortCA(a);
  el.classList.add('is-live');
  el.title = `${TOKEN.symbol} · ${TOKEN_CHAINS[TOKEN.chainId]?.name || 'chain ' + TOKEN.chainId}`;
  el.innerHTML =
    '<b>CA</b>' +
    `<code class="ca-addr">${shown}</code>` +
    `<button class="ca-copy" type="button" aria-label="Copy the contract address" data-ca="${a}">Copy</button>` +
    (url ? `<a class="ca-out" href="${url}" rel="noopener" target="_blank" aria-label="Open on Blockscout">` +
           `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"` +
           ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16L16 8M9 8h7v7"/></svg></a>` : '');
}

/** Fill every slot on the page. Safe to call more than once. */
function paintAllCA() {
  document.querySelectorAll('.nav-ca').forEach(el => paintCA(el));
  document.querySelectorAll('.hm-ca').forEach(el => paintCA(el, { full: true }));
}

/* Copy, delegated, so it keeps working after a repaint. */
document.addEventListener('click', e => {
  const btn = e.target.closest('.ca-copy');
  if (!btn) return;
  e.preventDefault();
  const text = btn.dataset.ca;
  const done = () => { const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1400); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (_) {}
    ta.remove();
  }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintAllCA);
else paintAllCA();
