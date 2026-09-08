/* Blendify — landing page interactions
   - index builder (3–5 assets, weights split across the basket)
   - hero trade sizing (input size split across a 40/35/25 index)
   - gas savings + position sizing calculators
   - section navigation and the pink cursor trail
*/
(function () {
  'use strict';

  var PINK = '#FF5FC7';
  var PURPLE = '#A16BFF';
  var VIOLET = '#7C5CFF';
  var IDLE = 'background:#33323A;border-color:#48464F;color:#A8A2B4;';

  function selected(color) {
    return 'background:' + color + ';border-color:' + color + ';color:#1B1A1F;';
  }

  var state = {
    assets: ['btc', 'eth', 'sol'], // index builder selection
    size: 2,                       // hero trade sizing, in ETH
    gasAssets: 5,                  // gas calculator
    leverage: 2                    // position sizing calculator
  };

  var CATALOG = [
    { id: 'btc', label: 'BTC', color: PINK },
    { id: 'eth', label: 'ETH', color: PURPLE },
    { id: 'sol', label: 'SOL', color: VIOLET },
    { id: 'aapl', label: 'AAPL', color: PINK },
    { id: 'tsla', label: 'TSLA', color: PURPLE }
  ];

  var LEGS = [
    { label: 'BTC', pct: 40, color: PINK },
    { label: 'ETH', pct: 35, color: PURPLE },
    { label: 'SOL', pct: 25, color: VIOLET }
  ];

  var SIZES = [0.5, 2, 10];
  var GAS_ASSETS = [3, 4, 5];
  var LEVERAGES = [2, 3, 5];

  var SUBNAV = [
    { label: 'About', id: 'indexes' },
    { label: 'Built by traders', id: 'traders' },
    { label: 'How it works', id: 'how' },
    { label: 'Inside an index', id: 'inside' },
    { label: 'The shift', id: 'shift' },
    { label: 'Your edge', id: 'edge' },
    { label: 'Calculators', id: 'calc' },
    { label: 'Features', id: 'features' },
    { label: 'Why it matters', id: 'why' },
    { label: 'FAQ', id: 'faq' }
  ];

  function el(id) { return document.getElementById(id); }

  function scrollToId(id) {
    var target = document.getElementById(id);
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- navigation ---------- */

  function renderSubnav() {
    var wrap = el('subnav');
    if (!wrap) return;
    wrap.innerHTML = '';
    SUBNAV.forEach(function (item) {
      var a = document.createElement('a');
      a.textContent = item.label;
      a.addEventListener('click', function () { scrollToId(item.id); });
      wrap.appendChild(a);
    });
  }

  function bindScrollTargets() {
    var nodes = document.querySelectorAll('[data-scroll]');
    Array.prototype.forEach.call(nodes, function (node) {
      node.addEventListener('click', function () {
        scrollToId(node.getAttribute('data-scroll'));
      });
    });
  }

  /* ---------- index builder ---------- */

  function toggleAsset(id) {
    var i = state.assets.indexOf(id);
    if (i !== -1) {
      if (state.assets.length > 3) state.assets.splice(i, 1);
    } else if (state.assets.length < 5) {
      state.assets.push(id);
    }
    renderBuilder();
  }

  function renderBuilder() {
    var chips = el('assetChips');
    var weights = el('weights');
    if (!chips || !weights) return;

    var n = state.assets.length;
    var base = Math.floor(100 / n);
    var remainder = 100 - base * n;

    chips.innerHTML = '';
    weights.innerHTML = '';

    CATALOG.forEach(function (asset) {
      var index = state.assets.indexOf(asset.id);
      var active = index !== -1;

      var chip = document.createElement('div');
      chip.className = 'bl-chip';
      chip.setAttribute('style', active ? selected(asset.color) : IDLE);
      chip.textContent = asset.label;
      chip.addEventListener('click', function () { toggleAsset(asset.id); });
      chips.appendChild(chip);

      if (!active) return;

      var pct = base + (index === n - 1 ? remainder : 0);
      var row = document.createElement('div');
      row.className = 'bl-weight-row';
      row.innerHTML =
        '<div class="bl-weight-label bl-display">' + asset.label + '</div>' +
        '<div class="bl-weight-track"><div class="bl-weight-fill" style="width:' + pct + '%;background:' + asset.color + ';"></div></div>' +
        '<div class="bl-weight-pct">' + pct + '%</div>';
      weights.appendChild(row);
    });
  }

  /* ---------- hero trade sizing ---------- */

  function renderSizing() {
    var pills = el('sizePills');
    var legs = el('legs');
    if (!pills || !legs) return;

    pills.innerHTML = '';
    SIZES.forEach(function (size) {
      var pill = document.createElement('div');
      pill.className = 'bl-pill';
      pill.textContent = size + ' ETH';
      pill.setAttribute('style', size === state.size ? selected(PINK) : IDLE);
      pill.addEventListener('click', function () { state.size = size; renderSizing(); });
      pills.appendChild(pill);
    });

    var decimals = state.size < 1 ? 3 : 2;
    legs.innerHTML = '';
    LEGS.forEach(function (leg) {
      var amount = (state.size * leg.pct / 100).toFixed(decimals);
      var row = document.createElement('div');
      row.className = 'bl-leg';
      row.innerHTML =
        '<span class="bl-leg-swatch" style="background:' + leg.color + ';"></span>' +
        '<span class="bl-leg-name">' + leg.label + '</span>' +
        '<span class="bl-leg-weight">' + leg.pct + '%</span>' +
        '<span class="bl-leg-bar"><span class="bl-leg-fill" style="width:' + leg.pct + '%;background:' + leg.color + ';"></span></span>' +
        '<span class="bl-leg-amt">' + amount + ' ETH</span>';
      legs.appendChild(row);
    });
  }

  /* ---------- calculators ---------- */

  function renderPills(container, values, current, format, onPick, color) {
    if (!container) return;
    container.innerHTML = '';
    values.forEach(function (value) {
      var pill = document.createElement('div');
      pill.className = 'bl-pill';
      pill.textContent = format(value);
      pill.setAttribute('style', value === current ? selected(color) : IDLE);
      pill.addEventListener('click', function () { onPick(value); });
      container.appendChild(pill);
    });
  }

  function setText(id, value) {
    var node = el(id);
    if (node) node.textContent = value;
  }

  function renderCalculators() {
    renderPills(el('gasPills'), GAS_ASSETS, state.gasAssets,
      function (v) { return v + ' assets'; },
      function (v) { state.gasAssets = v; renderCalculators(); }, PURPLE);

    renderPills(el('levPills'), LEVERAGES, state.leverage,
      function (v) { return v + 'x'; },
      function (v) { state.leverage = v; renderCalculators(); }, PINK);

    // sample assumption: ~$1.25 of gas per avoided swap, rebalanced monthly
    var swapsAvoided = state.gasAssets - 1;
    var gasSaved = Math.round(swapsAvoided * 1.25 * 100) / 100;
    setText('swapsAvoided', swapsAvoided);
    setText('gasSaved', gasSaved);
    setText('yearlySavings', Math.round(gasSaved * 12));

    // sample collateral of 0.05 ETH; liquidation excludes funding and fees
    setText('totalSize', Math.round(0.05 * state.leverage * 100) / 100);
    setText('liqMove', Math.round(90 / state.leverage));
  }

  /* ---------- pink cursor trail ---------- */

  function cursorTrail() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var layer = el('bl-spark-layer');
    if (!layer) return;

    var lastSpark = 0, lastX = 0, lastY = 0;

    function spark(x, y, size) {
      var dot = document.createElement('span');
      dot.className = 'bl-spark';
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
      dot.style.left = (x - size / 2) + 'px';
      dot.style.top = (y - size / 2) + 'px';
      dot.style.setProperty('--dx', (Math.random() * 10 - 5).toFixed(1) + 'px');
      dot.style.setProperty('--dy', (-4 - Math.random() * 8).toFixed(1) + 'px');
      layer.appendChild(dot);
      window.setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 640);
    }

    document.addEventListener('mousemove', function (e) {
      var now = Date.now();
      if (now - lastSpark < 26) return;
      if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) < 5) return;
      lastSpark = now; lastX = e.clientX; lastY = e.clientY;
      spark(e.clientX + (Math.random() * 7 - 3.5), e.clientY + (Math.random() * 7 - 3.5), 4 + Math.random() * 6);
    }, { passive: true });

    document.addEventListener('mousedown', function (e) {
      for (var i = 0; i < 5; i++) spark(e.clientX, e.clientY, 4 + Math.random() * 7);
    }, { passive: true });
  }

  function init() {
    renderSubnav();
    bindScrollTargets();
    renderBuilder();
    renderSizing();
    renderCalculators();
    cursorTrail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
