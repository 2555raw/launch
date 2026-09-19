/* PayLink, version 1.1. The live pages.
   Launch and Link build a real transaction against the Pons factory and hand
   it to the user's wallet. Proof and Fees query the chains directly from the
   browser. Every read is shown with what was asked and what came back, and
   nothing is written without the wallet showing it first. */

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PL = window.PL;
  if (!PL) return;
  const page = document.body.dataset.page;
  const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
  const exp = (kind, a, chain = PL.CHAIN) => `${chain.explorer}/${kind}/${a}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- step list ---------- */

  const Steps = (host, names) => {
    host.innerHTML = names.map((n, i) => `<div class="step" data-i="${i}"><span class="ic">${i + 1}</span><div><b>${esc(n)}</b><span></span></div></div>`).join('');
    const el = (i) => host.children[i];
    const set = (i, state, msg, html = false) => {
      const e = el(i); e.className = 'step is-' + state;
      e.querySelector('.ic').textContent = state === 'ok' ? '✓' : state === 'fail' ? '!' : state === 'warn' ? '!' : String(i + 1);
      const s = e.querySelector('span:last-child'); if (html) s.innerHTML = msg; else s.textContent = msg;
    };
    return { set, el };
  };

  /* ---------- shared: chain, factory, wallet ---------- */

  const checkChain = async (steps, i) => {
    steps.set(i, 'busy', 'Asking a public Robinhood Chain RPC for its chain id and the factory bytecode');
    const [cid, block, code] = await Promise.all([
      PL.rpc(PL.CHAIN.rpcs, 'eth_chainId'), PL.rpc(PL.CHAIN.rpcs, 'eth_blockNumber'), PL.rpc(PL.CHAIN.rpcs, 'eth_getCode', [PL.ADDR.factory, 'latest']),
    ]);
    if (parseInt(cid, 16) !== PL.CHAIN.id) throw new Error(`RPC answered chain id ${parseInt(cid, 16)}, expected ${PL.CHAIN.id}`);
    if (!code || code === '0x') throw new Error(`No contract at ${PL.ADDR.factory} on chain ${PL.CHAIN.id}. The factory address is wrong or the contract is gone.`);
    steps.set(i, 'ok', `Chain id ${PL.CHAIN.id} at block ${parseInt(block, 16).toLocaleString('en-US')}. The factory has ${(code.length - 2) / 2} bytes of code. <a href="${exp('address', PL.ADDR.factory)}" target="_blank" rel="noopener">Open on the explorer ↗</a>`, true);
  };
  const loadFactory = async (steps, i) => {
    steps.set(i, 'busy', 'Reading the factory ABI from Blockscout');
    const f = await PL.abiOf(PL.ADDR.factory);
    if (!f.verified || !f.abi.length) throw new Error('The factory contract is not verified on Blockscout, so its functions cannot be read. A launch cannot be built without the ABI.');
    steps.set(i, 'ok', `${f.name || 'Contract'} is verified${f.proxy ? ' (proxy, implementation ABI merged)' : ''}: ${PL.writable(f.abi).length} write functions, ${PL.readable(f.abi).length} read functions.`);
    return f;
  };
  const connectWallet = async (steps, i) => {
    if (!PL.wallet.has()) throw new Error('No wallet in this browser. Install MetaMask, Rabby or another injected wallet and reload.');
    steps.set(i, 'busy', 'Waiting for the wallet');
    const account = await PL.wallet.connect();
    let cid = await PL.wallet.chainId();
    if (cid !== PL.CHAIN.id) { steps.set(i, 'busy', `Wallet is on chain ${cid}. Asking it to switch to Robinhood Chain`); await PL.wallet.switchTo(); cid = await PL.wallet.chainId(); }
    if (cid !== PL.CHAIN.id) throw new Error(`The wallet stayed on chain ${cid}. Switch it to Robinhood Chain (4663) and try again.`);
    steps.set(i, 'ok', `${account} on Robinhood Chain`);
    return account;
  };
  const argsTable = (fn, known) => `<table class="args">${fn.inputs.map((inp, k) => {
    const v = known[k];
    return `<tr><td>${esc(inp.name || 'arg' + k)}<br>${esc(inp.type)}</td><td>${v === undefined ? `<input data-k="${k}" placeholder="${esc(inp.type)}">` : esc(String(v))}</td></tr>`;
  }).join('')}${fn.stateMutability === 'payable' ? `<tr><td>value<br>ETH</td><td><input data-k="value" value="0" placeholder="0"></td></tr>` : ''}</table>`;
  const collectArgs = (fn, known, host) => fn.inputs.map((inp, k) => {
    if (known[k] !== undefined) return known[k];
    const v = host.querySelector(`input[data-k="${k}"]`).value.trim();
    if (inp.type.endsWith(']')) return v ? v.split(',').map((x) => x.trim()) : [];
    if (inp.type === 'bool') return /^(true|1|yes)$/i.test(v);
    return v;
  });
  const valueOf = (fn, host) => { if (fn.stateMutability !== 'payable') return undefined; const v = Number(host.querySelector('input[data-k="value"]').value || 0); return '0x' + BigInt(Math.round(v * 1e18)).toString(16); };
  const sendTx = async (steps, i, from, data, value) => {
    steps.set(i, 'busy', 'The wallet is showing the transaction. Nothing is sent until you confirm it there.');
    const tx = { from, to: PL.ADDR.factory, data }; if (value && value !== '0x0') tx.value = value;
    const hash = await PL.wallet.send(tx);
    steps.set(i, 'ok', `Sent. <a href="${exp('tx', hash)}" target="_blank" rel="noopener">${hash} ↗</a>`, true);
    return hash;
  };
  const fail = (steps, i, e) => { steps.set(i, 'fail', e && e.message ? e.message : String(e)); };

  /* ---------- launch ---------- */

  if (page === 'launch') {
    const form = $('#launch-form'), host = $('#launch-steps'), btn = $('#launch-btn');
    const steps = Steps(host, ['Robinhood Chain and the Pons factory', 'The factory ABI', 'Your wallet', 'The transaction', 'Signed and sent']);
    let phase = 'idle', fn = null, factory = null, account = null, known = null;
    const busyStep = () => [0, 1, 2, 3, 4].find((k) => steps.el(k).classList.contains('is-busy'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pay = $('#pay-addr').value.trim();
      if (!PL.isAddress(pay)) { window.plToast && plToast('The PayPal address has to be an Ethereum address'); $('#pay-addr').focus(); return; }
      btn.disabled = true;
      try {
        if (phase === 'idle') {
          await checkChain(steps, 0);
          factory = factory || await loadFactory(steps, 1);
          fn = PL.findLaunch(factory.abi);
          if (!fn) throw new Error('No function in the factory takes a name and an address, so PayLink cannot tell which one launches a token. The write functions are: ' + PL.writable(factory.abi).map((f) => f.name).join(', '));
          account = await connectWallet(steps, 2);
          known = fn.inputs.map((inp) => { const r = PL.roleOf(inp); return r === 'name' ? $('#t-name').value.trim() : r === 'ticker' ? $('#t-ticker').value.trim().toUpperCase() : r === 'recipient' ? pay : r === 'pair' ? PL.ADDR.usdg : r === 'description' ? $('#t-desc').value.trim() : undefined; });
          const missing = known.filter((v) => v === undefined).length;
          steps.set(3, missing ? 'warn' : 'ok', `<b style="font-family:var(--mono);font-weight:500">${esc(fn.name)}(${fn.inputs.map((x) => x.type).join(', ')})</b>${missing ? `<span>${missing} argument${missing > 1 ? 's' : ''} could not be mapped from the form. Fill ${missing > 1 ? 'them' : 'it'} in below, then press the button again.</span>` : '<span>Every argument mapped from the form. Press the button again to sign.</span>'}${argsTable(fn, known)}<div class="tx-note">The fee recipient is the PayPal address you typed. The pair token is USDG. If this factory charges a launch fee in ETH, put it in the value field, or the transaction reverts.</div>`, true);
          phase = 'ready'; btn.textContent = 'Sign the launch';
          return;
        }
        const args = collectArgs(fn, known, steps.el(3));
        const data = PL.encodeCall(fn, args), value = valueOf(fn, steps.el(3));
        steps.set(3, 'ok', steps.el(3).querySelector('span:last-child').innerHTML, true);
        await sendTx(steps, 4, account, data, value);
        phase = 'sent'; btn.textContent = 'Sent';
      } catch (err) {
        fail(steps, busyStep() ?? (phase === 'idle' ? 0 : 3), err);
        if (phase === 'ready') btn.disabled = false;
      } finally { if (phase !== 'sent') btn.disabled = false; }
    });
  }

  /* ---------- link ---------- */

  if (page === 'link') {
    const form = $('#lookup'), host = $('#link-steps'), btn = $('#link-btn');
    let fn = null, factory = null, account = null, tokenAddr = null;
    const steps = Steps(host, ['The token', 'The factory ABI and the current fee recipient', 'Your wallet', 'Point the fees at PayLink']);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      tokenAddr = $('#token-addr').value.trim();
      if (!PL.isAddress(tokenAddr)) { window.plToast && plToast('That is not an Ethereum address'); return; }
      const pay = $('#link-pay') ? $('#link-pay').value.trim() : '';
      btn.disabled = true;
      try {
        steps.set(0, 'busy', 'Reading the token from Robinhood Chain');
        const code = await PL.rpc(PL.CHAIN.rpcs, 'eth_getCode', [tokenAddr, 'latest']);
        if (!code || code === '0x') throw new Error('There is no contract at that address on Robinhood Chain.');
        const t = await PL.token(PL.CHAIN.rpcs, tokenAddr);
        steps.set(0, 'ok', `${t.name} (${t.symbol}), ${t.decimals} decimals. <a href="${exp('token', tokenAddr)}" target="_blank" rel="noopener">Open on the explorer ↗</a>`, true);
        factory = factory || await loadFactory(steps, 1);
        const getter = PL.findGetRecipient(factory.abi);
        fn = PL.findSetRecipient(factory.abi);
        let current = null;
        if (getter) { try { const r = await PL.call(PL.CHAIN.rpcs, PL.ADDR.factory, getter, [tokenAddr]); current = r.find((x) => PL.isAddress(String(x))); } catch (_) { /* getter did not fit this token */ } }
        if (!fn) throw new Error('The factory has no write function that takes two addresses, so PayLink cannot find the one that moves a fee recipient. Write functions: ' + PL.writable(factory.abi).map((f) => f.name).join(', '));
        steps.set(1, 'ok', `${factory.name || 'Factory'} verified. Current fee recipient: ${current ? `<a href="${exp('address', current)}" target="_blank" rel="noopener">${current}</a>` : 'no readable getter'}. Will call <span style="font-family:var(--mono)">${esc(fn.name)}(${fn.inputs.map((x) => x.type).join(', ')})</span>.`, true);
        if (!PL.isAddress(pay)) { steps.set(2, 'warn', 'Type the PayPal PYUSD address the fees should reach, then press Look up again.'); btn.disabled = false; return; }
        account = await connectWallet(steps, 2);
        if (current && current.toLowerCase() !== account.toLowerCase()) steps.set(2, 'warn', `${account} is connected, but the factory says the current recipient is ${current}. The call will most likely revert unless that wallet signs it.`);
        const args = fn.inputs.map((inp) => { const r = PL.roleOf(inp); return r === 'recipient' ? pay : inp.type === 'address' ? tokenAddr : inp.type === 'string' ? '' : inp.type === 'bool' ? false : '0'; });
        const data = PL.encodeCall(fn, args);
        steps.set(3, 'busy', `Sending ${fn.name} with the token first and the PayPal address as the new recipient.`);
        await sendTx(steps, 3, account, data);
      } catch (err) {
        const i = [0, 1, 2, 3].find((k) => steps.el(k).classList.contains('is-busy')) ?? 0;
        fail(steps, i, err);
      } finally { btn.disabled = false; }
    });
  }

  /* ---------- proof ---------- */

  if (page === 'proof') {
    const rows = $$('.check[data-check]');
    const set = (key, state, msg, html = false) => { const r = rows.find((x) => x.dataset.check === key); if (!r) return; r.className = 'check is-' + state; const s = r.querySelector('.body span'); if (html) s.innerHTML = msg; else s.textContent = msg; };
    const summary = $('#proof-summary');
    const results = {};
    const done = (key, ok) => { results[key] = ok; const n = Object.values(results).filter(Boolean).length; summary.textContent = `${n} of ${rows.length} checks passing, ${Object.keys(results).length} of ${rows.length} answered.`; };
    const run = async (key, f) => { set(key, 'busy', 'Asking'); try { await f(); done(key, true); } catch (e) { set(key, 'fail', e.message || String(e)); done(key, false); } };
    rows.forEach((r) => set(r.dataset.check, 'busy', 'Asking'));
    const usdcMainnet = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    let usdg = null;
    run('chain', async () => {
      const [cid, block] = await Promise.all([PL.rpc(PL.CHAIN.rpcs, 'eth_chainId'), PL.rpc(PL.CHAIN.rpcs, 'eth_blockNumber')]);
      if (parseInt(cid, 16) !== PL.CHAIN.id) throw new Error(`chain id came back as ${parseInt(cid, 16)}`);
      set('chain', 'ok', `chain id ${PL.CHAIN.id}, at block ${parseInt(block, 16).toLocaleString('en-US')}`);
    }).then(() => Promise.all([
      run('usdg', async () => {
        usdg = await PL.token(PL.CHAIN.rpcs, PL.ADDR.usdg);
        set('usdg', 'ok', `${usdg.name} (${usdg.symbol}), ${usdg.decimals} decimals, live at ${short(PL.ADDR.usdg)} on Robinhood Chain`);
      }),
      run('factory', async () => {
        const code = await PL.rpc(PL.CHAIN.rpcs, 'eth_getCode', [PL.ADDR.factory, 'latest']);
        if (!code || code === '0x') throw new Error('no contract at the factory address');
        let name = 'unverified on Blockscout'; try { const f = await PL.abiOf(PL.ADDR.factory); if (f.verified) name = `${f.name}, verified, ${PL.writable(f.abi).length} write functions`; } catch (_) { /* explorer down */ }
        set('factory', 'ok', `${(code.length - 2) / 2} bytes of code, ${name}`);
      }),
      run('escrow', async () => {
        const code = await PL.rpc(PL.CHAIN.rpcs, 'eth_getCode', [PL.ADDR.escrow, 'latest']);
        if (!code || code === '0x') throw new Error('no contract at the escrow address');
        const [bal] = await PL.call(PL.CHAIN.rpcs, PL.ADDR.usdg, PL.ERC20.balanceOf, [PL.ADDR.escrow]);
        set('escrow', 'ok', `contract present, holding ${PL.fmt(bal, usdg ? usdg.decimals : 6)} USDG in creator fees right now`);
      }),
    ]));
    run('across', async () => {
      const amount = '100000000';
      const u = `https://app.across.to/api/suggested-fees?inputToken=${PL.ADDR.usdg}&outputToken=${usdcMainnet}&originChainId=${PL.CHAIN.id}&destinationChainId=1&amount=${amount}`;
      const r = await fetch(u); const j = await r.json();
      if (!r.ok || j.message || j.error) throw new Error('Across answered: ' + (j.message || j.error || r.status));
      const fee = Number(j.totalRelayFee ? j.totalRelayFee.total : j.relayFeeTotal || 0) / 1e6;
      set('across', 'ok', `100.00 USDG quotes ${(100 - fee).toFixed(2)} USDC, estimated fill ${j.estimatedFillTimeSec ? 'in about ' + j.estimatedFillTimeSec + 's' : 'time not given'}`);
    });
    run('curve', async () => {
      const getDy = { name: 'get_dy', inputs: [{ type: 'int128' }, { type: 'int128' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] };
      const coins = { name: 'coins', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] };
      const [[c0], [c1]] = await Promise.all([PL.call(PL.ETH.rpcs, PL.ADDR.curve, coins, [0]), PL.call(PL.ETH.rpcs, PL.ADDR.curve, coins, [1])]);
      const i = c0.toLowerCase() === usdcMainnet.toLowerCase() ? 0 : 1, j = 1 - i;
      const [dy] = await PL.call(PL.ETH.rpcs, PL.ADDR.curve, getDy, [i, j, '1000000000']);
      set('curve', 'ok', `1,000.00 USDC quotes ${PL.fmt(dy, 6)} PYUSD (coins: ${short(c0)}, ${short(c1)})`);
    });
    run('pyusd', async () => {
      const t = await PL.token(PL.ETH.rpcs, PL.ADDR.pyusd);
      set('pyusd', 'ok', `${t.name} (${t.symbol}), ${t.decimals} decimals, the token PayPal accepts from any wallet`);
    });
    // escrow inflows from the explorer
    const tbody = $('#escrow-rows'), note = $('#escrow-note');
    PL.tokenTransfers(PL.ADDR.escrow, PL.ADDR.usdg).then((j) => {
      const items = (j.items || []).filter((x) => x.to && x.to.hash.toLowerCase() === PL.ADDR.escrow.toLowerCase()).slice(0, 8);
      if (!items.length) { note.textContent = 'The explorer lists no USDG transfers into the escrow yet.'; return; }
      tbody.innerHTML = items.map((x) => `<tr><td><a href="${exp('tx', x.transaction_hash || x.tx_hash)}" target="_blank" rel="noopener">${short(x.transaction_hash || x.tx_hash)}</a></td><td class="dim c">${short(x.from.hash)}</td><td class="r">$${PL.fmt(x.total.value, Number(x.total.decimals || 6))}</td></tr>`).join('');
      note.textContent = `The last ${items.length} USDG transfers into the escrow, read from Blockscout.`;
    }).catch((e) => { note.textContent = 'Could not read the explorer: ' + (e.message || e); });
    $('#snapshot').textContent = 'Queried live from this browser at ' + new Date().toUTCString() + '.';
  }

  /* ---------- fees ---------- */

  if (page === 'fees') {
    const taken = $('#f-taken'), count = $('#f-count'), tbody = $('#fee-rows'), empty = $('#fee-empty');
    (async () => {
      try {
        const t = await PL.token(PL.CHAIN.rpcs, PL.ADDR.usdg);
        const [bal] = await PL.call(PL.CHAIN.rpcs, PL.ADDR.usdg, PL.ERC20.balanceOf, [PL.ADDR.platform]);
        $('#f-held').textContent = '$' + PL.fmt(bal, t.decimals);
        const j = await PL.tokenTransfers(PL.ADDR.platform, PL.ADDR.usdg);
        const items = (j.items || []).filter((x) => x.to && x.to.hash.toLowerCase() === PL.ADDR.platform.toLowerCase());
        const total = items.reduce((n, x) => n + Number(x.total.value) / 10 ** Number(x.total.decimals || t.decimals), 0);
        taken.textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        count.textContent = String(items.length);
        if (items.length) {
          empty.hidden = true; $('#fee-table').hidden = false;
          tbody.innerHTML = items.map((x) => `<tr><td><a href="${exp('tx', x.transaction_hash || x.tx_hash)}" target="_blank" rel="noopener">${short(x.transaction_hash || x.tx_hash)}</a></td><td class="dim c">${x.timestamp ? new Date(x.timestamp).toUTCString() : ''}</td><td class="r">$${PL.fmt(x.total.value, Number(x.total.decimals || t.decimals))}</td></tr>`).join('');
        }
        $('#fees-live').textContent = 'Read live from Robinhood Chain and Blockscout at ' + new Date().toUTCString() + '.';
      } catch (e) { $('#fees-live').textContent = 'Could not reach the chain from this browser: ' + (e.message || e); }
    })();
  }
})();
