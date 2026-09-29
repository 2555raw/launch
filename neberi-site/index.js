// Nebari — home page: the card bonsais, the quick-pick logos and the live counter.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;

  // where each asset floats in the banner: side, distance from the top and from the edge (%), size (px)
  const SPOTS = [
    { side: 'left',  top: 8,  edge: 14, size: 92 },
    { side: 'left',  top: 30, edge: 3,  size: 64 },
    { side: 'left',  top: 48, edge: 17, size: 76 },
    { side: 'left',  top: 70, edge: 5,  size: 100 },
    { side: 'left',  top: 84, edge: 20, size: 58 },
    { side: 'right', top: 6,  edge: 6,  size: 70 },
    { side: 'right', top: 24, edge: 18, size: 96 },
    { side: 'right', top: 50, edge: 4,  size: 84 },
    { side: 'right', top: 66, edge: 19, size: 62 },
    { side: 'right', top: 82, edge: 8,  size: 90 },
  ];

  function renderBanner(picks) {
    const box = document.getElementById('banner-assets');
    if (!box) return;
    box.innerHTML = '';
    picks.slice(0, SPOTS.length).forEach((p, i) => {
      const spot = SPOTS[i];
      const a = document.createElement('a');
      a.className = 'banner-asset';
      a.href = 'launch.html?pair=' + encodeURIComponent(p.address);
      a.title = `Root a token to ${p.name} (${p.symbol})`;
      a.style.setProperty('--size', spot.size + 'px');
      a.style.setProperty('--delay', (i * -0.7).toFixed(1) + 's');
      a.style.top = spot.top + '%';
      a.style[spot.side] = spot.edge + '%';
      const logo = Chrome.logoEl(p);
      a.appendChild(logo);
      a.insertAdjacentHTML('beforeend', `<span class="banner-sym">${p.symbol}</span>`);
      box.appendChild(a);
    });
  }

  function renderMarquee(picks) {
    const track = document.getElementById('marquee');
    if (!track) return;
    track.innerHTML = '';
    // two copies side by side so the loop is seamless
    for (let copy = 0; copy < 2; copy++) {
      picks.forEach((p) => {
        const it = document.createElement('span');
        it.className = 'marquee-item';
        it.appendChild(Chrome.logoEl(p));
        it.insertAdjacentHTML('beforeend', `${p.symbol} <small>${p.name}</small>`);
        track.appendChild(it);
      });
    }
  }

  // numbers count up the first time they scroll into view
  function countUp(el) {
    const raw = el.textContent.trim();
    const m = raw.match(/^(\d+(?:\.\d+)?)(\D*)$/);
    if (!m || el.dataset.counted) return;
    el.dataset.counted = '1';
    const target = parseFloat(m[1]), suffix = m[2], t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (Number.isInteger(target) ? Math.round(target * e) : (target * e).toFixed(1)) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }


  // ---- tokens launched from the site: newest first, straight from the factory
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ago(sec) {
    const d = Math.max(0, Math.floor(Date.now() / 1000 - Number(sec)));
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + ' h ago';
    return Math.floor(d / 86400) + ' d ago';
  }
  async function renderRecent() {
    const box = document.getElementById('recent-list');
    if (!box) return;
    if (!Nebari.configured()) { box.innerHTML = '<div class="recent-empty">The factory is not deployed yet.</div>'; return; }
    try {
      const factory = Nebari.factory();
      const n = Number(await factory.tokenCount());
      if (!n) { box.innerHTML = '<div class="recent-empty">No tokens yet. <a class="link-pink" href="launch.html">Plant the first one</a>.</div>'; return; }
      const launches = Array.from(await factory.getLaunches(Math.max(0, n - 8), 8)).reverse();
      const stats = await Promise.all(launches.map((L) => Nebari.tokenStats(L).catch(() => null)));
      box.innerHTML = '';
      launches.forEach((L, i) => {
        const s = stats[i]; if (!s) return;
        const a = document.createElement('a');
        a.className = 'recent-row'; a.href = 'token.html?token=' + L.token;
        const pic = document.createElement('span'); pic.className = 'recent-pic';
        if (s.meta && s.meta.image) {
          const img = document.createElement('img'); img.src = s.meta.image; img.alt = ''; img.referrerPolicy = 'no-referrer';
          img.onerror = () => { img.remove(); pic.textContent = s.symbol.slice(0, 3); };
          pic.appendChild(img);
        } else {
          const cv = document.createElement('canvas'); cv.width = 112; cv.height = 112; const ctx = cv.getContext('2d'); ctx.scale(2, 2);
          if (window.Bonsai) Bonsai.draw(ctx, { x: 28, y: 50, height: 42, seed: L.token.toLowerCase(), growth: s.growth, shadow: false });
          pic.appendChild(cv);
        }
        a.appendChild(pic);
        const pick = C.quickPicks.find((q) => q.address.toLowerCase() === s.pair.address.toLowerCase());
        const pairLogo = Chrome.logoEl(pick || s.pair); pairLogo.classList.add('recent-pair-logo');
        a.insertAdjacentHTML('beforeend', `
          <span class="recent-name"><b>${esc(s.name)}</b><span class="pill pill-pink">${esc(s.symbol)}</span><small>${ago(L.createdAt)}</small></span>
          <span class="recent-pair"></span>
          <span class="recent-num"><small>Price</small>${Nebari.fmt.num(s.price)} ${esc(s.pair.symbol)}</span>
          <span class="recent-num"><small>Market cap</small>${Nebari.fmt.num(s.marketCap)} ${esc(s.pair.symbol)}</span>
          <span class="recent-num"><small>Volume</small>${Nebari.fmt.num(s.volume)} ${esc(s.pair.symbol)}</span>
          <span class="recent-go" aria-hidden="true">↗</span>`);
        const pr = a.querySelector('.recent-pair'); pr.appendChild(pairLogo); pr.insertAdjacentHTML('beforeend', `<span>rooted to <b>${esc(s.pair.symbol)}</b></span>`);
        box.appendChild(a);
      });
      if (!box.children.length) box.innerHTML = '<div class="recent-empty">Could not read the tokens right now.</div>';
    } catch (e) {
      console.warn(e);
      box.innerHTML = '<div class="recent-empty">Could not reach Robinhood Chain right now.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderBanner(C.quickPicks);
    renderRecent();
    renderMarquee(C.quickPicks);
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.querySelectorAll('.stat-num').forEach(countUp); io.unobserve(e.target); } }), { threshold: 0.4 });
      const stats = document.querySelector('.stats'); if (stats) io.observe(stats);
    }

    // quick picks with their real logos
    const grid = document.getElementById('assets-grid');
    const setQuick = (n) => document.querySelectorAll('[data-quick-count]').forEach((el) => { el.textContent = String(n); });
    setQuick(C.quickPicks.length);
    const renderPicks = (picks) => {
      grid.innerHTML = '';
      picks.forEach((p) => {
        const a = document.createElement('a');
        a.className = 'asset';
        a.href = 'launch.html?pair=' + encodeURIComponent(p.address);
        a.appendChild(Chrome.logoEl(p));
        a.insertAdjacentHTML('beforeend', `<span><span class="asset-sym">${p.symbol}</span><br><span class="asset-name">${p.name}</span></span><span class="asset-kind">${p.kind}</span>`);
        grid.appendChild(a);
      });
    };
    renderPicks(C.quickPicks);
    Nebari.quickPicks().then((picks) => {
      const ok = picks.filter((p) => p.verified);
      if (ok.length !== picks.length) { renderPicks(ok); setQuick(ok.length); renderBanner(ok); renderMarquee(ok); }
    }).catch(() => { /* keep the configured list */ });

    // live count from the factory
    const counts = document.querySelectorAll('[data-live-count]');
    const note = document.getElementById('stat-note');
    if (!Nebari.configured()) {
      counts.forEach((el) => { el.textContent = '0'; });
      if (note) note.textContent = 'Factory not deployed yet: see docs.';
      return;
    }
    Nebari.factory().tokenCount().then((n) => {
      counts.forEach((el) => { el.textContent = n.toString(); });
    }).catch((e) => {
      console.warn(e);
      counts.forEach((el) => { el.textContent = '–'; });
      if (note) note.textContent = 'Could not reach the chain right now.';
    });
  });
})();
