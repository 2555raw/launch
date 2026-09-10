/* Markets — desktop behaviour: terms gate, entrance animation, charts, live quotes.
   No dependencies. All quotes are generated in the browser. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var STORE = { terms: "markets.terms.v1", theme: "markets.theme" };

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* private mode */ } }

  /* ------------------------------------------------------------------ data */

  var ASSETS = [
    { sym: "AAPL",  name: "Apple Inc.",            venue: "NASDAQ", type: "stock",     price: 232.14, cap: "3.52T", vol: 1 },
    { sym: "MSFT",  name: "Microsoft Corp.",       venue: "NASDAQ", type: "stock",     price: 428.90, cap: "3.19T", vol: 1 },
    { sym: "NVDA",  name: "NVIDIA Corp.",          venue: "NASDAQ", type: "stock",     price: 121.44, cap: "2.98T", vol: 1.6 },
    { sym: "TSLA",  name: "Tesla Inc.",            venue: "NASDAQ", type: "stock",     price: 246.38, cap: "786.4B", vol: 2 },
    { sym: "AMZN",  name: "Amazon.com Inc.",       venue: "NASDAQ", type: "stock",     price: 186.72, cap: "1.94T", vol: 1.2 },
    { sym: "META",  name: "Meta Platforms Inc.",   venue: "NASDAQ", type: "stock",     price: 552.10, cap: "1.40T", vol: 1.3 },
    { sym: "BTC",   name: "Bitcoin",               venue: "Crypto", type: "crypto",    price: 63820.00, cap: "1.26T", vol: 2.4 },
    { sym: "ETH",   name: "Ethereum",              venue: "Crypto", type: "crypto",    price: 2486.40, cap: "299.1B", vol: 2.6 },
    { sym: "SOL",   name: "Solana",                venue: "Crypto", type: "crypto",    price: 148.22, cap: "69.4B",  vol: 3.4 },
    { sym: "SPY",   name: "S&P 500 ETF Trust",     venue: "NYSE",   type: "etf",       price: 563.18, cap: "584.2B", vol: .6 },
    { sym: "QQQ",   name: "Invesco QQQ Trust",     venue: "NASDAQ", type: "etf",       price: 478.65, cap: "302.7B", vol: .8 },
    { sym: "VTI",   name: "Vanguard Total Market", venue: "NYSE",   type: "etf",       price: 279.34, cap: "428.9B", vol: .5 },
    { sym: "XAU",   name: "Gold (spot, oz)",       venue: "COMEX",  type: "commodity", price: 2612.80, cap: "—",     vol: .7 },
    { sym: "XAG",   name: "Silver (spot, oz)",     venue: "COMEX",  type: "commodity", price: 31.24,  cap: "—",      vol: 1.4 },
    { sym: "WTI",   name: "Crude Oil WTI (bbl)",   venue: "NYMEX",  type: "commodity", price: 71.86,  cap: "—",      vol: 1.8 }
  ];

  var RANGES = { "1D": { n: 78,  step: .0022 }, "1W": { n: 120, step: .0042 },
                 "1M": { n: 150, step: .0065 }, "1Y": { n: 220, step: .0125 } };

  // Each tab is its own view: its own heading, its own figures in the sidebar and
  // in the strip above the cards, its own accent, and its own featured chart.
  var CLASSES = {
    all: {
      label: "Watchlist", accent: "#0a84ff",
      blurb: "Everything you follow, across every class.",
      status: "Markets open",
      meta: [["S&P 500", 0.62], ["Nasdaq", 0.94], ["VIX", -3.10]],
      stats: function () {
        var up = ASSETS.filter(function (a) { return a.change >= 0; }).length;
        return [["Assets", ASSETS.length], ["Advancing", up], ["Declining", ASSETS.length - up], ["Classes", "4"]];
      }
    },
    stock: {
      label: "Stocks", accent: "#5e9cff",
      blurb: "US large caps, priced through the regular session.",
      status: "Regular session · closes 4:00 PM ET",
      meta: [["S&P 500", 0.62], ["Nasdaq", 0.94], ["Dow 30", 0.21]],
      stats: function () {
        return [["Advancers", "312"], ["Decliners", "188"], ["Session volume", "4.1B sh"], ["Median spread", "1.2 bps"]];
      }
    },
    crypto: {
      label: "Crypto", accent: "#ff9f0a",
      blurb: "Spot pairs, quoted around the clock.",
      status: "Trading 24/7 · no close",
      meta: [["BTC 24h", 6.16], ["ETH 24h", 0.33], ["Total cap 24h", 3.41]],
      stats: function () {
        return [["Total cap", "$2.31T"], ["BTC dominance", "54.2%"], ["24h volume", "$98.4B"], ["Funding, 8h", "+0.011%"]];
      }
    },
    etf: {
      label: "ETFs", accent: "#40cbe0",
      blurb: "Index funds, with the fees and flows behind them.",
      status: "Regular session · NAV struck at 4:00 PM ET",
      meta: [["SPY 24h", -0.16], ["QQQ 24h", -1.48], ["VTI 24h", -0.19]],
      stats: function () {
        return [["Net flows, 1W", "+$4.8B"], ["Average fee", "0.05%"], ["Tracking difference", "0.02%"], ["Premium to NAV", "0.01%"]];
      }
    },
    commodity: {
      label: "Commodities", accent: "#ffc83d",
      blurb: "Spot metals and energy, in dollars per unit.",
      status: "Globex open · settles 5:00 PM ET",
      meta: [["Gold 24h", -0.67], ["WTI 24h", -1.90], ["Dollar index", 0.18]],
      stats: function () {
        return [["Dollar index", "101.42"], ["US 10Y", "4.12%"], ["Gold / silver", "83.6"], ["Contango, 3M", "+0.8%"]];
      }
    }
  };

  // Deterministic pseudo-random so a symbol always draws the same shape.
  function seeded(seed) {
    var s = 0;
    for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function makeSeries(asset, range) {
    var cfg = RANGES[range];
    var rnd = seeded(asset.sym + range);
    var drift = (rnd() - 0.45) * cfg.step * 0.35 * asset.vol;
    var out = [];
    var v = asset.price / (1 + drift * cfg.n);
    for (var i = 0; i < cfg.n; i++) {
      v = v * (1 + drift + (rnd() - 0.5) * cfg.step * asset.vol);
      out.push(v);
    }
    out[out.length - 1] = asset.price;
    return out;
  }

  ASSETS.forEach(function (a) {
    a.series = {};
    Object.keys(RANGES).forEach(function (r) { a.series[r] = makeSeries(a, r); });
    var s = a.series["1D"];
    a.open = s[0];
    a.change = ((a.price - a.open) / a.open) * 100;
    a.high = Math.max.apply(null, s);
    a.low = Math.min.apply(null, s);
  });

  function money(v) {
    var d = v >= 1000 ? 2 : v >= 1 ? 2 : 4;
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%"; }

  /* ------------------------------------------------------------------ state */

  var state = { filter: "all", query: "", sort: "symbol", dir: 1, selected: "AAPL", range: "1D" };

  function visible() {
    var q = state.query.toLowerCase();
    return ASSETS.filter(function (a) {
      if (state.filter !== "all" && a.type !== state.filter) return false;
      if (!q) return true;
      return a.sym.toLowerCase().indexOf(q) > -1 || a.name.toLowerCase().indexOf(q) > -1;
    }).sort(function (x, y) {
      var k = state.sort, a = x[k], b = y[k];
      if (k === "cap") { a = capNum(x.cap); b = capNum(y.cap); }
      if (typeof a === "string") return a.localeCompare(b) * state.dir;
      return (a - b) * state.dir;
    });
  }
  function capNum(c) {
    if (!c || c === "—") return -1;
    var mult = { T: 1e12, B: 1e9, M: 1e6 }[c.slice(-1)] || 1;
    return parseFloat(c) * mult;
  }
  function byId(sym) { return ASSETS.filter(function (a) { return a.sym === sym; })[0]; }

  /* ------------------------------------------------------------------ sparkline path */

  function pathFor(series, w, h, pad) {
    pad = pad || 2;
    var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
    var span = (max - min) || 1;
    return series.map(function (p, i) {
      var x = (i / (series.length - 1)) * w;
      var y = h - pad - ((p - min) / span) * (h - pad * 2);
      return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }).join("");
  }

  function sparkSVG(asset, w, h) {
    var s = asset.series["1D"];
    var color = asset.change >= 0 ? "var(--green)" : "var(--red)";
    return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + pathFor(s, w, h, 3) + '" fill="none" stroke="' + color + '" stroke-width="1.8" ' +
      'stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ------------------------------------------------------------------ cards */

  var cardsEl = $("#cards"), rowsEl = $("#rows"), countEl = $("#cardCount");

  function renderCards() {
    var list = visible();
    countEl.textContent = list.length + (list.length === 1 ? " asset" : " assets");
    cardsEl.innerHTML = list.map(function (a) {
      var dirCls = a.change >= 0 ? "up" : "down";
      return '<button class="card' + (a.sym === state.selected ? " on" : "") + '" type="button" data-sym="' + a.sym + '">' +
        '<div class="card-top"><span class="card-sym"><span class="asset-badge sm">' + a.sym.slice(0, 3) + "</span>" + a.sym + "</span>" +
        '<span class="card-chg ' + dirCls + '">' + pct(a.change) + "</span></div>" +
        '<div class="card-name">' + a.name + "</div>" +
        '<div class="card-price">' + money(a.price) + "</div>" +
        '<div class="card-spark">' + sparkSVG(a, 200, 38) + "</div>" +
        "</button>";
    }).join("");
  }

  function renderRows() {
    rowsEl.innerHTML = visible().map(function (a) {
      return '<tr data-sym="' + a.sym + '"' + (a.sym === state.selected ? ' class="on"' : "") + ">" +
        '<td><span class="row-sym"><span class="asset-badge xs">' + a.sym.slice(0, 3) + "</span>" + a.sym + "</span></td>" +
        "<td>" + a.name + '<span class="hide-sm"> · ' + a.venue + "</span></td>" +
        '<td class="num price">' + money(a.price) + "</td>" +
        '<td class="num change ' + (a.change >= 0 ? "up" : "down") + '">' + pct(a.change) + "</td>" +
        '<td class="num hide-sm">' + a.cap + "</td>" +
        '<td class="num hide-sm"><span class="row-spark">' + sparkSVG(a, 84, 26) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  /* ------------------------------------------------------------------ hero chart */

  var chart = $("#chart"), line = $("#linePath"), area = $("#areaPath"), gridG = $("#grid");
  var cross = $("#cross"), crossLine = $("#crossLine"), crossDot = $("#crossDot"), tip = $("#tip");
  var heroCard = $("#heroCard");
  var CW = 800, CH = 260;
  var current = null, drawTimer = null;

  function drawGrid() {
    var html = "";
    for (var i = 1; i < 4; i++) {
      var y = (CH / 4) * i;
      html += '<line x1="0" y1="' + y + '" x2="' + CW + '" y2="' + y + '"/>';
    }
    gridG.innerHTML = html;
  }

  function renderHero(animate) {
    var a = byId(state.selected);
    current = a;
    var s = a.series[state.range];
    // 1D is measured from the session open so the chart, the cards and the table agree.
    var base = state.range === "1D" ? a.open : s[0];
    var last = s[s.length - 1];
    var abs = last - base;
    var chg = (abs / base) * 100;

    $("#heroBadge").textContent = a.sym.slice(0, 4);
    $("#heroSym").textContent = a.sym;
    $("#heroName").textContent = a.name + " · " + a.venue;
    $("#heroPrice").textContent = money(a.price);
    var delta = $("#heroDelta");
    delta.textContent = (abs >= 0 ? "+" : "−") + money(Math.abs(abs)) + " (" + pct(chg) + ")";
    delta.className = "delta " + (chg >= 0 ? "up" : "down");
    heroCard.classList.toggle("falling", chg < 0);

    var d = pathFor(s, CW, CH, 12);
    line.setAttribute("d", d);
    area.setAttribute("d", d + "L" + CW + "," + CH + "L0," + CH + "Z");

    if (animate && !reduced) {
      var len = line.getTotalLength();
      heroCard.classList.remove("drawing");
      heroCard.style.setProperty("--len", len);
      void heroCard.offsetWidth;
      heroCard.classList.add("drawing");
      clearTimeout(drawTimer);
      drawTimer = setTimeout(function () { heroCard.classList.remove("drawing"); }, 1300);
    }

    $("#heroStats").innerHTML = [
      ["Open", money(a.open)], ["High", money(a.high)], ["Low", money(a.low)],
      ["Market cap", a.cap], ["Class", a.type.charAt(0).toUpperCase() + a.type.slice(1)]
    ].map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join("");
  }

  function select(sym, animate) {
    if (!byId(sym)) return;
    state.selected = sym;
    $$(".card").forEach(function (c) { c.classList.toggle("on", c.dataset.sym === sym); });
    $$("#rows tr").forEach(function (r) { r.classList.toggle("on", r.dataset.sym === sym); });
    renderHero(animate !== false);
  }

  /* crosshair */
  chart.addEventListener("pointermove", function (e) {
    if (!current) return;
    var box = chart.getBoundingClientRect();
    var s = current.series[state.range];
    var ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    var idx = Math.round(ratio * (s.length - 1));
    var min = Math.min.apply(null, s), max = Math.max.apply(null, s), span = (max - min) || 1;
    var x = (idx / (s.length - 1)) * CW;
    var y = CH - 12 - ((s[idx] - min) / span) * (CH - 24);

    cross.classList.remove("hidden");
    crossLine.setAttribute("x1", x); crossLine.setAttribute("x2", x);
    crossDot.setAttribute("cx", x); crossDot.setAttribute("cy", y);

    tip.hidden = false;
    tip.innerHTML = money(s[idx]) + "<small>" + label(idx, s.length) + "</small>";
    tip.style.left = (ratio * box.width) + "px";
    tip.style.top = ((y / CH) * box.height) + "px";
  });
  chart.addEventListener("pointerleave", function () {
    cross.classList.add("hidden");
    tip.hidden = true;
  });

  function label(i, n) {
    var back = n - 1 - i;
    if (state.range === "1D") { var m = back * 5; return m === 0 ? "now" : m + " min ago"; }
    if (state.range === "1W") return (back / 17).toFixed(1) + " d ago";
    if (state.range === "1M") return Math.round(back / 5) + " d ago";
    return Math.round(back / 18) + " mo ago";
  }

  /* ------------------------------------------------------------------ events */

  cardsEl.addEventListener("click", function (e) {
    var card = e.target.closest(".card");
    if (card) select(card.dataset.sym);
  });
  rowsEl.addEventListener("click", function (e) {
    var tr = e.target.closest("tr");
    if (tr) { select(tr.dataset.sym); $("#heroCard").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); }
  });

  var featured = {};   // per class: how far down its list the last press got

  function renderClass(f) {
    var cfg = CLASSES[f];
    $("#blockTitle").textContent = cfg.label;
    $("#blockBlurb").textContent = cfg.blurb;
    $("#sideStatus").textContent = cfg.status;
    $(".window").style.setProperty("--accent", cfg.accent);

    $("#classStats").innerHTML = cfg.stats().map(function (row) {
      return '<dl class="class-stat"><dt>' + row[0] + "</dt><dd>" + row[1] + "</dd></dl>";
    }).join("");

    $("#sideMeta").innerHTML = cfg.meta.map(function (row, i) {
      return '<div class="side-meta"><span>' + row[0] + '</span><b data-meta="' + i + '"></b></div>';
    }).join("");
    paintMeta();
  }

  function paintMeta() {
    var rows = CLASSES[state.filter].meta;
    $$("#sideMeta b").forEach(function (el, i) {
      el.textContent = pct(rows[i][1]);
      el.className = rows[i][1] >= 0 ? "up" : "down";
    });
  }

  // Pressing a tab also moves the chart on: the first press features the class's
  // biggest mover, each press after that steps to the next asset in it.
  function feature(f) {
    var list = visible().slice().sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); });
    if (!list.length) return;
    var i = featured[f] || 0;
    featured[f] = i + 1;
    select(list[i % list.length].sym);
  }

  function hashFilter() {
    var h = (window.location.hash || "").replace("#", "");
    return CLASSES[h] ? h : null;
  }

  function setFilter(f) {
    state.filter = f;
    try { window.history.replaceState(null, "", "#" + f); } catch (e) { /* sandboxed */ }
    $$(".seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.filter === f); });
    $$(".side-item").forEach(function (b) { b.classList.toggle("on", b.dataset.filter === f); });
    renderClass(f);
    renderCards(); renderRows();
    feature(f);
  }

  $$(".seg button").forEach(function (b) {
    b.addEventListener("click", function () { setFilter(b.dataset.filter); });
  });
  $$(".side-item").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.filter) return setFilter(b.dataset.filter);
      state.sort = "change"; state.dir = -1;
      $$(".side-item").forEach(function (o) { o.classList.remove("on"); });
      b.classList.add("on");
      markSorted(); renderCards(); renderRows();
    });
  });

  $("#search").addEventListener("input", function (e) {
    state.query = e.target.value.trim();
    renderCards(); renderRows();
  });

  $$("th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.dataset.sort;
      if (state.sort === key) state.dir *= -1; else { state.sort = key; state.dir = key === "symbol" || key === "name" ? 1 : -1; }
      markSorted(); renderCards(); renderRows();
    });
  });
  function markSorted() {
    $$("th[data-sort]").forEach(function (th) {
      th.classList.toggle("sorted", th.dataset.sort === state.sort);
      th.classList.toggle("asc", th.dataset.sort === state.sort && state.dir === 1);
    });
  }

  $$("#ranges button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#ranges button").forEach(function (o) { o.classList.remove("on"); });
      b.classList.add("on");
      state.range = b.dataset.range;
      renderHero(true);
    });
  });

  /* dock */
  $$(".dock-app[data-scroll]").forEach(function (b) {
    b.addEventListener("click", function () {
      var map = { top: "#heroCard", cards: "#cards", rows: "#rows" };
      var el = $(map[b.dataset.scroll]);
      if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    });
  });

  /* ------------------------------------------------------------------ clock */

  function tickClock() {
    var d = new Date();
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    $("#clock").textContent = days[d.getDay()] + " " + h + ":" + m + " " + ap;
  }
  tickClock();
  setInterval(tickClock, 20000);

  /* ------------------------------------------------------------------ theme */

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    write(STORE.theme, t);
  }
  var savedTheme = read(STORE.theme);
  if (savedTheme) setTheme(savedTheme);
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");

  function flipTheme() {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }
  $("#themeBtn").addEventListener("click", flipTheme);
  $("#dockTheme").addEventListener("click", flipTheme);
  $$('[data-action="theme"]').forEach(function (b) { b.addEventListener("click", flipTheme); });

  /* ------------------------------------------------------------------ live quotes */

  function stepQuote(a) {
    var move = (Math.random() - 0.5) * 0.0016 * a.vol;
    var next = a.price * (1 + move);
    var dir = next > a.price ? 1 : -1;
    a.price = next;
    a.series["1D"] = a.series["1D"].slice(1).concat([next]);
    a.change = ((a.price - a.open) / a.open) * 100;
    a.high = Math.max(a.high, next);
    a.low = Math.min(a.low, next);
    return dir;
  }

  function paintQuote(a, dir) {
    var card = cardsEl.querySelector('.card[data-sym="' + a.sym + '"]');
    if (card) {
      card.querySelector(".card-price").textContent = money(a.price);
      var chg = card.querySelector(".card-chg");
      chg.textContent = pct(a.change);
      chg.className = "card-chg " + (a.change >= 0 ? "up" : "down");
      card.querySelector(".card-spark").innerHTML = sparkSVG(a, 200, 38);
    }
    var row = rowsEl.querySelector('tr[data-sym="' + a.sym + '"]');
    if (row) {
      var priceCell = row.querySelector(".price");
      priceCell.textContent = money(a.price);
      priceCell.classList.remove("flash-up", "flash-down");
      void priceCell.offsetWidth;
      priceCell.classList.add(dir > 0 ? "flash-up" : "flash-down");
      var chgCell = row.querySelector(".change");
      chgCell.textContent = pct(a.change);
      chgCell.className = "num change " + (a.change >= 0 ? "up" : "down");
      row.querySelector(".row-spark").innerHTML = sparkSVG(a, 84, 26);
    }
    if (current && a.sym === current.sym) renderHero(false);
  }

  function startTicking() {
    if (reduced) return;
    setInterval(function () {
      var a = ASSETS[Math.floor(Math.random() * ASSETS.length)];
      paintQuote(a, stepQuote(a));
    }, 1200);

    setInterval(function () {
      CLASSES[state.filter].meta.forEach(function (row) { row[1] += (Math.random() - 0.5) * 0.08; });
      paintMeta();
    }, 4000);
  }

  /* ------------------------------------------------------------------ entrance */

  function enter() {
    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    var items = $$(".anim");
    items.forEach(function (el, i) {
      setTimeout(function () { el.classList.add("in"); }, reduced ? 0 : 420 + i * 110);
    });

    setTimeout(function () { renderHero(true); }, reduced ? 0 : 620);
    startTicking();
  }

  /* ------------------------------------------------------------------ wallet */

  // Read-only: the desk asks for the address, the chain and the balance, and
  // never proposes a transaction. Nothing is sent anywhere; it only labels the UI.
  var CHAINS = {
    "0x1": ["Ethereum", "ETH"], "0xa": ["Optimism", "ETH"], "0x38": ["BNB Chain", "BNB"],
    "0x89": ["Polygon", "POL"], "0xa4b1": ["Arbitrum One", "ETH"], "0x2105": ["Base", "ETH"],
    "0xa86a": ["Avalanche", "AVAX"], "0xaa36a7": ["Sepolia", "ETH"]
  };
  var AVATAR_TOKENS = ["--blue", "--violet", "--teal", "--orange", "--amber", "--green"];

  var walletModal = $("#walletModal"), walletBody = $("#walletBody"), walletNote = $("#walletNote");
  var walletMenuBtn = $("#walletMenuBtn"), walletMenuLabel = $("#walletMenuLabel");
  var walletGlyph = $("#walletGlyph"), walletAvatar = $("#walletAvatar");
  var walletDock = $("#walletDock"), walletDockDot = $("#walletDockDot");
  var walletAction = $("#walletAction"), walletLede = $("#walletLede");
  var wallet = { address: null, chain: null, balance: null };

  function eth() { return window.ethereum || null; }
  function shortAddr(a) { return a.slice(0, 6) + "\u2026" + a.slice(-4); }

  function avatarFor(address) {
    var n = 0;
    for (var i = 2; i < address.length; i++) n = (n * 31 + address.charCodeAt(i)) >>> 0;
    var a = AVATAR_TOKENS[n % AVATAR_TOKENS.length];
    var b = AVATAR_TOKENS[(n >> 3) % AVATAR_TOKENS.length];
    if (a === b) b = AVATAR_TOKENS[(n + 2) % AVATAR_TOKENS.length];
    return "linear-gradient(140deg, var(" + a + "), var(" + b + "))";
  }

  function fromWei(hex) {
    var wei = BigInt(hex);
    var unit = 1000000000000000000n;
    var frac = ((wei % unit) * 10000n) / unit;
    return (wei / unit).toString() + "." + frac.toString().padStart(4, "0");
  }

  function chainName(id) { return (CHAINS[id] || ["Chain " + parseInt(id, 16), "native"])[0]; }
  function chainSymbol(id) { return (CHAINS[id] || ["", "native"])[1]; }

  function renderWallet() {
    var has = !!eth();

    if (wallet.address) {
      walletLede.textContent = "Connected. Markets only reads this address; disconnecting clears it here.";
      walletBody.innerHTML =
        '<div class="wallet-list">' +
          '<div class="wallet-id">' +
            '<span class="wallet-avatar" style="background:' + avatarFor(wallet.address) + '"></span>' +
            '<span class="wallet-id-text"><b>' + shortAddr(wallet.address) + "</b><span>" + chainName(wallet.chain) + "</span></span>" +
            '<button class="wallet-mini" type="button" id="walletCopy">Copy</button>' +
          "</div>" +
          '<div class="wallet-row"><span>Balance</span><b>' +
            (wallet.balance === null ? "—" : wallet.balance + " " + chainSymbol(wallet.chain)) + "</b></div>" +
          '<div class="wallet-row"><span>Permissions</span><b>Read address only</b></div>' +
        "</div>" +
        '<p class="wallet-hint">Prices on this desk stay simulated. Connecting does not fund, trade or move anything.</p>';
      walletAction.textContent = "Disconnect";
      $("#walletCopy").addEventListener("click", copyAddress);
      return;
    }

    if (!has) {
      walletLede.textContent = "No wallet was detected in this browser.";
      walletBody.innerHTML =
        '<div class="wallet-list">' +
          '<div class="wallet-row"><span>Status</span><b>No provider found</b></div>' +
          '<div class="wallet-row"><span>Needs</span><b>MetaMask or similar</b></div>' +
        "</div>" +
        '<p class="wallet-hint">Install a browser wallet, or open this page in a wallet\u2019s own browser, then press Connect again.</p>';
      walletAction.textContent = "Connect";
      return;
    }

    walletLede.textContent = "Markets reads your address to label the desk. It never asks you to send a transaction.";
    walletBody.innerHTML =
      '<div class="wallet-list">' +
        '<div class="wallet-row"><span>Markets will read</span><b>Address &amp; chain</b></div>' +
        '<div class="wallet-row"><span>And also</span><b>Native balance</b></div>' +
        '<div class="wallet-row"><span>It will never ask for</span><b>A transaction</b></div>' +
      "</div>" +
      '<p class="wallet-hint">Your wallet will ask you to approve the connection. Nothing is stored on a server.</p>';
    walletAction.textContent = "Connect";
  }

  function paintWalletButton() {
    var on = !!wallet.address;
    var label = on ? shortAddr(wallet.address) : "Connect wallet";

    walletMenuBtn.classList.toggle("on", on);
    walletMenuBtn.title = label;
    walletMenuLabel.textContent = label;
    walletMenuLabel.hidden = !on;      // the glyph alone until there is an address to show
    walletGlyph.style.display = on ? "none" : "";
    walletAvatar.hidden = !on;
    if (on) walletAvatar.style.background = avatarFor(wallet.address);

    walletDock.dataset.tip = label;
    walletDockDot.hidden = !on;
  }

  function walletError(message) {
    walletNote.textContent = message;
    walletNote.hidden = false;
  }

  function refreshBalance() {
    if (!wallet.address || !eth()) return;
    eth().request({ method: "eth_getBalance", params: [wallet.address, "latest"] })
      .then(function (hex) { wallet.balance = fromWei(hex); renderWallet(); })
      .catch(function () { wallet.balance = null; });
  }

  function adopt(accounts, chain) {
    wallet.address = accounts && accounts.length ? accounts[0] : null;
    wallet.chain = chain || wallet.chain;
    wallet.balance = null;
    paintWalletButton();
    renderWallet();
    refreshBalance();
  }

  function connect() {
    var p = eth();
    if (!p) { walletError("No wallet provider in this browser."); return; }
    walletNote.hidden = true;
    walletAction.disabled = true;
    walletAction.textContent = "Waiting for wallet\u2026";

    p.request({ method: "eth_requestAccounts" })
      .then(function (accounts) {
        return p.request({ method: "eth_chainId" }).then(function (chain) { adopt(accounts, chain); });
      })
      .catch(function (err) {
        walletError(err && err.code === 4001 ? "You rejected the connection."
          : err && err.code === -32002 ? "Your wallet already has a request open."
          : "The wallet could not connect.");
        renderWallet();
      })
      .then(function () { walletAction.disabled = false; });
  }

  function disconnect() {
    wallet = { address: null, chain: null, balance: null };
    paintWalletButton();
    renderWallet();
    walletNote.textContent = "Disconnected here. Your wallet may still list this site under its connections.";
    walletNote.hidden = false;
  }

  function copyAddress() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(wallet.address).then(function () {
      var btn = $("#walletCopy");
      if (btn) { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1400); }
    });
  }

  function openWallet() {
    walletNote.hidden = true;
    renderWallet();
    walletModal.style.display = "";
    walletModal.classList.remove("gone");
  }
  walletMenuBtn.addEventListener("click", openWallet);
  walletDock.addEventListener("click", openWallet);
  $("#walletClose").addEventListener("click", function () {
    walletModal.classList.add("gone");
    setTimeout(function () { walletModal.style.display = "none"; }, 420);
  });
  walletAction.addEventListener("click", function () {
    if (wallet.address) disconnect(); else connect();
  });

  if (eth()) {
    // Restore a connection the wallet already granted, without prompting.
    eth().request({ method: "eth_accounts" }).then(function (accounts) {
      if (!accounts || !accounts.length) return;
      return eth().request({ method: "eth_chainId" }).then(function (chain) { adopt(accounts, chain); });
    }).catch(function () { /* provider refused a silent read */ });

    eth().on && eth().on("accountsChanged", function (accounts) { adopt(accounts, wallet.chain); });
    eth().on && eth().on("chainChanged", function (chain) { wallet.chain = chain; wallet.balance = null; renderWallet(); refreshBalance(); });
  }

  paintWalletButton();
  renderWallet();

  /* ------------------------------------------------------------------ terms gate */

  var modal = $("#modal"), sheet = $("#sheet"), agree = $("#agree");
  var acceptBtn = $("#acceptBtn"), declineBtn = $("#declineBtn"), note = $("#sheetNote");

  agree.addEventListener("change", function () {
    acceptBtn.disabled = !agree.checked;
    if (agree.checked) note.hidden = true;
  });

  function closeModal() {
    modal.classList.add("gone");
    setTimeout(function () { modal.style.display = "none"; }, 420);
  }

  acceptBtn.addEventListener("click", function () {
    write(STORE.terms, new Date().toISOString());
    closeModal();
    enter();
  });

  declineBtn.addEventListener("click", function () {
    note.hidden = false;
    sheet.classList.remove("shake");
    void sheet.offsetWidth;
    sheet.classList.add("shake");
  });

  function openModal() {
    modal.style.display = "";
    modal.classList.remove("gone");
    agree.checked = false;
    acceptBtn.disabled = true;
    note.hidden = true;
    setTimeout(function () { agree.focus(); }, 260);
  }
  $("#dockTerms").addEventListener("click", openModal);
  $$('[data-action="terms"]').forEach(function (b) { b.addEventListener("click", openModal); });

  /* ------------------------------------------------------------------ boot */

  drawGrid();
  markSorted();

  var opening = hashFilter();
  if (opening) {
    setFilter(opening);          // a linked tab opens on its own class, chart included
  } else {
    renderClass(state.filter);
    renderCards();
    renderRows();
    renderHero(false);
  }

  if (read(STORE.terms)) {
    closeModal();
    enter();
  } else {
    setTimeout(function () { agree.focus(); }, 500);
  }
})();
