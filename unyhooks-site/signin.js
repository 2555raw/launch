/* UnyHooks sign-in — connect MetaMask or Phantom and sign one plain-text
   message (EIP-4361 format). No transaction, no approval, no gas.

   Wallets are found through EIP-6963 announcements first, with the older
   window.ethereum / window.phantom.ethereum globals as a fallback.

   There is no backend yet, so the signature is not verified anywhere: the page
   only remembers the address for this tab. When the workspace exists, send the
   message and signature to the server, verify them there, and issue the
   session from the server's answer instead of trusting this page. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const WALLETS = {
    metamask: { name: 'MetaMask', rdns: 'io.metamask', install: 'https://metamask.io/download/' },
    phantom:  { name: 'Phantom',  rdns: 'app.phantom', install: 'https://phantom.com/download' }
  };

  /* ---------- finding providers ---------- */

  const announced = {};
  window.addEventListener('eip6963:announceProvider', (e) => {
    const { info, provider } = e.detail || {};
    if (info?.rdns && provider) announced[info.rdns] = provider;
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  const legacy = (key) => {
    if (key === 'phantom') return window.phantom?.ethereum || null;
    const eth = window.ethereum;
    if (!eth) return null;
    // Several extensions can share window.ethereum; pick the real MetaMask.
    const list = Array.isArray(eth.providers) ? eth.providers : [eth];
    return list.find((p) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet) || null;
  };

  const providerFor = (key) => announced[WALLETS[key].rdns] || legacy(key);

  /* ---------- the message ---------- */

  const toHex = (str) => '0x' + [...new TextEncoder().encode(str)].map((b) => b.toString(16).padStart(2, '0')).join('');

  const nonce = () => {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  };

  const siwe = (address, chainId) => [
    `${location.host || 'unyhooks'} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to UnyHooks. This request will not trigger a transaction or cost any gas.',
    '',
    `URI: ${location.origin}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce()}`,
    `Issued At: ${new Date().toISOString()}`
  ].join('\n');

  /* ---------- network ---------- */

  // Best effort: ask for Robinhood Chain when its id is configured. Refusing
  // the switch does not block sign-in, which works on any chain.
  const switchChain = async (provider) => {
    if (!NET.chainId) return;
    const hex = '0x' + Number(NET.chainId).toString(16);
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (err) {
      if (err?.code !== 4902 || !NET.rpcUrl) return;
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hex,
            chainName: NET.name || 'Robinhood Chain',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [NET.rpcUrl],
            blockExplorerUrls: NET.explorerUrl ? [NET.explorerUrl] : undefined
          }]
        });
      } catch (_) { /* declined */ }
    }
  };

  /* ---------- session ---------- */

  const KEY = 'unyhooks-session';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const write = (v) => { try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch (_) { /* storage blocked */ } };

  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  const signinView = $('#signin');
  const signedView = $('#signedin');
  const who = $('#who');
  const msg = $('#msg');

  const render = () => {
    const s = read();
    signinView.hidden = !!s;
    signedView.hidden = !s;
    if (s) {
      who.textContent = short(s.address);
      who.title = s.address;
    }
  };

  const say = (html, error = false) => {
    msg.innerHTML = html;
    msg.classList.toggle('is-error', error);
  };

  /* ---------- connect ---------- */

  let busy = false;

  const connect = async (key, btn) => {
    if (busy) return;
    const w = WALLETS[key];
    const provider = providerFor(key);
    if (!provider) {
      say(`${w.name} isn't installed in this browser. <a href="${w.install}" target="_blank" rel="noopener">Get ${w.name}</a>, then reload this page.`, true);
      return;
    }

    busy = true;
    const status = $('[data-status]', btn);
    $$('.ap-wallet').forEach((b) => { b.disabled = true; });
    btn.classList.add('is-busy');

    try {
      status.textContent = 'Connecting…';
      say('');
      const [address] = await provider.request({ method: 'eth_requestAccounts' });
      if (!address) throw new Error('No account was shared.');

      await switchChain(provider);
      const chainHex = await provider.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainHex, 16);

      status.textContent = 'Check your wallet…';
      const message = siwe(address, chainId);
      const signature = await provider.request({ method: 'personal_sign', params: [toHex(message), address] });

      write({ address, wallet: key, chainId, message, signature });
      render();
    } catch (err) {
      const rejected = err?.code === 4001 || /reject|denied|cancel/i.test(err?.message || '');
      say(rejected ? 'The request was cancelled in your wallet. Nothing was signed.' : `Couldn't sign in: ${err?.message || 'unknown error'}.`, !rejected);
    } finally {
      busy = false;
      status.textContent = 'Connect';
      btn.classList.remove('is-busy');
      $$('.ap-wallet').forEach((b) => { b.disabled = false; });
    }
  };

  $$('.ap-wallet').forEach((btn) => {
    btn.addEventListener('click', () => connect(btn.dataset.wallet, btn));
  });

  $('#signout')?.addEventListener('click', () => {
    write(null);
    say('');
    render();
  });

  render();
})();
