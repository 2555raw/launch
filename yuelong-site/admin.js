/* Yuelong — owner page: deploy the contracts from a browser wallet and switch the site on.
   Each step's address is kept in this browser as it lands, so a rejected or failed step can be
   retried without paying for the earlier ones again. The server checks the result against the
   chain before it saves it. */
(() => {
  'use strict';
  const Y = window.YL;
  if (!Y || !document.getElementById('key-form')) return;
  const { $, esc } = Y;
  const W = Y.wallet;
  const el = (id) => document.getElementById(id);
  const ZERO = '0x0000000000000000000000000000000000000000';
  let key = '', cfg = null, busy = false;
  try { key = sessionStorage.getItem('yuelong-admin') || ''; } catch (_) { /* storage blocked */ }

  const DEFAULTS = { 945: { phantom: '2', threshold: '5', fee: '0' }, 964: { phantom: '25', threshold: '60', fee: '0.05' }, 31337: { phantom: '2', threshold: '5', fee: '0' } };
  const net = () => cfg.known.find((n) => n.chainId === +el('d-net').value);
  const progKey = () => `yuelong-deploy-${net().chainId}`;
  const loadProg = () => { try { return JSON.parse(localStorage.getItem(progKey()) || '{}'); } catch (_) { return {}; } };
  const saveProg = (p) => { try { localStorage.setItem(progKey(), JSON.stringify(p)); } catch (_) { /* storage blocked */ } };
  const say = (t, bad) => { el('d-msg').textContent = t; el('d-msg').classList.toggle('is-bad', !!bad); };

  const admin = (path, body) => Y.api('/api/admin/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-admin-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  function showCurrent(deps) {
    const rows = Object.values(deps || {});
    el('current').innerHTML = rows.length ? `<div class="yl-admin-deps">${rows.map((d) => {
      const n = cfg.known.find((k) => k.chainId === d.chainId) || { name: 'Chain ' + d.chainId };
      return `<div class="dn-kv"><div><span>${esc(n.name)}${d.hidden ? ' (hidden)' : ''}</span><b>factory ${esc(Y.short(d.factory))} · router ${esc(Y.short(d.router))}</b></div>
        <div><span>From block ${d.startBlock}</span><b><button class="dn-chip dn-chip-sm" data-hide="${d.chainId}" data-v="${d.hidden ? 0 : 1}">${d.hidden ? 'Show on site' : 'Hide from site'}</button> <button class="dn-chip dn-chip-sm" data-remove="${d.chainId}">Remove</button></b></div></div>`;
    }).join('')}</div>` : '<p class="dn-dim yl-admin-p">No deployment saved yet.</p>';
  }

  el('current').addEventListener('click', async (e) => {
    const h = e.target.closest('[data-hide]'), r = e.target.closest('[data-remove]');
    if (!h && !r) return;
    if (r && !confirm('Remove this deployment from the site? The contracts stay on chain; you can import it again.')) return;
    try {
      const j = await admin('deployment', h ? { chainId: +h.dataset.hide, hide: h.dataset.v === '1' } : { chainId: +r.dataset.remove, remove: true });
      showCurrent(j.deployments);
      Y.toast('Saved.');
    } catch (err) { Y.toast(esc(err.message), 'is-bad'); }
  });

  async function unlock() {
    const j = await admin('check');
    try { sessionStorage.setItem('yuelong-admin', key); } catch (_) { /* storage blocked */ }
    cfg = await Y.config();
    el('d-net').innerHTML = cfg.known.map((n) => `<option value="${n.chainId}">${esc(n.name)} · ${n.chainId}</option>`).join('');
    el('d-net').value = cfg.known.some((n) => n.chainId === 945) ? '945' : String(cfg.known[0].chainId);
    applyDefaults();
    showCurrent(j.deployments);
    el('deploy-box').hidden = false;
    el('import-box').hidden = false;
    renderSteps();
  }

  el('key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    key = el('key').value.trim();
    unlock().catch((err) => Y.toast(esc(err.message), 'is-bad'));
  });
  if (key) unlock().catch(() => {});

  function applyDefaults() {
    const d = DEFAULTS[net().chainId] || DEFAULTS[964];
    el('d-phantom').value = d.phantom; el('d-threshold').value = d.threshold; el('d-fee').value = d.fee;
    const unit = net().native;
    document.querySelectorAll('.yl-admin-form .dn-f > span').forEach((s) => { s.innerHTML = s.innerHTML.replace(/\((TAO|ETH)\)|\((TAO|ETH) raised\)/, (m) => m.replace(/TAO|ETH/, unit)); });
  }
  el('d-net').addEventListener('change', () => { applyDefaults(); renderSteps(); });

  const STEPS = [
    ['wnative', 'Deploy wrapped TAO (WTAO)'],
    ['factory', 'Deploy the factory'],
    ['graduator', 'Deploy the pool graduator'],
    ['setGraduator', 'Point the factory at the graduator'],
    ['router', 'Deploy the router'],
    ['setStock', 'Open native TAO pairs on the factory'],
  ];
  function renderSteps(active) {
    const p = loadProg();
    el('steps').innerHTML = STEPS.map(([k, label]) => {
      const done = p[k];
      return `<li class="${done ? 'is-done' : k === active ? 'is-on' : ''}"><span>${esc(label.replace('TAO', net().native))}</span><small>${done ? esc(typeof done === 'string' && done.startsWith('0x') && done.length === 42 ? Y.short(done) : 'done') : k === active ? 'waiting for your wallet…' : ''}</small></li>`;
    }).join('');
    renderButton();
  }
  function renderButton() {
    if (busy) return;
    const b = el('deploy'), p = loadProg();
    if (!W.state.account) b.textContent = 'Connect wallet';
    else if (W.state.chainId !== net().chainId) b.textContent = `Switch to ${net().name}`;
    else if (p.setStock) b.textContent = 'Save and switch the site on';
    else b.textContent = Object.keys(p).length > 1 ? 'Continue deploying' : 'Deploy';
  }
  W.onChange(renderButton);

  const num = (v, name) => { const s = String(v).trim(); if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`${name} must be a number.`); return s; };

  el('deploy').addEventListener('click', async () => {
    if (busy) return;
    say('');
    try {
      if (!W.state.account) { await W.connect(); return; }
      if (W.state.chainId !== net().chainId) { await W.ensureChain(net()); return; }
    } catch (err) { if (err.message !== 'closed') say(Y.cleanError(err), true); return; }
    busy = true;
    el('deploy').disabled = true;
    try {
      const [e, A, BC, signer] = await Promise.all([Y.ethers(), Y.abi(), Y.api('assets/chain/bytecode.json'), W.signer(net())]);
      const provider = signer.provider;
      const p = loadProg();
      const phantom = e.parseUnits(num(el('d-phantom').value, 'The virtual reserve'), 18);
      const threshold = e.parseUnits(num(el('d-threshold').value, 'The graduation target'), 18);
      const fee = e.parseUnits(num(el('d-fee').value, 'The launch fee'), 18);
      const treasury = el('d-treasury').value.trim() || W.state.account;
      if (!e.isAddress(treasury)) throw new Error('The treasury is not an address.');
      if (threshold <= 0n || phantom <= 0n) throw new Error('Reserve and target must be above 0.');
      // a saved address only counts if there is code at it on this chain
      for (const k of ['wnative', 'factory', 'graduator', 'router']) if (p[k] && (await provider.getCode(p[k])) === '0x') { delete p[k]; delete p.setGraduator; delete p.setStock; }
      if (p.startBlock === undefined) p.startBlock = await provider.getBlockNumber();
      saveProg(p);
      const deploy = async (k, name, args) => {
        renderSteps(k);
        const c = await new e.ContractFactory(A[name], BC[name], signer).deploy(...args);
        await c.waitForDeployment();
        p[k] = await c.getAddress(); saveProg(p); renderSteps();
      };
      const exist = el('d-wnative').value.trim();
      if (!p.wnative) {
        if (exist) { if (!e.isAddress(exist)) throw new Error('Wrapped TAO is not an address.'); p.wnative = e.getAddress(exist); saveProg(p); }
        else await deploy('wnative', 'WrappedNative', [`Wrapped ${net().native}`, `W${net().native}`]);
      }
      if (!p.factory) await deploy('factory', 'YuelongFactory', [treasury, ZERO, fee, p.wnative]);
      if (!p.graduator) await deploy('graduator', 'PoolGraduator', [p.factory]);
      const factory = new e.Contract(p.factory, A.YuelongFactory, signer);
      if (!p.setGraduator) { renderSteps('setGraduator'); await (await factory.setGraduator(p.graduator)).wait(); p.setGraduator = true; saveProg(p); }
      if (!p.router) await deploy('router', 'YuelongRouter', [p.wnative]);
      if (!p.setStock) { renderSteps('setStock'); await (await factory.setStock(p.wnative, phantom, threshold, true)).wait(); p.setStock = true; saveProg(p); }
      renderSteps();
      say('Contracts deployed. Saving…');
      const j = await admin('deployment', { chainId: net().chainId, factory: p.factory, router: p.router, wnative: p.wnative, graduator: p.graduator, treasury, startBlock: p.startBlock, pairs: [{ address: p.wnative }] });
      showCurrent(j.deployments);
      try { localStorage.removeItem(progKey()); } catch (_) { /* storage blocked */ }
      say(`${net().name} is live on the site. Reload the homepage to see it.`);
      Y.toast(`<b>Done.</b> ${esc(net().name)} is switched on. <a href="launch.html">Launch a coin</a>`, 'is-good', 0);
    } catch (err) {
      say(Y.cleanError(err), true);
    }
    busy = false;
    el('deploy').disabled = false;
    renderSteps();
  });

  el('import-go').addEventListener('click', async () => {
    let body;
    try { body = JSON.parse(el('import').value); } catch (_) { Y.toast('That is not valid JSON.', 'is-bad'); return; }
    try { const j = await admin('deployment', body); showCurrent(j.deployments); Y.toast('Saved. The site now shows it.', 'is-good'); }
    catch (err) { Y.toast(esc(err.message), 'is-bad'); }
  });
})();
