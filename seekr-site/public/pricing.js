(() => {
  const { api, usd, esc } = seekr; seekr.nav();
  api('/api/models').then(({ categories, models }) => {
    const tabs = document.getElementById('catTabs'); const out = document.getElementById('tables');
    const kinds = { chat: 'chat', code: 'chat', image: 'image', video: 'video', audio: null };
    const show = (cat) => {
      tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === cat.id));
      const list = models.filter((m) => m.cats.includes(cat.id));
      const isChat = kinds[cat.id] === 'chat';
      out.innerHTML = `<table class="table" id="${cat.id}"><thead><tr><th>Model</th><th>Vendor</th>${isChat ? '<th class="num">Input /1M</th><th class="num">Output /1M</th>' : '<th class="num">Price</th>'}<th class="num">$WONDR holders</th></tr></thead><tbody>${list.map((m) => `<tr><td><a href="/ask?model=${m.id}"><b>${esc(m.name)}</b></a>${m.badge ? `<span class="badge">${m.badge}</span>` : ''}${m.live ? '' : `<span class="badge demo">${m.kind === 'video' || m.kind === 'stt' ? 'demo' : 'free tier'}</span>`}<div class="id">${m.id}${m.context ? ` · ${(m.context / 1000).toLocaleString()}K ctx` : ''}</div></td><td>${esc(m.vendor)}</td>${isChat ? `<td class="num">${usd(m.prices.inUsd)}</td><td class="num">${usd(m.prices.usd)}</td>` : `<td class="num">${usd(m.prices.usd)} <span class="id">${m.prices.unit}</span></td>`}<td class="num accent">${usd(m.prices.holderUsd)}${isChat ? '' : ''}</td></tr>`).join('')}</tbody></table>`;
    };
    tabs.innerHTML = categories.map((c) => `<button class="tab" data-id="${c.id}">${c.title}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach((b) => b.onclick = () => show(categories.find((c) => c.id === b.dataset.id)));
    show(categories.find((c) => c.id === location.hash.slice(1)) || categories[0]);
  });
})();
