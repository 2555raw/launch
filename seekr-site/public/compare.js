/* Compare: up to three models side by side on the same workload, from the live price table. */
(() => {
  const { api, usd, esc, mark, vendorMark } = seekr; seekr.nav();
  const KINDS = [
    { id: 'chat', title: 'Chat & code', unit: 'message', work: 'Messages a month', def: 300, per: (m) => (1500 * (m.prices.inUsd || 0) + 500 * m.prices.usd) / 1e6, note: 'One message counts as 1,500 tokens in and 500 out: a question with some context and a full answer.', pick: ['claude-sonnet-5', 'gpt-6-sol', 'gemini-3.7-pro'] },
    { id: 'image', title: 'Images', unit: 'image', work: 'Images a month', def: 50, per: (m) => m.prices.usd, note: 'One image at the model’s standard size.', pick: ['flux-2-pro', 'nano-banana-2', 'gpt-image-2'] },
    { id: 'video', title: 'Video', unit: '5 s clip', work: 'Clips a month', def: 10, per: (m) => 5 * m.prices.usd, note: 'One clip is 5 seconds of video.', pick: ['kling-3', 'seedance-2-pro', 'veo-4'] },
    { id: 'tts', title: 'Voice', unit: 'minute of speech', work: 'Minutes a month', def: 60, per: (m) => 900 * m.prices.usd / 1e6, note: 'A minute of speech is about 900 characters of text.', pick: ['gpt-4o-mini-tts', 'eleven-v3'] }
  ];
  let models = []; let kind = KINDS[0]; let chosen = []; let amount = kind.def;
  const money = (n) => (n >= 100 ? '$' + Math.round(n).toLocaleString('en-US') : n >= 1 ? '$' + n.toFixed(2) : n >= 0.01 ? '$' + n.toFixed(3) : '$' + n.toFixed(4));

  function setKind(k) {
    kind = k; amount = k.def;
    const list = models.filter((m) => m.kind === k.id);
    chosen = k.pick.filter((id) => list.some((m) => m.id === id));
    for (const m of list) if (chosen.length < Math.min(3, list.length) && !chosen.includes(m.id)) chosen.push(m.id);
    render();
  }

  function render() {
    document.querySelectorAll('#cmpTabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.id === kind.id));
    const list = models.filter((m) => m.kind === kind.id);
    const opts = (sel, allowNone) => (allowNone ? `<option value="">None</option>` : '') + list.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} (${esc(m.vendor)})</option>`).join('');
    const slots = Math.min(3, list.length);
    document.getElementById('cmpPick').innerHTML = Array.from({ length: slots }, (_, i) => `<select class="input" data-slot="${i}" aria-label="Model ${i + 1}">${opts(chosen[i] || '', i > 0)}</select>`).join('');
    document.querySelectorAll('#cmpPick select').forEach((s) => s.onchange = () => { chosen[+s.dataset.slot] = s.value; chosen = chosen.slice(0, slots); render(); });
    document.getElementById('cmpWork').innerHTML = `<label>${esc(kind.work)}</label><input class="input" id="cmpAmt" type="number" min="1" step="1" value="${amount}"><span class="note">${esc(kind.note)}</span>`;
    document.getElementById('cmpAmt').oninput = (e) => { amount = Math.max(0, Number(e.target.value) || 0); cards(); };
    cards();
  }

  function cards() {
    const picked = chosen.filter(Boolean).map((id) => models.find((m) => m.id === id)).filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
    const costs = picked.map((m) => kind.per(m) * amount);
    const min = Math.min(...costs);
    document.getElementById('cmpGrid').innerHTML = picked.map((m, i) => {
      const unit = kind.per(m); const month = costs[i];
      const rows = [
        [`Per ${kind.unit}`, money(unit)],
        ['Per month', `<b>${money(month)}</b>`],
        ['Per month, $WONDR holder', `<span class="accent">${money(month * 0.05)}</span>`],
        ...(m.kind === 'chat' ? [['Input / output per 1M tokens', `${usd(m.prices.inUsd)} / ${usd(m.prices.usd)}`], ['Context window', m.context ? (m.context >= 1e6 ? m.context / 1e6 + 'M' : Math.round(m.context / 1000) + 'k') + ' tokens' : 'n/a']] : [])
      ];
      return `<div class="cmp-card${picked.length > 1 && month === min ? ' best' : ''}">
        <div class="cmp-h"><span class="cmp-ic">${mark(vendorMark(m.vendor))}</span><div><b>${esc(m.name)}</b><small>${esc(m.vendor)}</small></div>${picked.length > 1 && month === min ? '<span class="cmp-badge">Cheapest</span>' : ''}</div>
        <div class="cmp-big">${money(month)}<small>/month</small></div>
        ${rows.map(([k, v]) => `<div class="cmp-row"><span>${k}</span><span>${v}</span></div>`).join('')}
        <a class="btn btn-ghost btn-sm cmp-try" href="/ask?model=${encodeURIComponent(m.id)}">Try ${esc(m.name)}</a>
      </div>`;
    }).join('') || '<p class="note">Pick a model above.</p>';
  }

  api('/api/models').then((r) => {
    models = r.models;
    const kinds = KINDS.filter((k) => models.some((m) => m.kind === k.id));
    document.getElementById('cmpTabs').innerHTML = kinds.map((k) => `<button class="tab" data-id="${k.id}">${k.title}</button>`).join('');
    document.querySelectorAll('#cmpTabs .tab').forEach((b) => b.onclick = () => setKind(kinds.find((k) => k.id === b.dataset.id)));
    setKind(kinds.find((k) => k.id === location.hash.slice(1)) || kinds[0]);
  }).catch(() => { document.getElementById('cmpGrid').innerHTML = '<p class="note">Prices could not load. Refresh to try again.</p>'; });
})();
