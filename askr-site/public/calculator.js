(() => {
  const { api, usd, esc } = askr; askr.nav();
  const $ = (s) => document.querySelector(s);
  api('/api/models').then(({ models, default: def }) => {
    const sel = $('#model');
    sel.innerHTML = models.map((m) => `<option value="${m.id}">${esc(m.name)} — ${esc(m.vendor)}</option>`).join('');
    sel.value = new URLSearchParams(location.search).get('model') || def;
    const fields = { chat: [['inTokens', 'Input tokens per request', 2000], ['outTokens', 'Output tokens per request', 600]], image: [['images', 'Images per request', 1]], video: [['seconds', 'Seconds of video', 5]], tts: [['chars', 'Characters of text', 800]], stt: [['minutes', 'Minutes of audio', 2]] };
    const render = () => {
      const m = models.find((x) => x.id === sel.value);
      $('#inputs').innerHTML = fields[m.kind].map(([k, l, v]) => `<div class="field"><label>${l}</label><input class="input" data-k="${k}" type="number" min="0" value="${v}"></div>`).join('');
      document.querySelectorAll('[data-k]').forEach((i) => i.oninput = calc);
      calc();
    };
    const calc = () => {
      const m = models.find((x) => x.id === sel.value);
      const p = m.price; const g = (k) => Number(($(`[data-k="${k}"]`) || {}).value || 0);
      let providerUsd = 0;
      if (m.kind === 'chat') providerUsd = (g('inTokens') * p.in + g('outTokens') * p.out) / 1e6;
      if (m.kind === 'image') providerUsd = g('images') * p.image;
      if (m.kind === 'video') providerUsd = g('seconds') * p.second;
      if (m.kind === 'tts') providerUsd = (g('chars') / 1e6) * p.mchars;
      if (m.kind === 'stt') providerUsd = g('minutes') * p.minute;
      const cfg = window.askrConfig || { markup: 1.055, creditsPerUsd: 1000, holder: { pricePct: 0.05 } };
      const list = providerUsd * cfg.markup * cfg.creditsPerUsd;
      const credits = $('#holder').checked ? list * cfg.holder.pricePct : list;
      const reqs = Number($('#reqs').value || 0);
      const f = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
      $('#perReq').textContent = `${f(credits)} cr`;
      $('#listUsd').textContent = usd(list / cfg.creditsPerUsd, 4);
      $('#month').textContent = `${f(credits * reqs)} cr`;
      $('#monthUsd').textContent = usd((credits * reqs) / cfg.creditsPerUsd, 2);
      $('#deposit').textContent = usd((credits * reqs) / cfg.creditsPerUsd, 2);
      $('#go').href = '/ask?model=' + m.id;
    };
    sel.onchange = render; $('#reqs').oninput = calc; $('#holder').onchange = calc;
    render(); setTimeout(calc, 600);
  });
})();
