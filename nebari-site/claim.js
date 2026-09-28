// Nebari — the claim page: your balance and claimable fees on every launched token.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let rows = [];

  async function load() {
    const list = $('list');
    if (!Nebari.configured()) { $('not-configured').hidden = false; return; }
    const me = Nebari.wallet.account;
    if (!me) { list.innerHTML = '<p style="color:var(--muted)">Connect your wallet to see your tokens.</p>'; return; }
    list.innerHTML = '<p style="color:var(--muted)">Reading the chain…</p>';
    try {
      const factory = Nebari.factory();
      const n = Number(await factory.tokenCount());
      if (!n) { list.innerHTML = '<p style="color:var(--muted)">No tokens have been launched yet.</p>'; return; }
      const launches = Array.from(await factory.getLaunches(0, n)).reverse();
      rows = await Promise.all(launches.map(async (L) => {
        const t = Nebari.token(L.token);
        const [symbol, name, bal, claimable, pair] = await Promise.all([t.symbol(), t.name(), t.balanceOf(me), t.claimable(me), Nebari.resolveAsset(L.pair)]);
        return { L, symbol, name, bal, claimable, pair, mine: L.creator.toLowerCase() === me.toLowerCase() };
      }));
      const relevant = rows.filter((r) => r.bal > 0n || r.claimable > 0n || r.mine);
      if (!relevant.length) { list.innerHTML = '<p style="color:var(--muted)">You do not hold any Nebari token yet. <a class="link-pink" href="explore.html">Browse the garden</a>.</p>'; return; }
      list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:var(--muted);font-size:12px"><th style="padding:8px 6px">Token</th><th style="padding:8px 6px">Rooted to</th><th style="padding:8px 6px">Your balance</th><th style="padding:8px 6px">Claimable</th><th style="padding:8px 6px"></th></tr></thead>
        <tbody>${relevant.map((r, i) => `<tr style="border-top:1px solid var(--line)">
          <td style="padding:12px 6px"><a class="link-underline" href="token.html?token=${r.L.token}">${esc(r.name)}</a> <span class="pill pill-pink" style="padding:3px 8px;font-size:11px">${esc(r.symbol)}</span>${r.mine ? ' <span class="hint">· you created it</span>' : ''}</td>
          <td style="padding:12px 6px">${esc(r.pair.symbol)}</td>
          <td style="padding:12px 6px">${Nebari.fmt.units(r.bal, 18)}</td>
          <td style="padding:12px 6px"><b>${Nebari.fmt.units(r.claimable, r.pair.decimals)} ${esc(r.pair.symbol)}</b></td>
          <td style="padding:12px 6px;text-align:right;white-space:nowrap">
            <button class="btn btn-primary btn-sm" data-claim="${i}" type="button" ${r.claimable > 0n ? '' : 'disabled'}>Claim</button>
            <button class="btn btn-ghost btn-sm" data-collect="${i}" type="button">Collect fees</button>
          </td></tr>`).join('')}</tbody></table>
        <div class="status" id="claim-status" style="margin-top:20px">Collect fees pulls what the pool has earned into the split. Claim sends your share to your wallet.</div>`;
      list.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => act(relevant[+b.dataset.claim], 'claim', b)));
      list.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', () => act(relevant[+b.dataset.collect], 'collect', b)));
    } catch (e) { console.error(e); list.innerHTML = `<p class="status err">${esc(Nebari.explainError(e))}</p>`; }
  }

  async function act(r, what, btn) {
    const st = $('claim-status');
    const set = (m, k) => { st.className = 'status' + (k ? ' ' + k : ''); st.innerHTML = m; };
    btn.disabled = true;
    try {
      set('Confirm in your wallet…');
      const signer = await Nebari.signer();
      const tx = what === 'claim' ? await Nebari.token(r.L.token, signer).claim() : await Nebari.factory(signer).collectFees(r.L.token);
      set(`Sent. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">View on explorer</a>…`);
      await tx.wait();
      set(`Done. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">Transaction</a>`, 'ok');
      Chrome.toast(what === 'claim' ? 'Fees claimed' : 'Fees collected');
      await load();
    } catch (e) { set(Nebari.explainError(e), 'err'); btn.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('connect').addEventListener('click', async () => { try { await Nebari.connect(); } catch (e) { Chrome.toast(Nebari.explainError(e), 4000); } });
    Nebari.onWallet((w) => { $('connect').textContent = w.account ? Nebari.fmt.addr(w.account) : 'Connect wallet'; load(); });
    load();
  });
})();
