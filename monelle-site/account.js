/* Monelle — opening an account.
   Four steps: connect an Ethereum wallet, pay for the plan, register a passkey,
   then land on the account with somewhere to put funds.

   Two modes, and the page is loud about which one it is in.

   LIVE  A real wallet of the visitor's choosing, a real ETH transfer on the
         chain named in config.js, and a real WebAuthn credential on the
         device. Needs config.treasury filled in, a wallet installed, and a
         page served over https on a real domain. No RPC endpoint to
         configure: the wallet supplies one.
   DEMO  The same four screens with nothing behind them. No wallet, no
         transfer, no credential. Every screen says so.

   The page picks DEMO on its own whenever LIVE cannot work, and the visitor can
   pick DEMO at any time. It never silently pretends a demo step was real. */

(() => {
  'use strict';

  const cfg = window.MONELLE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const STORE = 'monelle.account.v1';
  const WEI = 10n ** 18n;

  /* ---------------- finding the wallets ---------------- */

  /* Several wallets can be installed at once, and they all used to fight over
     window.ethereum: whichever loaded last won, so a MetaMask user could find
     themselves connecting Phantom. EIP-6963 settles it. The page asks, and each
     extension announces itself with a name, an icon and its own provider, which
     is what lets the picker below list them separately.

     The legacy paths stay as a fallback for wallets that have not adopted it. */

  const found = new Map();   // key -> { name, icon, provider }

  window.addEventListener('eip6963:announceProvider', (e) => {
    const info = e.detail?.info;
    const provider = e.detail?.provider;
    if (!info || !provider) return;
    found.set(info.rdns || info.name, { name: info.name, icon: info.uuid && info.icon, provider });
  });

  function askWallets() {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
  askWallets();

  // Anything that never answered the EIP-6963 call, picked up the old way.
  function legacyWallets() {
    const out = [];
    const eth = window.ethereum;
    const list = Array.isArray(eth?.providers) && eth.providers.length ? eth.providers : (eth ? [eth] : []);
    list.forEach((p) => {
      const name = p.isMetaMask ? 'MetaMask' : p.isPhantom ? 'Phantom' : 'Browser wallet';
      out.push({ name, icon: null, provider: p });
    });
    if (window.phantom?.ethereum) out.push({ name: 'Phantom', icon: null, provider: window.phantom.ethereum });
    return out;
  }

  function wallets() {
    askWallets();
    const byName = new Map();
    // EIP-6963 first: it carries the icon and the wallet's own name for itself
    for (const w of found.values()) byName.set(w.name, w);
    for (const w of legacyWallets()) if (!byName.has(w.name)) byName.set(w.name, w);
    return [...byName.values()];
  }

  // The two the page names outright, so a visitor without either is told where
  // to get them rather than left looking at an empty list.
  const KNOWN = [
    { name: 'MetaMask', url: 'https://metamask.io/download/' },
    { name: 'Phantom', url: 'https://phantom.app/download' }
  ];

  const anyWallet = () => wallets().length > 0;
  const provider = () => state.provider;

  const liveBlockers = () => {
    const out = [];
    if (!cfg.treasury) out.push('no treasury address is configured');
    if (!anyWallet()) out.push('no Ethereum wallet is installed in this browser');
    if (!window.isSecureContext) out.push('the page is not on a secure origin');
    if (!window.PublicKeyCredential) out.push('this browser has no passkey support');
    return out;
  };

  /* ---------------- state ---------------- */

  const state = {
    open: false,
    mode: 'demo',        // 'demo' | 'live'
    step: 'plan',        // plan | connect | pay | passkey | wallet
    plan: 'builder',
    cycle: 'monthly',
    wallet: null,        // the connected address
    provider: null,      // the EIP-1193 provider the visitor picked
    walletName: '',      // and what it calls itself
    signature: null,     // payment tx signature
    passkeyId: null,
    label: '',           // what the visitor named this wallet
    busy: false,
    error: '',
    balance: 0,          // ETH held by the account, read live or credited in demo
    loadingBalance: false,
    activity: []         // newest first
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
        plan: state.plan, cycle: state.cycle, wallet: state.wallet, label: state.label,
        walletName: state.walletName,
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
    const p = provider();
    if (!p) throw new Error('Pick a wallet first.');
    const accounts = await p.request({ method: 'eth_requestAccounts' });   // opens the wallet
    if (!accounts?.length) throw new Error('The wallet returned no account.');
    return accounts[0];
  }

  // A payment on the wrong chain goes to the right address on the wrong network,
  // so ask the wallet to move before sending anything.
  async function ensureChain() {
    const p = provider();
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

    const p = provider();
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

  // Live: ask the wallet. Demo: whatever the demo has credited so far.
  async function refreshBalance() {
    if (state.mode !== 'live') return state.balance;
    const p = provider();
    if (!p || !state.wallet) return state.balance;
    state.loadingBalance = true;
    try {
      const hex = await p.request({ method: 'eth_getBalance', params: [state.wallet, 'latest'] });
      state.balance = fromWei(hex);
    } catch (e) {
      state.error = 'The wallet would not report a balance just now.';
    } finally {
      state.loadingBalance = false;
    }
    return state.balance;
  }

  function logActivity(label, delta) {
    state.activity.unshift({ label, delta, at: new Date() });
    state.activity = state.activity.slice(0, 6);
  }

  // Testnet ETH is handed out for free, which is the only place "add funds"
  // can be a button rather than an address to send to.
  const FAUCETS = {
    '0xaa36a7': 'https://www.alchemy.com/faucets/ethereum-sepolia',
    '0x14a34': 'https://www.alchemy.com/faucets/base-sepolia'
  };
  const faucet = () => FAUCETS[(cfg.chainId || '').toLowerCase()] || null;

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
        rp: { name: 'Monelle', id: location.hostname },
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
    ['connect', 'Wallet'],
    ['pay', 'Payment'],
    ['passkey', 'Passkey'],
    ['wallet', 'Account']
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

    if (state.step === 'connect') {
      const list = state.mode === 'live' ? wallets() : [];
      const missing = state.mode === 'live'
        ? KNOWN.filter((k) => !list.some((w) => w.name === k.name))
        : [];

      el.body.innerHTML = `
        <p class="ts-lead">${state.mode === 'live'
          ? 'Pick the wallet you want to use. Monelle reads its address and nothing else.'
          : 'In live mode this lists the wallets you have installed. Here it hands you an address that belongs to nobody.'}</p>

        ${state.wallet ? `
          <div class="ts-field">
            <span>${state.walletName || 'Connected'}</span>
            <code>${short(state.wallet, 8, 8)}</code>
          </div>` : state.mode === 'live' ? `
          <div class="ts-picker">
            ${list.map((w, i) => `
              <button class="ts-pick" type="button" data-go="pick:${i}" ${state.busy ? 'disabled' : ''}>
                ${w.icon ? `<img src="${w.icon}" alt="" width="24" height="24">` : `<i>${w.name.slice(0, 1)}</i>`}
                <b>${w.name}</b>
                <span>Installed</span>
              </button>`).join('')}
            ${missing.map((k) => `
              <a class="ts-pick is-missing" href="${k.url}" target="_blank" rel="noopener noreferrer">
                <i>${k.name.slice(0, 1)}</i>
                <b>${k.name}</b>
                <span>Install</span>
              </a>`).join('')}
          </div>` : `
          <div class="ts-picker">
            <button class="ts-pick" type="button" data-go="connect" ${state.busy ? 'disabled' : ''}>
              <i>D</i><b>Demo wallet</b><span>No install</span>
            </button>
          </div>`}

        ${err()}
        <div class="ts-actions">
          ${state.wallet ? '<button class="ts-btn ts-btn-primary" type="button" data-go="connect">Continue</button>' : ''}
          <button class="ts-btn ts-btn-ghost" type="button" data-go="back">Back</button>
        </div>`;
      return;
    }

    if (state.step === 'pay') {
      el.body.innerHTML = `
        <p class="ts-lead">${usd === 0
          ? 'The Starter plan is free, so there is nothing to send.'
          : state.mode === 'live'
            ? `Your wallet will ask you to approve a transfer of <b>${eth} ETH</b> (${money(usd)}) to the Monelle treasury on ${cfg.chainName}.`
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
          ? 'Your device will ask for Face ID, Touch ID or a security key. The credential stays on the device; Monelle keeps only its id.'
          : 'In live mode your device would prompt for Face ID or Touch ID. Here no credential is created.'}</p>
        <label class="ts-label" for="acctLabel">Name this passkey</label>
        <input class="ts-input" id="acctLabel" type="text" value="Monelle account" autocomplete="off">
        ${err()}
        <div class="ts-actions">
          <button class="ts-btn ts-btn-primary" type="button" data-go="passkey" ${state.busy ? 'disabled' : ''}>
            ${state.busy ? 'Waiting for the device…' : 'Create passkey'}
          </button>
          <button class="ts-btn ts-btn-ghost" type="button" data-go="back">Back</button>
        </div>`;
      return;
    }

    // the wallet panel proper lives on the page; this just hands off to it
    el.body.innerHTML = `
      <div class="ts-done">
        <div class="ts-done-mark" aria-hidden="true">&check;</div>
        <h3>${state.label || 'Your wallet'} is open</h3>
        <p class="ts-lead">${state.mode === 'live'
          ? 'The passkey is registered on this device and the plan is paid. Your wallet is on the page now, with the balance and somewhere to add funds.'
          : 'That was the demo: nothing was paid and no passkey was created. The wallet is on the page now, where you can credit it and watch the balance move.'}</p>
      </div>
      ${err()}
      <div class="ts-actions">
        <button class="ts-btn ts-btn-primary" type="button" data-go="vault">Open my wallet</button>
        <button class="ts-btn ts-btn-ghost" type="button" data-go="reset">Start over</button>
      </div>`;
  }

  /* ---------------- the wallet on the page ---------------- */

  // One source of truth: the modal hands off and this section is the wallet.
  function renderVault() {
    const sec = $('#wallet');
    if (!sec || !state.wallet) return;

    const live = state.mode === 'live';
    const usd = state.balance * (cfg.ethReferenceUsd || 0);
    const fa = faucet();

    sec.hidden = false;
    $('#vaultName').textContent = state.label || 'Monelle wallet';
    $('#vaultSub').textContent = live
      ? `Opened on ${cfg.chainName}, paid on the ${PLAN_NAMES[state.plan]} plan.`
      : 'A demo wallet. Nothing was paid and no passkey was created.';

    const tag = $('#vaultTag');
    tag.textContent = live ? 'Live' : 'Demo';
    tag.className = `ts-tag ${live ? 'ts-tag-live' : 'ts-tag-demo'}`;

    $('#vaultBal').innerHTML = `${state.loadingBalance ? '…' : state.balance.toFixed(4)}<span>ETH</span>`;
    $('#vaultUsd').textContent =
      `≈ $${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })} at $${(cfg.ethReferenceUsd || 0).toLocaleString('en-US')}/ETH`;

    $('#vaultAddr').textContent = state.wallet;
    $('#vaultNet').textContent = cfg.chainName || 'unknown';
    $('#vaultWallet').textContent = state.walletName || (live ? 'Connected wallet' : 'Demo wallet');
    $('#vaultPlan').textContent = `${PLAN_NAMES[state.plan]} · ${state.cycle}`;
    $('#vaultKey').textContent = short(state.passkeyId, 8, 8) || 'none';

    const txRow = $('#vaultTxRow');
    const tx = state.signature && live ? explorerFor(state.signature) : null;
    txRow.hidden = !tx;
    if (tx) $('#vaultTx').href = tx;

    $('#vaultFunds').innerHTML = live
      ? `${fa ? `<a class="ts-btn ts-btn-primary" href="${fa}" target="_blank" rel="noopener noreferrer">Open the faucet</a>` : ''}
         <button class="ts-btn ts-btn-ghost" type="button" data-go="refresh">
           ${state.loadingBalance ? 'Reading…' : 'Refresh balance'}
         </button>`
      : `<button class="ts-btn ts-btn-primary" type="button" data-go="fund">Add 0.25 ETH</button>
         <button class="ts-btn ts-btn-ghost" type="button" data-go="spend" ${state.balance < 0.1 ? 'disabled' : ''}>Spend 0.1 ETH</button>`;

    $('#vaultFine').innerHTML = live
      ? `Nothing here can create ETH. Send it to the address beside this from an exchange
         or another wallet, then refresh. Check the first and last characters first.`
      : `<b>Do not send real funds to this address.</b> It was made up for the demo and
         nobody holds its key.`;

    const act = $('#vaultActivity');
    act.hidden = state.activity.length === 0;
    $('#vaultActList').innerHTML = state.activity.map((a) => `
      <div class="ts-act">
        <span>${a.label}</span>
        <code class="${a.delta >= 0 ? 'is-in' : 'is-out'}">
          ${a.delta >= 0 ? '+' : '−'}${Math.abs(a.delta).toFixed(4)} ETH
        </code>
        <time>${a.at.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time>
      </div>`).join('');

    showBadge();
  }

  function goToVault() {
    renderVault();
    close();
    const sec = $('#wallet');
    if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
  }

  /* ---------------- flow ---------------- */

  async function act(what) {
    state.error = '';

    if (what === 'start-demo' || what === 'start-live') {
      state.mode = what === 'start-live' ? 'live' : 'demo';
      state.step = 'connect';
      return render();
    }

    if (what === 'back') {
      const order = ['plan', 'connect', 'pay', 'passkey', 'wallet'];
      state.step = order[Math.max(0, order.indexOf(state.step) - 1)];
      return render();
    }

    if (what.startsWith('pick:')) {
      const chosen = wallets()[Number(what.slice(5))];
      if (!chosen) { state.error = 'That wallet is no longer available. Reload and try again.'; return render(); }
      state.provider = chosen.provider;
      state.walletName = chosen.name;
      return act('connect');
    }

    if (what === 'connect') {
      if (state.wallet) { state.step = 'pay'; return render(); }
      state.busy = true; render();
      try {
        if (state.mode === 'live') {
          state.wallet = await connectWallet();
        } else {
          state.walletName = 'Demo wallet';
          state.wallet = (await wait(700), hex(40));
        }
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
        const spent = usdToEth(priceUsd());
        if (spent > 0) logActivity(`${PLAN_NAMES[state.plan]} plan`, -spent);
        state.step = 'passkey';
      } catch (e) {
        state.error = e?.message || 'The payment did not go through.';
      } finally {
        state.busy = false; render();
      }
      return;
    }

    if (what === 'passkey') {
      const label = ($('#acctLabel')?.value || '').trim() || 'Monelle account';
      state.label = label;
      state.busy = true; render();
      try {
        state.passkeyId = state.mode === 'live'
          ? await createPasskey(label)
          : (await wait(900), hex(32));
        state.step = 'wallet';
        await refreshBalance();
        renderVault();
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

    if (what === 'vault') return goToVault();

    if (what === 'refresh') {
      state.loadingBalance = true; renderVault(); render();
      await refreshBalance();
      renderVault();
      return render();
    }

    if (what === 'fund') {
      state.balance += 0.25;
      logActivity('Demo deposit', 0.25);
      renderVault();
      return render();
    }

    if (what === 'spend') {
      if (state.balance < 0.1) return;
      state.balance -= 0.1;
      logActivity('Demo spend', -0.1);
      renderVault();
      return render();
    }

    if (what === 'copy') {
      const addr = state.wallet || '';
      try {
        await navigator.clipboard.writeText(addr);
        $$('[data-go="copy"]').forEach((b) => {
          b.textContent = 'Copied';
          setTimeout(() => { b.textContent = 'Copy'; }, 1400);
        });
      } catch {
        state.error = 'The browser blocked the clipboard. Select the address and copy it by hand.';
        render();
      }
      return;
    }

    if (what === 'reset') {
      Object.assign(state, {
        step: 'plan', wallet: null, provider: null, walletName: '',
        signature: null, passkeyId: null, label: '', error: '',
        balance: 0, activity: []
      });
      forget();
      const sec = $('#wallet');
      if (sec) sec.hidden = true;
      const badge = $('#acctBadge');
      if (badge) badge.hidden = true;
      return render();
    }

    if (what === 'close') close();
  }

  // `mode` lets a visitor land straight in the demo without first being asked
  // to pick between demo and live: the demo buttons on the page skip that.
  function showBadge() {
    const badge = $('#acctBadge');
    if (!badge) return;
    badge.hidden = false;
    badge.textContent = `Wallet · ${short(state.wallet, 4, 4)}`;
  }

  // The wallet lives on the page now, so reopening one means painting that
  // section and going to it, not raising the modal again.
  function openWallet() {
    if (!state.wallet) return;
    goToVault();
  }

  function open(plan, cycle, mode) {
    if (!el.root) build();
    state.plan = plan || state.plan;
    state.cycle = cycle || state.cycle;
    // Demo is always the starting point; live is only ever reached by choosing
    // it on the plan screen, which is the screen this skips.
    state.mode = 'demo';
    state.step = mode === 'demo' ? 'connect' : 'plan';
    state.wallet = null;
    state.provider = null;
    state.walletName = '';
    state.signature = null;
    state.passkeyId = null;
    state.error = '';
    state.label = '';
    state.balance = 0;
    state.activity = [];
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
    const back = e.target.closest('[data-wallet]');
    if (back && state.wallet) { e.preventDefault(); openWallet(); return; }

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
    if (go && (state.open || go.closest('#wallet'))) { e.preventDefault(); act(go.dataset.go); }
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

  window.MonelleAccount = { open, openWallet, renderVault, close, state };
})();
