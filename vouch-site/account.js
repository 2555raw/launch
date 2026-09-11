/* Vouch — opening an account.
   Four steps: connect an Ethereum wallet, pay for the plan, register a passkey,
   then land on the account with somewhere to put funds.

   Two modes, and the page is loud about which one it is in.

   LIVE  Real Phantom, a real ETH transfer on the chain named in config.js, and
         a real WebAuthn credential on the device. Needs config.treasury filled
         in, Phantom installed, and a page served over https on a real domain.
         No RPC endpoint to configure: the wallet supplies one.
   DEMO  The same four screens with nothing behind them. No wallet, no
         transfer, no credential. Every screen says so.

   The page picks DEMO on its own whenever LIVE cannot work, and the visitor can
   pick DEMO at any time. It never silently pretends a demo step was real. */

(() => {
  'use strict';

  const cfg = window.VOUCH_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const STORE = 'vouch.account.v1';
  const WEI = 10n ** 18n;

  /* ---------------- capability detection ---------------- */

  // Phantom speaks EIP-1193 on its ethereum provider, so no library is needed:
  // the wallet carries the RPC connection and we only send it JSON-RPC calls.
  const phantom = () =>
    window.phantom?.ethereum ? window.phantom.ethereum
      : window.ethereum?.isPhantom ? window.ethereum
        : window.ethereum || null;

  const liveBlockers = () => {
    const out = [];
    if (!cfg.treasury) out.push('no treasury address is configured');
    if (!phantom()) out.push('no Ethereum wallet is installed in this browser');
    if (!window.isSecureContext) out.push('the page is not on a secure origin');
    if (!window.PublicKeyCredential) out.push('this browser has no passkey support');
    return out;
  };

  /* ---------------- state ---------------- */

  const state = {
    open: false,
    mode: 'demo',        // 'demo' | 'live'
    step: 'plan',        // plan | wallet | pay | passkey | done
    plan: 'builder',
    cycle: 'monthly',
    wallet: null,        // base58 address
    signature: null,     // payment tx signature
    passkeyId: null,
    busy: false,
    error: ''
  };

  const PLAN_NAMES = { starter: 'Starter', builder: 'Builder', studio: 'Studio' };

  // Plans are priced in dollars; the chain is paid in ETH. One conversion,
  // used by both the cards and the transaction, so they cannot disagree.
  const priceUsd = (plan = state.plan, cycle = state.cycle) =>
    (cfg.prices?.[plan]?.[cycle]) ?? 0;

  const usdToEth = (usd) => usd / (cfg.ethReferenceUsd || 1);

  // Four decimals is the most a plan needs and keeps the figure readable.
  const ethLabel = (usd) => usdToEth(usd).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

  const money = (usd) => '$' + usd.toLocaleString('en-US');

  /* ---------------- persistence ---------------- */

  function save() {
    if (state.mode !== 'live') return;          // demo runs leave no trace
    try {
      localStorage.setItem(STORE, JSON.stringify({
        plan: state.plan, cycle: state.cycle, wallet: state.wallet,
        signature: state.signature, passkeyId: state.passkeyId,
        chainId: cfg.chainId, opened: Date.now()
      }));
    } catch { /* private window, nothing to do */ }
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
  }

  function forget() {
    try { localStorage.removeItem(STORE); } catch { /* nothing to do */ }
  }

  /* ---------------- ethereum ---------------- */

  // Decimal ETH to a wei hex string, through BigInt so 0.35 stays 0.35.
  function toWeiHex(eth) {
    const [whole, frac = ''] = String(eth).split('.');
    const padded = (frac + '0'.repeat(18)).slice(0, 18);
    return '0x' + (BigInt(whole || '0') * WEI + BigInt(padded || '0')).toString(16);
  }

  const fromWei = (hex) => Number(BigInt(hex)) / 1e18;

  async function connectWallet() {
    const p = phantom();
    if (!p) throw new Error('No Ethereum wallet was found. Install Phantom, then reload this page.');
    const accounts = await p.request({ method: 'eth_requestAccounts' });   // opens the wallet
    if (!accounts?.length) throw new Error('The wallet returned no account.');
    return accounts[0];
  }

  // A payment on the wrong chain goes to the right address on the wrong network,
  // so ask the wallet to move before sending anything.
  async function ensureChain() {
    const p = phantom();
    const current = await p.request({ method: 'eth_chainId' });
    if (current?.toLowerCase() === cfg.chainId?.toLowerCase()) return;
    try {
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: cfg.chainId }]
      });
    } catch (e) {
      throw new Error(`This wallet is on another network. Switch it to ${cfg.chainName} and try again.`);
    }
  }

  async function payLive() {
    const usd = priceUsd();
    if (usd <= 0) return null;                           // free plan, nothing to send
    const eth = usdToEth(usd);

    const p = phantom();
    await ensureChain();

    const balanceHex = await p.request({ method: 'eth_getBalance', params: [state.wallet, 'latest'] });
    const balance = fromWei(balanceHex);
    if (balance < eth) {
      throw new Error(
        `That wallet holds ${balance.toFixed(4)} ETH and the plan costs ${ethLabel(usd)} ETH. Top it up and try again.`
      );
    }

    return await p.request({
      method: 'eth_sendTransaction',
      params: [{ from: state.wallet, to: cfg.treasury, value: toWeiHex(eth.toFixed(18)) }]
    });
  }

  const EXPLORERS = {
    '0x1': 'https://etherscan.io',
    '0xaa36a7': 'https://sepolia.etherscan.io',
    '0x2105': 'https://basescan.org'
  };
  const explorerFor = (hash) => {
    const base = EXPLORERS[(cfg.chainId || '').toLowerCase()];
    return base ? `${base}/tx/${hash}` : null;
  };

  /* ---------------- passkey ---------------- */

  async function createPasskey(label) {
    if (!window.PublicKeyCredential) throw new Error('This browser cannot create passkeys.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Vouch', id: location.hostname },
        user: { id: userId, name: label, displayName: label },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        attestation: 'none',
        timeout: 60000
      }
    });
    if (!cred) throw new Error('No credential came back from the device.');
    return cred.id;
  }

  /* ---------------- demo stand-ins ---------------- */

  const hex = (n) =>
    '0x' + Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const short = (v, h = 6, t = 6) => (v && v.length > h + t + 1 ? `${v.slice(0, h)}…${v.slice(-t)}` : v || '');

  /* ---------------- the modal ---------------- */

  const el = {};

  function build() {
    const root = document.createElement('div');
    root.className = 'ts-modal';
    root.id = 'account';
    root.hidden = true;
    root.innerHTML = `
      <div class="ts-modal-scrim" data-close></div>
      <div class="ts-modal-card" role="dialog" aria-modal="true" aria-labelledby="acctTitle">
        <header class="ts-modal-head">
          <div>
            <p class="ts-modal-eyebrow" id="acctMode"></p>
            <h2 class="ts-modal-title" id="acctTitle">Open an account</h2>
          </div>
          <button class="ts-close" type="button" data-close aria-label="Close">&times;</button>
        </header>
        <div class="ts-rail" id="acctRail"></div>
        <div class="ts-modal-body" id="acctBody"></div>
      </div>`;
    document.body.appendChild(root);
    el.root = root;
    el.body = $('#acctBody', root);
    el.rail = $('#acctRail', root);
    el.mode = $('#acctMode', root);

    root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) close(); });
  }

  const STEPS = [
    ['wallet', 'Wallet'],
    ['pay', 'Payment'],
    ['passkey', 'Passkey'],
    ['done', 'Account']
  ];

  function renderRail() {
    const at = STEPS.findIndex(([k]) => k === state.step);
    el.rail.innerHTML = STEPS.map(([k, label], i) => `
      <span class="ts-rail-step ${i < at ? 'is-past' : ''} ${i === at ? 'is-now' : ''}">
        <i>${i < at ? '&check;' : i + 1}</i>${label}
      </span>`).join('');
  }

  function renderMode() {
    const live = state.mode === 'live';
    el.mode.innerHTML = live
      ? `<span class="ts-tag ts-tag-live">Live</span> ${cfg.chainName} · real transfer`
      : `<span class="ts-tag ts-tag-demo">Demo</span> nothing here is real`;
  }

  function err() {
    return state.error ? `<p class="ts-error" role="alert">${state.error}</p>` : '';
  }

  function render() {
    renderRail();
    renderMode();
    const usd = priceUsd();
    const eth = ethLabel(usd);
    const blockers = liveBlockers();

    if (state.step === 'plan') {
      el.body.innerHTML = `
        <p class="ts-lead">You are opening the <b>${PLAN_NAMES[state.plan]}</b> plan,
           billed ${state.cycle === 'yearly' ? 'yearly' : 'monthly'}.</p>
        <div class="ts-amount">
          <strong>${usd === 0 ? 'Free' : money(usd)}</strong>
          ${usd === 0 ? '' : `<span>${eth} ETH at $${cfg.ethReferenceUsd.toLocaleString('en-US')}/ETH</span>`}
        </div>
        ${blockers.length ? `
          <div class="ts-notice">
            <p><b>Live mode is off here.</b> ${blockers.join(', ')}.</p>
            <p>The demo walks the same four screens so you can see the flow.
               It touches no wallet and moves no funds.</p>
          </div>` : `
          <div class="ts-notice ts-notice-live">
            <p><b>Live mode is available.</b> The next screens use your real
               wallet and send ${eth} ETH on ${cfg.chainName}.</p>
          </div>`}
        ${err()}
        <div class="ts-actions">
          <button class="ts-btn ts-btn-primary" type="button" data-go="start-demo">Run the demo</button>
          ${blockers.length ? '' : '<button class="ts-btn ts-btn-ghost" type="button" data-go="start-live">Use my wallet</button>'}
        </div>`;
      return;
    }

    if (state.step === 'wallet') {
      el.body.innerHTML = `
        <p class="ts-lead">${state.mode === 'live'
          ? 'Approve the connection in Phantom. Vouch reads your address and nothing else.'
          : 'In live mode this opens Phantom. Here it hands you an address that belongs to nobody.'}</p>
        ${state.wallet ? `
          <div class="ts-field"><span>Connected</span><code>${short(state.wallet, 8, 8)}</code></div>` : ''}
        ${err()}
        <div class="ts-actions">
          <button class="ts-btn ts-btn-primary" type="button" data-go="connect" ${state.busy ? 'disabled' : ''}>
            ${state.busy ? 'Waiting for the wallet…' : state.wallet ? 'Continue' : 'Connect wallet'}
          </button>
          <button class="ts-btn ts-btn-ghost" type="button" data-go="back">Back</button>
        </div>`;
      return;
    }

    if (state.step === 'pay') {
      el.body.innerHTML = `
        <p class="ts-lead">${usd === 0
          ? 'The Starter plan is free, so there is nothing to send.'
          : state.mode === 'live'
            ? `Your wallet will ask you to approve a transfer of <b>${eth} ETH</b> (${money(usd)}) to the Vouch treasury on ${cfg.chainName}.`
            : `In live mode your wallet would ask you to approve <b>${eth} ETH</b> (${money(usd)}). Here nothing leaves anything.`}</p>
        <div class="ts-field"><span>From</span><code>${short(state.wallet, 8, 8)}</code></div>
        <div class="ts-field"><span>Amount</span><code>${usd === 0 ? '0' : eth + ' ETH · ' + money(usd)}</code></div>
        ${state.signature ? `<div class="ts-field"><span>Signature</span><code>${short(state.signature, 8, 8)}</code></div>` : ''}
        ${err()}
        <div class="ts-actions">
          <button class="ts-btn ts-btn-primary" type="button" data-go="pay" ${state.busy ? 'disabled' : ''}>
            ${state.busy ? 'Waiting for confirmation…' : state.signature ? 'Continue' : usd === 0 ? 'Continue' : 'Approve payment'}
          </button>
          <button class="ts-btn ts-btn-ghost" type="button" data-go="back">Back</button>
        </div>`;
      return;
    }

    if (state.step === 'passkey') {
      el.body.innerHTML = `
        <p class="ts-lead">${state.mode === 'live'
          ? 'Your device will ask for Face ID, Touch ID or a security key. The credential stays on the device; Vouch keeps only its id.'
          : 'In live mode your device would prompt for Face ID or Touch ID. Here no credential is created.'}</p>
        <label class="ts-label" for="acctLabel">Name this passkey</label>
        <input class="ts-input" id="acctLabel" type="text" value="Vouch account" autocomplete="off">
        ${err()}
        <div class="ts-actions">
          <button class="ts-btn ts-btn-primary" type="button" data-go="passkey" ${state.busy ? 'disabled' : ''}>
            ${state.busy ? 'Waiting for the device…' : 'Create passkey'}
          </button>
          <button class="ts-btn ts-btn-ghost" type="button" data-go="back">Back</button>
        </div>`;
      return;
    }

    // done
    const explorer = state.signature && state.mode === 'live'
      ? explorerFor(state.signature)
      : null;

    el.body.innerHTML = `
      <div class="ts-done">
        <div class="ts-done-mark" aria-hidden="true">&check;</div>
        <h3>${PLAN_NAMES[state.plan]} account open</h3>
        <p class="ts-lead">${state.mode === 'live'
          ? 'Your passkey is registered on this device and the plan is paid.'
          : 'That was the demo. No account exists, no passkey was created and nothing was paid.'}</p>
      </div>
      <div class="ts-field"><span>Plan</span><code>${PLAN_NAMES[state.plan]} · ${state.cycle}</code></div>
      <div class="ts-field"><span>Wallet</span><code>${short(state.wallet, 8, 8)}</code></div>
      <div class="ts-field"><span>Passkey</span><code>${short(state.passkeyId, 8, 8) || 'none'}</code></div>
      ${explorer ? `<div class="ts-field"><span>Payment</span><a class="ts-link" href="${explorer}" target="_blank" rel="noopener noreferrer">View on the explorer</a></div>` : ''}

      <div class="ts-deposit">
        <h4>Adding funds</h4>
        <p>Your balance lives in the wallet you connected, and the passkey is what
           authorises spending from this site. So deposits go to that same
           address, from an exchange or another wallet.</p>
        <div class="ts-field ts-field-wide">
          <span>Deposit address</span>
          <code id="depAddr">${state.wallet || ''}</code>
          <button class="ts-copy" type="button" data-go="copy">Copy</button>
        </div>
        ${state.mode === 'live'
          ? `<p class="ts-fineprint">This is the address Phantom gave us. Check the first and last characters against Phantom before you send anything.</p>`
          : `<p class="ts-fineprint"><b>Do not send funds to this address.</b> It was made up for the demo and nobody holds its key.</p>`}
      </div>
      ${err()}
      <div class="ts-actions">
        <button class="ts-btn ts-btn-primary" type="button" data-go="close">Done</button>
        <button class="ts-btn ts-btn-ghost" type="button" data-go="reset">Start over</button>
      </div>`;
  }

  /* ---------------- flow ---------------- */

  async function act(what) {
    state.error = '';

    if (what === 'start-demo' || what === 'start-live') {
      state.mode = what === 'start-live' ? 'live' : 'demo';
      state.step = 'wallet';
      return render();
    }

    if (what === 'back') {
      const order = ['plan', 'wallet', 'pay', 'passkey', 'done'];
      state.step = order[Math.max(0, order.indexOf(state.step) - 1)];
      return render();
    }

    if (what === 'connect') {
      if (state.wallet) { state.step = 'pay'; return render(); }
      state.busy = true; render();
      try {
        state.wallet = state.mode === 'live'
          ? await connectWallet()
          : (await wait(700), hex(40));
        state.step = 'pay';
      } catch (e) {
        state.error = e?.message || 'The wallet refused the connection.';
      } finally {
        state.busy = false; render();
      }
      return;
    }

    if (what === 'pay') {
      if (state.signature || priceUsd() === 0) { state.step = 'passkey'; return render(); }
      state.busy = true; render();
      try {
        state.signature = state.mode === 'live'
          ? await payLive()
          : (await wait(1200), hex(64));
        state.step = 'passkey';
      } catch (e) {
        state.error = e?.message || 'The payment did not go through.';
      } finally {
        state.busy = false; render();
      }
      return;
    }

    if (what === 'passkey') {
      const label = ($('#acctLabel')?.value || '').trim() || 'Vouch account';
      state.busy = true; render();
      try {
        state.passkeyId = state.mode === 'live'
          ? await createPasskey(label)
          : (await wait(900), hex(32));
        state.step = 'done';
        save();
      } catch (e) {
        state.error = e?.name === 'NotAllowedError'
          ? 'The device cancelled the prompt. Try again when you are ready.'
          : (e?.message || 'The passkey could not be created here.');
      } finally {
        state.busy = false; render();
      }
      return;
    }

    if (what === 'copy') {
      const addr = state.wallet || '';
      try {
        await navigator.clipboard.writeText(addr);
        const b = $('[data-go="copy"]');
        if (b) { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); }
      } catch {
        state.error = 'The browser blocked the clipboard. Select the address and copy it by hand.';
        render();
      }
      return;
    }

    if (what === 'reset') {
      Object.assign(state, { step: 'plan', wallet: null, signature: null, passkeyId: null, error: '' });
      forget();
      return render();
    }

    if (what === 'close') close();
  }

  // `mode` lets a visitor land straight in the demo without first being asked
  // to pick between demo and live: the demo buttons on the page skip that.
  function open(plan, cycle, mode) {
    if (!el.root) build();
    state.plan = plan || state.plan;
    state.cycle = cycle || state.cycle;
    // Demo is always the starting point; live is only ever reached by choosing
    // it on the plan screen, which is the screen this skips.
    state.mode = 'demo';
    state.step = mode === 'demo' ? 'wallet' : 'plan';
    state.wallet = null;
    state.signature = null;
    state.passkeyId = null;
    state.error = '';
    state.open = true;
    el.root.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
  }

  function close() {
    state.open = false;
    if (el.root) el.root.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------- wiring ---------------- */

  document.addEventListener('click', (e) => {
    const demo = e.target.closest('[data-demo]');
    if (demo) {
      e.preventDefault();
      open(demo.dataset.demo || 'builder', document.body.dataset.cycle || 'monthly', 'demo');
      return;
    }
    const starter = e.target.closest('[data-plan]');
    if (starter) {
      e.preventDefault();
      open(starter.dataset.plan, document.body.dataset.cycle || 'monthly');
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go && state.open) { e.preventDefault(); act(go.dataset.go); }
  });

  // A returning visitor who opened a live account sees it on the account button.
  const saved = loadSaved();
  if (saved?.wallet) {
    document.addEventListener('DOMContentLoaded', () => {
      const badge = $('#acctBadge');
      if (badge) {
        badge.hidden = false;
        badge.textContent = `${PLAN_NAMES[saved.plan] || 'Account'} · ${short(saved.wallet, 4, 4)}`;
      }
    });
  }

  window.VouchAccount = { open, close, state };
})();
