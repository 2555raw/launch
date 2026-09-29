// Nebari — home page: the card bonsais, the quick-pick logos and the live counter.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;

  document.addEventListener('DOMContentLoaded', () => {

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
      if (ok.length !== picks.length) { renderPicks(ok); setQuick(ok.length); }
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
