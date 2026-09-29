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

  document.addEventListener('DOMContentLoaded', () => {
    renderBanner(C.quickPicks);

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
      if (ok.length !== picks.length) { renderPicks(ok); setQuick(ok.length); renderBanner(ok); }
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
