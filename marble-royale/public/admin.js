/* The payout desk.

   Reads the round file through the admin routes and lets you mark a round paid
   once you have sent the money. It holds no key material beyond the admin key
   you type, which stays in this browser. */

(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const rows = $('#rows'), sum = $('#sum');
  let key = localStorage.getItem('mr.admin') || '';
  $('#key').value = key;

  const api = (path, opts) => fetch('/api/admin/' + path, Object.assign({
    headers: { 'content-type': 'application/json', 'x-admin-key': key }
  }, opts)).then((r) => r.json());

  const short = (a) => a.slice(0, 6) + '…' + a.slice(-6);
  const when = (ms) => new Date(ms).toLocaleString();

  async function load() {
    key = $('#key').value.trim();
    localStorage.setItem('mr.admin', key);
    $('#csv').href = '/api/admin/rounds.csv?key=' + encodeURIComponent(key);
    const data = await api('rounds?n=200');
    if (data.error) { rows.innerHTML = '<tr><td colspan=7>' + data.error + '</td></tr>'; return; }

    const withWinner = data.rounds.filter((r) => r.winner);
    const owed = withWinner.filter((r) => !r.paid);
    const owedSol = owed.reduce((n, r) => n + (r.pot || 0), 0);
    sum.innerHTML = '';
    for (const [label, value] of [
      ['ROUNDS', withWinner.length],
      ['TO PAY', owed.length],
      ['USD OWED', Math.round(owedSol * 100) / 100],
      ['FEE WALLET', data.feeWallet ? short(data.feeWallet) : 'not set']
    ]) {
      const d = document.createElement('div');
      const b = document.createElement('b'); b.textContent = value;
      const s = document.createElement('span'); s.textContent = label;
      d.append(b, s); sum.appendChild(d);
    }

    rows.innerHTML = '';
    for (const r of withWinner) rows.appendChild(rowFor(r));
  }

  function rowFor(r) {
    const tr = document.createElement('tr');
    if (!r.paid) tr.className = 'due';

    const id = cell(r.id);
    const time = cell(when(r.startAt));

    const addrTd = document.createElement('td');
    const addr = document.createElement('span');
    addr.className = 'addr'; addr.textContent = r.winner; addr.title = 'copy';
    addr.addEventListener('click', () => navigator.clipboard.writeText(r.winner).then(() => { addr.textContent = 'copied'; setTimeout(() => { addr.textContent = r.winner; }, 900); }));
    addrTd.appendChild(addr);

    const potTd = document.createElement('td');
    const pot = document.createElement('input');
    pot.value = r.pot === null || r.pot === undefined ? '' : r.pot;
    pot.style.width = '90px';
    pot.title = 'USD to pay - edit to correct it';
    pot.addEventListener('change', async () => {
      const res = await api('pot', { method: 'POST', body: JSON.stringify({ id: r.id, pot: Number(pot.value) }) });
      if (res.error) alert(res.error);
    });
    potTd.appendChild(pot);

    const state = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'pill ' + (r.paid ? 'ok' : 'due');
    pill.textContent = r.paid ? 'paid' : 'owed';
    state.appendChild(pill);

    const act = document.createElement('td');
    const wrap = document.createElement('div'); wrap.className = 'row-actions';
    if (r.paid) {
      const tx = document.createElement('span');
      tx.className = 'addr'; tx.textContent = r.tx ? short(r.tx) : '(no signature)';
      if (r.tx) tx.addEventListener('click', () => window.open('https://etherscan.io/tx/' + r.tx, '_blank'));
      wrap.appendChild(tx);
    } else {
      const sig = document.createElement('input');
      sig.placeholder = 'tx signature';
      const btn = document.createElement('button');
      btn.className = 'btn btn--go'; btn.textContent = 'MARK PAID';
      btn.addEventListener('click', async () => {
        const res = await api('paid', { method: 'POST', body: JSON.stringify({ id: r.id, tx: sig.value.trim() }) });
        if (res.error) return alert(res.error);
        load();
      });
      wrap.append(sig, btn);
    }
    act.appendChild(wrap);

    tr.append(id, time, addrTd, potTd, cell(r.players ? r.players.length : 0), state, act);
    return tr;
  }

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  $('#load').addEventListener('click', load);
  $('#key').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  $('#forget').addEventListener('click', () => { localStorage.removeItem('mr.admin'); $('#key').value = ''; rows.innerHTML = ''; sum.innerHTML = ''; });
  if (key) load();
  setInterval(() => { if (key) load(); }, 30000);
})();
