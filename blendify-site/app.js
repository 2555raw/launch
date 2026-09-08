/* TRICKER — market page interactions
   - the asset catalog: every asset carries its own drawn icon and brand colour
   - ticker tape, the live-bag board (filter / sort / search), the bag builder
   All figures below are sample data for layout. Wire them to the indexer
   before this page goes anywhere near a user. */
(function () {
  'use strict';

  var GAS_PER_SWAP = 1.25; // sample assumption, stated on the page

  /* ---------- assets ----------
     Icons are drawn here rather than fetched: a 24x24 glyph or shape per asset,
     tinted with that asset's own colour. `g` is a Unicode currency glyph;
     `art` is inline SVG where the asset is better shown as the thing it is. */

  var ASSETS = {
    BTC:   { name: 'Bitcoin',    color: '#F7931A', px: '64,180', d: 1.8,  g: '₿' },
    ETH:   { name: 'Ethereum',   color: '#7A8CF0', px: '3,410',  d: 2.4,  g: 'Ξ' },
    SOL:   { name: 'Solana',     color: '#14F195', px: '172.40', d: -1.1, g: '◎' },
    XRP:   { name: 'XRP',        color: '#C8CED6', px: '0.612',  d: 0.9,  g: '✖' },
    DOGE:  { name: 'Dogecoin',   color: '#D6B54A', px: '0.164',  d: 5.6,  g: 'Ð' },
    BNB:   { name: 'BNB',        color: '#F3BA2F', px: '588.10', d: 1.1,  g: 'B' },
    ADA:   { name: 'Cardano',    color: '#4E7BE8', px: '0.478',  d: -2.2, g: '₳' },
    LINK:  { name: 'Chainlink',  color: '#5C86F5', px: '14.62',  d: 4.1,  g: '⬢' },

    NVDA:  { name: 'Nvidia',     color: '#8FD41C', px: '128.90', d: 3.2, art:
      '<rect x="7.5" y="7.5" width="9" height="9" rx="2" fill="none" stroke="C" stroke-width="1.7"/>' +
      '<path d="M10 4.2v3.3M14 4.2v3.3M10 16.5v3.3M14 16.5v3.3M4.2 10h3.3M4.2 14h3.3M16.5 10h3.3M16.5 14h3.3" stroke="C" stroke-width="1.5" stroke-linecap="round"/>' },

    TSLA:  { name: 'Tesla',      color: '#FF4B52', px: '241.05', d: -0.6, art:
      '<path d="M3.6 15.2c0-1 .9-1.3 1.7-1.5l1.5-2.9c.3-.6.9-1 1.6-1h7.2c.7 0 1.3.4 1.6 1l1.5 2.9c.8.2 1.7.5 1.7 1.5v1.7h-2.1a1.9 1.9 0 0 0-3.8 0H9.5a1.9 1.9 0 0 0-3.8 0H3.6z" fill="none" stroke="C" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="7.6" cy="16.9" r="1.6" fill="none" stroke="C" stroke-width="1.4"/><circle cx="16.4" cy="16.9" r="1.6" fill="none" stroke="C" stroke-width="1.4"/>' },

    AAPL:  { name: 'Apple',      color: '#C7CDD2', px: '221.60', d: -0.4, art:
      '<rect x="7.6" y="3.4" width="8.8" height="17.2" rx="2.2" fill="none" stroke="C" stroke-width="1.6"/>' +
      '<path d="M10.6 6.4h2.8" stroke="C" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="17.8" r="1" fill="C"/>' },

    MSFT:  { name: 'Microsoft',  color: '#4FC3F7', px: '418.30', d: 0.9, art:
      '<rect x="3.4" y="4.8" width="17.2" height="11.4" rx="1.8" fill="none" stroke="C" stroke-width="1.6"/>' +
      '<path d="M12 16.2v3M9 19.2h6" stroke="C" stroke-width="1.6" stroke-linecap="round"/>' },

    AMZN:  { name: 'Amazon',     color: '#FFA726', px: '186.40', d: 1.4, art:
      '<path d="M3.8 8.2 12 4.6l8.2 3.6v7.6L12 19.4l-8.2-3.6z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M3.8 8.2 12 11.8l8.2-3.6M12 11.8v7.6" stroke="C" stroke-width="1.4" stroke-linejoin="round"/>' },

    GOOGL: { name: 'Alphabet',   color: '#6BA4FF', px: '168.20', d: 0.7, art:
      '<circle cx="10.6" cy="10.6" r="5.6" fill="none" stroke="C" stroke-width="1.8"/>' +
      '<path d="M14.7 14.7 19.6 19.6" stroke="C" stroke-width="1.9" stroke-linecap="round"/>' },

    META:  { name: 'Meta',       color: '#5B9DFF', px: '512.90', d: 2.8, art:
      '<path d="M12 4.4c4.3 0 7.8 2.7 7.8 6.1s-3.5 6.1-7.8 6.1c-.8 0-1.6-.1-2.4-.3l-4.2 2.1 1.1-2.8C4.9 14.6 4.2 13 4.2 10.5 4.2 7.1 7.7 4.4 12 4.4z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/>' },

    NFLX:  { name: 'Netflix',    color: '#FF5C5C', px: '672.10', d: -1.8, art:
      '<circle cx="12" cy="12" r="8" fill="none" stroke="C" stroke-width="1.6"/><path d="M10.2 8.4 16.2 12l-6 3.6z" fill="C"/>' },

    GOLD:  { name: 'Gold',       color: '#E8C25A', px: '2,388',  d: 0.2, art:
      '<path d="M4.4 16.6h15.2l-2-6.2H6.4z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M7 13.4h10" stroke="C" stroke-width="1.4" stroke-linecap="round"/>' },

    SILVER:{ name: 'Silver',     color: '#CFD6DE', px: '28.44',  d: -0.3, art:
      '<path d="M3.6 12.4h8.2l-1.2-4H4.8z" fill="none" stroke="C" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M8.4 18.4h11.6l-1.5-4.6H9.9z" fill="none" stroke="C" stroke-width="1.5" stroke-linejoin="round"/>' },

    OIL:   { name: 'Crude oil',  color: '#9AA4B0', px: '78.30',  d: 1.9, art:
      '<path d="M12 3.8c3.4 4.2 5.6 6.7 5.6 9.4a5.6 5.6 0 0 1-11.2 0c0-2.7 2.2-5.2 5.6-9.4z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M9.4 13.6a2.6 2.6 0 0 0 2.6 2.6" stroke="C" stroke-width="1.3" stroke-linecap="round"/>' }
  };

  var TAPE = ['BTC', 'ETH', 'SOL', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOLD',
              'AMZN', 'GOOGL', 'META', 'DOGE', 'XRP', 'OIL', 'NFLX', 'SILVER'];

  var CHAINS = ['Robinhood', 'Ethereum', 'Base', 'BNB', 'Solana'];

  // value: total value in the bag, delta: 24h %, lev: leveraged market
  var BAGS = [
    { tick: 'BIG3',   name: 'The Big Three',   chain: 'Robinhood', legs: ['BTC','ETH','SOL'],                 value: 412600, delta: 4.2,  lev: true },
    { tick: 'MAG5',   name: 'Magnificent Five',chain: 'Robinhood', legs: ['AAPL','MSFT','NVDA','AMZN','GOOGL'],value: 396100, delta: 1.7,  lev: false },
    { tick: 'SILICON',name: 'Silicon Set',     chain: 'Robinhood', legs: ['NVDA','MSFT','AAPL'],               value: 264400, delta: 6.3,  lev: true },
    { tick: 'HARD',   name: 'Hard Money',      chain: 'Ethereum',  legs: ['GOLD','SILVER','BTC'],              value: 243900, delta: 0.4,  lev: false },
    { tick: 'CLOUD',  name: 'Cloud Rent',      chain: 'Base',      legs: ['MSFT','AMZN','GOOGL'],              value: 221750, delta: 2.9,  lev: true },
    { tick: 'DEGEN',  name: 'Degen Three',     chain: 'Solana',    legs: ['DOGE','SOL','XRP'],                 value: 96200,  delta: -5.1, lev: true },
    { tick: 'L1S',    name: 'Layer Ones',      chain: 'Ethereum',  legs: ['ETH','SOL','ADA','BNB'],            value: 187300, delta: 0.9,  lev: false },
    { tick: 'SCREEN', name: 'Screen Time',     chain: 'Base',      legs: ['NFLX','META','GOOGL'],              value: 174850, delta: 3.6,  lev: false },
    { tick: 'STORE',  name: 'Store of Value',  chain: 'Robinhood', legs: ['BTC','GOLD','SILVER'],              value: 331500, delta: 1.2,  lev: false },
    { tick: 'GRID',   name: 'Wheels and Chips',chain: 'Robinhood', legs: ['TSLA','NVDA','SILVER'],             value: 158900, delta: -2.4, lev: true },
    { tick: 'ORACLE', name: 'Oracle Set',      chain: 'BNB',       legs: ['LINK','ETH','BTC'],                 value: 74850,  delta: 3.1,  lev: false },
    { tick: 'DRILL',  name: 'Drill and Mint',  chain: 'Ethereum',  legs: ['OIL','GOLD','SILVER'],              value: 88100,  delta: -1.6, lev: false },
    { tick: 'CART',   name: 'Everything Store',chain: 'Robinhood', legs: ['AMZN','AAPL','TSLA'],               value: 205800, delta: 1.5,  lev: true },
    { tick: 'BLUE',   name: 'Blue Chip Five',  chain: 'Robinhood', legs: ['AAPL','MSFT','AMZN','GOOGL','META'],value: 288400, delta: 0.7,  lev: false },
    { tick: 'ALT4',   name: 'Alt Season',      chain: 'Solana',    legs: ['SOL','ADA','LINK','DOGE'],          value: 63400,  delta: 12.4, lev: true },
    { tick: 'HEDGE',  name: 'The Hedge',       chain: 'Base',      legs: ['GOLD','OIL','BTC','SILVER'],        value: 119600, delta: 2.1,  lev: false }
  ];

  var CATALOG = ['BTC', 'ETH', 'SOL', 'NVDA', 'TSLA', 'AAPL', 'GOLD', 'OIL'];

  var state = { filter: 'all', sort: 'new', query: '', picked: ['BTC', 'NVDA', 'GOLD'] };

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

  /* ---------- icons ---------- */

  function iconMarkup(sym) {
    var a = ASSETS[sym];
    var inner = a.art
      ? a.art.replace(/"C"/g, '"' + a.color + '"')
      : '<text x="12" y="16.6" text-anchor="middle" font-family="JetBrains Mono, monospace"' +
        ' font-size="13" font-weight="700" fill="' + a.color + '">' + a.g + '</text>';
    return '<svg class="bl-ic" viewBox="0 0 24 24" role="img" aria-label="' + a.name + '">' + inner + '</svg>';
  }

  function iconTile(sym, cls) {
    var a = ASSETS[sym];
    var tile = el('span', 'bl-tile' + (cls ? ' ' + cls : ''));
    tile.style.background = a.color + '1F';       // the asset's own colour, dialled right down
    tile.style.borderColor = a.color + '4D';
    tile.innerHTML = iconMarkup(sym);
    tile.title = a.name;
    return tile;
  }

  /* ---------- ticker tape ---------- */

  function renderTape() {
    var tape = $('tape');
    if (!tape) return;
    TAPE.forEach(function (sym) {
      var a = ASSETS[sym];
      var item = el('div', 'bl-tape-item');
      item.appendChild(iconTile(sym, 'bl-tile-sm'));
      item.appendChild(el('b', 'bl-neon', sym));
      item.appendChild(el('span', null, '$' + a.px));
      item.appendChild(el('span', 'bl-tape-delta ' + (a.d < 0 ? 'bl-down' : 'bl-up'), pct(a.d)));
      tape.appendChild(item);
    });
  }

  /* ---------- the board ---------- */

  function matching() {
    var q = state.query.trim().toLowerCase();
    return BAGS.filter(function (m) {
      if (state.filter === 'lev' && !m.lev) return false;
      if (state.filter === 'spot' && m.lev) return false;
      if (!q) return true;
      if (m.tick.toLowerCase().indexOf(q) > -1 || m.name.toLowerCase().indexOf(q) > -1) return true;
      return m.legs.some(function (s) {
        return s.toLowerCase().indexOf(q) > -1 || ASSETS[s].name.toLowerCase().indexOf(q) > -1;
      });
    });
  }

  function sorted(list) {
    var out = list.slice();
    if (state.sort === 'cap') out.sort(function (a, b) { return b.value - a.value; });
    else if (state.sort === 'delta') out.sort(function (a, b) { return b.delta - a.delta; });
    else if (state.sort === 'legs') out.sort(function (a, b) { return b.legs.length - a.legs.length; });
    return out; // 'new' keeps the authored order, newest first
  }

  function card(m) {
    var c = el('div', 'bl-mcard');

    var top = el('div', 'bl-mcard-top');
    var stack = el('div', 'bl-stack');
    m.legs.forEach(function (sym) { stack.appendChild(iconTile(sym)); });
    top.appendChild(stack);
    var badge = el('div', 'bl-badge');
    badge.appendChild(el('i'));
    badge.appendChild(el('span', null, m.chain));
    top.appendChild(badge);
    c.appendChild(top);

    var id = el('div');
    id.appendChild(el('div', 'bl-ticker bl-neon', '$' + m.tick));
    id.appendChild(el('div', 'bl-mcard-name', m.name));
    c.appendChild(id);

    var capWrap = el('div');
    var cap = el('div', 'bl-mcard-cap');
    cap.appendChild(el('div', 'bl-cap-num', money(m.value)));
    cap.appendChild(el('div', 'bl-cap-delta ' + (m.delta < 0 ? 'bl-down' : 'bl-up'), pct(m.delta)));
    capWrap.appendChild(cap);
    capWrap.appendChild(el('div', 'bl-label', 'Total value'));
    c.appendChild(capWrap);

    // the bar reads as "how full the bag is": legs held out of the five allowed
    var track = el('div', 'bl-track');
    var fill = el('div', 'bl-track-fill');
    fill.style.width = (m.legs.length / 5 * 100) + '%';
    track.appendChild(fill);
    c.appendChild(track);

    var foot = el('div', 'bl-mcard-foot');
    foot.appendChild(el('span', null, m.legs.join(' · ')));
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
      board.appendChild(el('div', 'bl-empty', 'Nothing matches that search.'));
      return;
    }
    list.forEach(function (m) { board.appendChild(card(m)); });
  }

  function renderCounts() {
    var lev = BAGS.filter(function (m) { return m.lev; }).length;
    $('cAll').textContent = BAGS.length;
    $('cLev').textContent = lev;
    $('cSpot').textContent = BAGS.length - lev;
  }

  function renderStats() {
    var total = BAGS.reduce(function (s, m) { return s + m.value; }, 0);
    var legs = BAGS.reduce(function (s, m) { return s + m.legs.length; }, 0);
    $('statLive').textContent = BAGS.length;
    $('statAssets').textContent = Object.keys(ASSETS).length;
    $('statValue').textContent = money(total);
    $('statChains').textContent = CHAINS.length;
    $('statLegs').textContent = (legs / BAGS.length).toFixed(1);
  }

  /* ---------- builder ---------- */

  function renderBuilder() {
    var chips = $('chips');
    var weights = $('weights');
    if (!chips || !weights) return;

    chips.textContent = '';
    CATALOG.forEach(function (sym) {
      var on = state.picked.indexOf(sym) > -1;
      var chip = el('div', 'bl-chip' + (on ? ' is-on' : ''));
      chip.appendChild(iconTile(sym, 'bl-tile-sm'));
      chip.appendChild(el('span', null, sym));
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      function toggle() {
        var i = state.picked.indexOf(sym);
        if (i > -1) {
          if (state.picked.length > 3) state.picked.splice(i, 1);
        } else if (state.picked.length < 5) {
          state.picked.push(sym);
        }
        renderBuilder();
      }
      chip.addEventListener('click', toggle);
      chip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
      chips.appendChild(chip);
    });

    var share = 100 / state.picked.length;
    weights.textContent = '';
    state.picked.forEach(function (sym) {
      var row = el('div', 'bl-weight');
      row.appendChild(iconTile(sym, 'bl-tile-sm'));
      row.appendChild(el('div', 'bl-weight-name bl-neon', sym));
      var track = el('div', 'bl-weight-track');
      var fill = el('div', 'bl-weight-fill');
      fill.style.width = share + '%';
      fill.style.background = ASSETS[sym].color;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'bl-weight-pct', share.toFixed(0) + '%'));
      weights.appendChild(row);
    });

    var n = state.picked.length;
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
        tabs.querySelectorAll('.bl-tab').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
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
