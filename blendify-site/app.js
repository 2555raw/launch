/* Blendify — landing page interactions
   - ticker tape of supported assets
   - the live-index board: filters, sort, search
   - index builder (3–5 assets, weights split evenly) and its running-cost panel
   - section navigation
   All numbers below are sample data for layout. Replace them with the indexer
   feed before this page goes anywhere near a user. */
(function () {
  'use strict';

  var GAS_PER_SWAP = 1.25; // sample assumption, documented on the page

  /* ---------- sample data ---------- */

  var TAPE = [
    { sym: 'BTC', px: '64,180', d: 1.8 },
    { sym: 'ETH', px: '3,410', d: 2.4 },
    { sym: 'SOL', px: '172.40', d: -1.1 },
    { sym: 'tTSLA', px: '241.05', d: 0.6 },
    { sym: 'tNVDA', px: '128.90', d: 3.2 },
    { sym: 'tAAPL', px: '221.60', d: -0.4 },
    { sym: 'tMSFT', px: '418.30', d: 0.9 },
    { sym: 'tGOLD', px: '2,388', d: 0.2 },
    { sym: 'tSPY', px: '556.70', d: 0.5 },
    { sym: 'ARB', px: '0.842', d: -2.6 },
    { sym: 'OP', px: '1.94', d: 1.3 },
    { sym: 'LINK', px: '14.62', d: 4.1 },
    { sym: 'AVAX', px: '27.85', d: -0.8 },
    { sym: 'BNB', px: '588.10', d: 1.1 },
    { sym: 'tSLV', px: '28.44', d: -0.3 }
  ];

  var CHAINS = ['Robinhood', 'Ethereum', 'Base', 'BNB', 'Solana'];

  // value: total value in the index, delta: 24h %, legs: assets held, lev: leveraged market
  var INDEXES = [
    { tick: 'MAJ3',  name: 'Majors Three',      chain: 'Robinhood', value: 412600, delta: 4.2,   legs: 3, lev: true },
    { tick: 'L2BAG', name: 'Layer Two Bag',     chain: 'Base',      value: 168400, delta: -2.4,  legs: 4, lev: true },
    { tick: 'MAG5',  name: 'Magnificent Five',  chain: 'Robinhood', value: 296100, delta: 1.7,   legs: 5, lev: false },
    { tick: 'HARD',  name: 'Hard Assets',       chain: 'Ethereum',  value: 143900, delta: 0.4,   legs: 3, lev: false },
    { tick: 'AIBAS', name: 'AI Basket',         chain: 'Base',      value: 221750, delta: 8.9,   legs: 4, lev: true },
    { tick: 'SOLDF', name: 'Solana DeFi',       chain: 'Solana',    value: 96200,  delta: -5.1,  legs: 5, lev: true },
    { tick: 'STBL',  name: 'Steady Three',      chain: 'Ethereum',  value: 187300, delta: 0.9,   legs: 3, lev: false },
    { tick: 'ORCL',  name: 'Oracle Set',        chain: 'BNB',       value: 74850,  delta: 3.6,   legs: 3, lev: false },
    { tick: 'RWA4',  name: 'Real World Four',   chain: 'Robinhood', value: 158900, delta: 1.2,   legs: 4, lev: false },
    { tick: 'CHIP',  name: 'Silicon Basket',    chain: 'Robinhood', value: 264400, delta: 6.3,   legs: 5, lev: true },
    { tick: 'GASL',  name: 'Gas and Metals',    chain: 'Ethereum',  value: 88100,  delta: -1.6,  legs: 3, lev: false },
    { tick: 'MEME3', name: 'Three Dogs',        chain: 'Solana',    value: 51200,  delta: 12.4,  legs: 3, lev: true },
    { tick: 'BLUE',  name: 'Blue Chip Equity',  chain: 'Robinhood', value: 331500, delta: 0.7,   legs: 5, lev: false },
    { tick: 'YLD',   name: 'Yield Bearing',     chain: 'Base',      value: 119600, delta: 2.1,   legs: 4, lev: false },
    { tick: 'BRDG',  name: 'Bridge Basket',     chain: 'BNB',       value: 63400,  delta: -3.8,  legs: 3, lev: true },
    { tick: 'HALF',  name: 'Half and Half',     chain: 'Ethereum',  value: 205800, delta: 1.5,   legs: 4, lev: true }
  ];

  var CATALOG = ['BTC', 'ETH', 'SOL', 'tTSLA', 'tNVDA', 'tGOLD', 'LINK', 'ARB'];

  var state = {
    filter: 'all',
    sort: 'new',
    query: '',
    assets: ['BTC', 'ETH', 'SOL']
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function money(v) {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
    return '$' + v;
  }
  function pct(d) { return (d > 0 ? '+' : '') + d.toFixed(1) + '%'; }

  /* ---------- ticker tape ---------- */

  function renderTape() {
    var tape = $('tape');
    if (!tape) return;
    TAPE.forEach(function (a) {
      var item = el('div', 'bl-tape-item');
      item.appendChild(el('span', 'bl-tape-mark', a.sym.replace('t', '').slice(0, 1)));
      item.appendChild(el('b', null, a.sym));
      item.appendChild(el('span', null, '$' + a.px));
      item.appendChild(el('span', 'bl-tape-delta ' + (a.d < 0 ? 'bl-down' : 'bl-up'), pct(a.d)));
      tape.appendChild(item);
    });
  }

  /* ---------- the board ---------- */

  function matching() {
    var q = state.query.trim().toLowerCase();
    return INDEXES.filter(function (m) {
      if (state.filter === 'lev' && !m.lev) return false;
      if (state.filter === 'spot' && m.lev) return false;
      if (!q) return true;
      return m.tick.toLowerCase().indexOf(q) > -1 || m.name.toLowerCase().indexOf(q) > -1;
    });
  }

  function sorted(list) {
    var out = list.slice();
    if (state.sort === 'cap') out.sort(function (a, b) { return b.value - a.value; });
    else if (state.sort === 'delta') out.sort(function (a, b) { return b.delta - a.delta; });
    else if (state.sort === 'legs') out.sort(function (a, b) { return b.legs - a.legs; });
    return out; // 'new' keeps the authored order, newest first
  }

  function card(m) {
    var c = el('div', 'bl-mcard');

    var top = el('div', 'bl-mcard-top');
    top.appendChild(el('div', 'bl-avatar', m.tick.slice(0, 2)));
    var id = el('div', 'bl-mcard-id');
    id.appendChild(el('div', 'bl-ticker', '$' + m.tick));
    id.appendChild(el('div', 'bl-mcard-name', m.name));
    top.appendChild(id);
    var badge = el('div', 'bl-badge');
    badge.appendChild(el('i'));
    badge.appendChild(el('span', null, m.chain));
    top.appendChild(badge);
    c.appendChild(top);

    var capWrap = el('div');
    var cap = el('div', 'bl-mcard-cap');
    cap.appendChild(el('div', 'bl-cap-num', money(m.value)));
    cap.appendChild(el('div', 'bl-cap-delta ' + (m.delta < 0 ? 'bl-down' : 'bl-up'), pct(m.delta)));
    capWrap.appendChild(cap);
    capWrap.appendChild(el('div', 'bl-label', 'Total value'));
    c.appendChild(capWrap);

    // the bar reads as "how full the basket is": legs held out of the five allowed
    var track = el('div', 'bl-track');
    var fill = el('div', 'bl-track-fill');
    fill.style.width = (m.legs / 5 * 100) + '%';
    track.appendChild(fill);
    c.appendChild(track);

    var foot = el('div', 'bl-mcard-foot');
    foot.appendChild(el('span', null, m.legs + ' of 5 legs'));
    foot.appendChild(el('span', null, m.lev ? 'up to 5x' : 'spot only'));
    c.appendChild(foot);

    return c;
  }

  function renderBoard() {
    var board = $('board');
    if (!board) return;
    var list = sorted(matching());
    board.textContent = '';
    if (!list.length) {
      board.appendChild(el('div', 'bl-empty', 'No index matches that search.'));
      return;
    }
    list.forEach(function (m) { board.appendChild(card(m)); });
  }

  function renderCounts() {
    var lev = INDEXES.filter(function (m) { return m.lev; }).length;
    $('cAll').textContent = INDEXES.length;
    $('cLev').textContent = lev;
    $('cSpot').textContent = INDEXES.length - lev;
  }

  function renderStats() {
    var total = INDEXES.reduce(function (s, m) { return s + m.value; }, 0);
    var legs = INDEXES.reduce(function (s, m) { return s + m.legs; }, 0);
    $('statLive').textContent = INDEXES.length;
    $('statAssets').textContent = TAPE.length;
    $('statValue').textContent = money(total);
    $('statChains').textContent = CHAINS.length;
    $('statLegs').textContent = (legs / INDEXES.length).toFixed(1);
  }

  /* ---------- builder ---------- */

  function renderBuilder() {
    var chips = $('chips');
    var weights = $('weights');
    if (!chips || !weights) return;

    chips.textContent = '';
    CATALOG.forEach(function (sym) {
      var on = state.assets.indexOf(sym) > -1;
      var chip = el('div', 'bl-chip' + (on ? ' is-on' : ''), sym);
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      function toggle() {
        var i = state.assets.indexOf(sym);
        if (i > -1) {
          if (state.assets.length > 3) state.assets.splice(i, 1);
        } else if (state.assets.length < 5) {
          state.assets.push(sym);
        }
        renderBuilder();
      }
      chip.addEventListener('click', toggle);
      chip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
      chips.appendChild(chip);
    });

    var share = 100 / state.assets.length;
    weights.textContent = '';
    state.assets.forEach(function (sym) {
      var row = el('div', 'bl-weight');
      row.appendChild(el('div', 'bl-weight-name', sym));
      var track = el('div', 'bl-weight-track');
      var fill = el('div', 'bl-weight-fill');
      fill.style.width = share + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'bl-weight-pct', share.toFixed(0) + '%'));
      weights.appendChild(row);
    });

    var n = state.assets.length;
    $('sumLegs').textContent = n;
    $('sumSwaps').textContent = n;
    $('sumGas').textContent = '$' + ((n - 1) * GAS_PER_SWAP).toFixed(2);
  }

  /* ---------- wiring ---------- */

  function scrollTo(id) {
    var node = id === 'top' ? document.body : document.getElementById(id);
    if (!node) return;
    var y = id === 'top' ? 0 : node.getBoundingClientRect().top + window.pageYOffset - 96;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function wire() {
    document.querySelectorAll('[data-scroll]').forEach(function (node) {
      node.style.cursor = 'pointer';
      node.addEventListener('click', function () { scrollTo(node.getAttribute('data-scroll')); });
    });

    var tabs = $('tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.bl-tab');
        if (!tab) return;
        state.filter = tab.getAttribute('data-filter');
        tabs.querySelectorAll('.bl-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        renderBoard();
      });
    }

    var sort = $('sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; renderBoard(); });

    var search = $('search');
    if (search) search.addEventListener('input', function () { state.query = search.value; renderBoard(); });
  }

  renderTape();
  renderCounts();
  renderStats();
  renderBoard();
  renderBuilder();
  wire();
})();
