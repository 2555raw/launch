/* The landing page: live prices, the logo marquee, the crypto ticker and
 * the "what are you making" tabs, all fed by the API. */
(() => {
  const { api, usd, pct, esc, mark } = seekr;
  seekr.nav();

  /* icons in the step cards */
  const COINS = ['usdt', 'btc', 'eth', 'sol'];
  document.querySelectorAll('[data-icons]').forEach((el) => { el.innerHTML = el.dataset.icons.split(' ').map((id) => COINS.includes(id) ? `<img class="coin" src="/art/coins/${id}.svg" alt="${id.toUpperCase()}" title="${id.toUpperCase()}" width="20" height="20">` : `<span title="${id}">${mark(id)}</span>`).join(''); });

  /* vendor marquee (doubled for the loop) */
  const vendors = ['anthropic', 'gemini', 'xai', 'deepseek', 'runway', 'bytedance', 'meta', 'nvidia', 'openai', 'mistral', 'bfl', 'kling'];
  const track = document.getElementById('logosTrack');
  track.innerHTML = [...vendors, ...vendors].map((v) => `<span class="v" title="${v}">${mark(v)}</span>`).join('');

  /* crypto ticker */
  function renderTicker(t) {
    document.getElementById('ticker').innerHTML = t.coins.map((c) => `<span class="t"><img class="coin" src="/art/coins/${c.sym.toLowerCase()}.svg" alt="${c.sym}" title="${c.sym}" width="16" height="16"><span>${c.price >= 1000 ? c.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : c.price >= 1 ? c.price.toFixed(2) : c.price.toFixed(4)}</span><small class="${c.change >= 0 ? 'chg-up' : 'chg-down'}">${pct(c.change)}</small></span>`).join('');
  }
  const loadMarkets = () => api('/api/markets').then(({ tickers }) => renderTicker(tickers)).catch(() => null);
  loadMarkets(); setInterval(loadMarkets, 60000);

  /* live prices card + models tabs */
  api('/api/models').then(({ categories, models, count }) => {
    const pick = ['claude-opus-5-5', 'gpt-6-sol', 'nano-banana-2-lite'].map((id) => models.find((m) => m.id === id)).filter(Boolean);
    document.getElementById('priceRows').innerHTML = pick.map((m) => `<tr><td>${esc(m.name)}</td><td>${usd(m.prices.usd)}<small>${m.prices.unit}</small></td><td>${usd(m.prices.holderUsd)}</td></tr>`).join('');
    document.getElementById('modelCount').textContent = `${count} models`;

    const tabs = document.getElementById('jobTabs');
    const card = document.getElementById('jobCard');
    const show = (cat) => {
      tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === cat.id));
      const rec = models.filter((m) => (m.rec || []).includes(cat.id)).slice(0, 3);
      const all = models.filter((m) => m.cats.includes(cat.id));
      card.innerHTML = `<div><span class="tag">${cat.tag}</span><h3>${cat.title}</h3><p>${cat.blurb}</p><a class="more slash" href="/pricing#${cat.id}">See every ${cat.title.toLowerCase()} model</a></div>
        <div class="rec"><span class="tag">Recommended</span>${(rec.length ? rec : all.slice(0, 2)).map((m) => `<div><a href="/ask?model=${m.id}">${m.id}</a><span>${esc(m.name)}</span></div>`).join('')}</div>`;
    };
    /* video shows up once a video model is actually connected */
    if (!models.some((m) => m.kind === 'video' && m.live)) categories = categories.filter((c) => c.id !== 'video');
    tabs.innerHTML = categories.map((c) => `<button class="tab" data-id="${c.id}">${c.title}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => show(categories.find((c) => c.id === b.dataset.id))));
    show(categories[0]);
  }).catch(() => null);
})();
