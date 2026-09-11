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
    $$("#heat button").forEach(function (t) { t.classList.toggle("on", t.dataset.sym === sym); });
    paintHeroPosition();
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

  function setRange(r) {
    state.range = r;
    $$("#ranges button").forEach(function (o) { o.classList.toggle("on", o.dataset.range === r); });
    renderHero(true);
  }
  $$("#ranges button").forEach(function (b) {
    b.addEventListener("click", function () { setRange(b.dataset.range); });
  });

  /* dock */
  $$(".dock-app[data-scroll]").forEach(function (b) {
    b.addEventListener("click", function () {
      var map = { top: "#heroCard", cards: "#cards", rows: "#rows" };
      var el = $(map[b.dataset.scroll]);
      if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    });
  });

  /* ------------------------------------------------------------------ live coin */

  // A fast lane of its own: while the page is open this streams a point a second
  // for the coin on show, off the same generated feed as the rest of the desk.
  var LIVE_POINTS = 90;
  var live = { sym: "BTC", series: [], last: 0, ticks: [], since: Date.now() };
  var liveBlock = $("#liveBlock");
  var liveLine = $("#liveLine"), liveArea = $("#liveArea"), liveHead = $("#liveHead");
  var LW = 420, LH = 150;

  function liveAsset() { return byId(live.sym); }

  function seedLive() {
    var a = liveAsset();
    live.series = a.series["1D"].slice(-LIVE_POINTS);
    live.last = a.price;
    live.ticks = [];
    live.since = Date.now();
    $("#liveName").textContent = a.name;
    $("#liveTape").innerHTML = "";
    drawLive();
    paintLiveNumbers(0);
  }

  function drawLive() {
    var s = live.series;
    if (s.length < 2) return;
    var min = Math.min.apply(null, s), max = Math.max.apply(null, s);
    var span = (max - min) || 1;
    var pts = s.map(function (p, i) {
      var x = (i / (s.length - 1)) * LW;
      var y = LH - 8 - ((p - min) / span) * (LH - 20);
      return [x, y];
    });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
    liveLine.setAttribute("d", d);
    liveArea.setAttribute("d", d + "L" + LW + "," + LH + "L0," + LH + "Z");
    var head = pts[pts.length - 1];
    liveHead.setAttribute("cx", head[0].toFixed(1));
    liveHead.setAttribute("cy", head[1].toFixed(1));
  }

  function paintLiveNumbers(dir) {
    var a = liveAsset();
    var price = $("#livePrice");
    price.textContent = money(a.price);
    if (dir) {
      price.classList.remove("tick-up", "tick-down");
      void price.offsetWidth;
      price.classList.add(dir > 0 ? "tick-up" : "tick-down");
    }

    var change = $("#liveChange");
    change.textContent = pct(a.change) + " today";
    change.className = "live-change " + (a.change >= 0 ? "up" : "down");
    liveBlock.classList.toggle("falling", a.change < 0);

    var s = live.series;
    $("#liveStats").innerHTML = [
      ["Session high", money(Math.max.apply(null, s))],
      ["Session low", money(Math.min.apply(null, s))],
      ["Market cap", a.cap],
      ["Venue", a.venue]
    ].map(function (row) { return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>"; }).join("");
  }

  function liveTick() {
    var a = liveAsset();
    var next = a.price * (1 + (Math.random() - 0.5) * 0.0016 * a.vol);
    var dir = next > a.price ? 1 : -1;

    a.price = next;
    a.series["1D"] = a.series["1D"].slice(1).concat([next]);
    a.change = ((a.price - a.open) / a.open) * 100;
    a.high = Math.max(a.high, next);
    a.low = Math.min(a.low, next);

    live.series.push(next);
    if (live.series.length > LIVE_POINTS) live.series.shift();
    live.since = Date.now();

    drawLive();
    paintLiveNumbers(dir);
    pushTape(next, dir);

    // the rest of the desk shows the same asset, so keep it in step
    repaintHeatTile(a);
    var card = cardsEl.querySelector('.card[data-sym="' + a.sym + '"]');
    if (card) paintQuote(a, dir);
  }

  function pushTape(price, dir) {
    var tape = $("#liveTape");
    var chip = document.createElement("span");
    chip.className = dir > 0 ? "up" : "down";
    chip.textContent = (dir > 0 ? "▲ " : "▼ ") + money(price);
    tape.insertBefore(chip, tape.firstChild);
    while (tape.children.length > 8) tape.removeChild(tape.lastChild);
  }

  function paintLiveAgo() {
    var secs = Math.round((Date.now() - live.since) / 1000);
    $("#liveAgo").textContent = secs <= 1 ? "just now" : secs + "s ago";
  }

  $$("#liveSeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#liveSeg button").forEach(function (o) { o.classList.toggle("on", o === b); });
      live.sym = b.dataset.coin;
      seedLive();
    });
  });

  function startLive() {
    seedLive();
    if (reduced) return;
    setInterval(liveTick, 1000);
    setInterval(paintLiveAgo, 1000);
  }

  /* ------------------------------------------------------------------ session */

  // A desk clock on the viewer's own time: 9:30 to 16:00 is the regular session.
  var OPEN_MIN = 9 * 60 + 30, CLOSE_MIN = 16 * 60;

  function paintSession() {
    var now = new Date();
    var minutes = now.getHours() * 60 + now.getMinutes();
    var weekend = now.getDay() === 0 || now.getDay() === 6;
    var phase = $("#sessionPhase"), left = $("#sessionLeft"), bar = $("#sessionBar");

    function gap(mins) {
      var h = Math.floor(mins / 60), m = mins % 60;
      return (h ? h + "h " : "") + m + "m";
    }

    if (weekend) {
      phase.textContent = "Weekend";
      left.textContent = "crypto only";
      bar.style.width = "0%";
      return;
    }
    if (minutes < OPEN_MIN) {
      phase.textContent = "Pre-market";
      left.textContent = "in " + gap(OPEN_MIN - minutes);
      bar.style.width = "0%";
    } else if (minutes < CLOSE_MIN) {
      phase.textContent = "Regular session";
      left.textContent = gap(CLOSE_MIN - minutes) + " left";
      bar.style.width = (((minutes - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * 100).toFixed(1) + "%";
    } else {
      phase.textContent = "After hours";
      left.textContent = "in " + gap(24 * 60 - minutes + OPEN_MIN);
      bar.style.width = "100%";
    }
  }

  /* ------------------------------------------------------------------ heatmap */

  var heatEl = $("#heat");

  function heatTile(a) {
    var strength = Math.min(34, 8 + Math.abs(a.change) * 7).toFixed(0);
    var token = a.change >= 0 ? "--green" : "--red";
    return '<button type="button" data-sym="' + a.sym + '"' + (a.sym === state.selected ? ' class="on"' : "") +
      ' style="background:color-mix(in srgb, var(' + token + ') ' + strength + '%, transparent)">' +
      "<b>" + a.sym + '</b><span style="color:var(' + token + ')">' + pct(a.change) + "</span></button>";
  }

  function renderHeat() {
    heatEl.innerHTML = ASSETS.map(heatTile).join("");
  }

  function repaintHeatTile(a) {
    var tile = heatEl.querySelector('[data-sym="' + a.sym + '"]');
    if (tile) tile.outerHTML = heatTile(a);
  }

  heatEl.addEventListener("click", function (e) {
    var tile = e.target.closest("button[data-sym]");
    if (tile) select(tile.dataset.sym);
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
  paintSession();
  setInterval(function () { tickClock(); paintSession(); }, 20000);

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
    repaintHeatTile(a);
    if (folioModal.style.display !== "none" && !folioModal.classList.contains("gone")) renderFolio();
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
    startLive();
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
    loadBook();
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
    loadBook();
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

  /* ------------------------------------------------------------------ book */

  // A paper book. The quotes are generated in the browser, so a fill records
  // what you would have done; it is kept locally, per connected address, and
  // never touches a balance.
  var book = { positions: {}, fills: [], realized: 0 };
  var ticketSide = "buy";

  var tradeModal = $("#tradeModal"), folioModal = $("#folioModal");
  var folioDock = $("#folioDock"), folioDockDot = $("#folioDockDot");

  function bookKey() { return "markets.book." + (wallet.address || "guest"); }

  function loadBook() {
    var raw = read(bookKey());
    try { book = raw ? JSON.parse(raw) : { positions: {}, fills: [], realized: 0 }; }
    catch (e) { book = { positions: {}, fills: [], realized: 0 }; }
    if (!book.positions) book.positions = {};
    if (!book.fills) book.fills = [];
    if (typeof book.realized !== "number") book.realized = 0;
    paintBook();
  }
  function saveBook() { write(bookKey(), JSON.stringify(book)); }

  function positionOf(sym) { return book.positions[sym] || null; }
  function heldQty(sym) { var p = positionOf(sym); return p ? p.qty : 0; }

  function marketValue() {
    return Object.keys(book.positions).reduce(function (sum, sym) {
      var a = byId(sym);
      return sum + (a ? a.price * book.positions[sym].qty : 0);
    }, 0);
  }
  function openPnl() {
    return Object.keys(book.positions).reduce(function (sum, sym) {
      var a = byId(sym), p = book.positions[sym];
      return sum + (a ? (a.price - p.avg) * p.qty : 0);
    }, 0);
  }
  // Aggregates are dollars, so they keep two decimals whatever the unit price does.
  function dollars(v) {
    return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function signed(v) { return (v >= 0 ? "+$" : "−$") + dollars(Math.abs(v)); }

  /* ---- ticket ---- */

  function openTicket(side) {
    if (!wallet.address) { openWallet(); toast("Connect a wallet to trade this book."); return; }
    ticketSide = side;
    var a = byId(state.selected);
    $("#tradeTitle").textContent = (side === "buy" ? "Buy " : "Sell ") + a.sym;
    $("#ticketAsset").textContent = a.sym + " · " + a.name;
    $("#ticketPrice").textContent = money(a.price);
    $("#ticketAccount").textContent = shortAddr(wallet.address);
    $("#ticketHeld").textContent = heldQty(a.sym) ? heldQty(a.sym) + " @ " + money(positionOf(a.sym).avg) : "nothing yet";
    var submit = $("#tradeSubmit");
    submit.textContent = side === "buy" ? "Fill buy" : "Fill sell";
    submit.className = "btn " + (side === "buy" ? "btn-green" : "btn-red");
    $("#tradeNote").hidden = true;
    $("#ticketQty").value = side === "sell" && heldQty(a.sym) ? heldQty(a.sym) : 1;
    paintNotional();
    tradeModal.style.display = "";
    tradeModal.classList.remove("gone");
    setTimeout(function () { $("#ticketQty").focus(); }, 240);
  }

  function closeTicket() {
    tradeModal.classList.add("gone");
    setTimeout(function () { tradeModal.style.display = "none"; }, 420);
  }

  function paintNotional() {
    var a = byId(state.selected);
    var qty = parseFloat($("#ticketQty").value) || 0;
    $("#ticketNotional").textContent = "$" + dollars(qty * a.price);
  }

  function fillOrder() {
    var a = byId(state.selected);
    var qty = parseFloat($("#ticketQty").value);
    var note = $("#tradeNote");

    if (!qty || qty <= 0) { note.textContent = "Enter a quantity above zero."; note.hidden = false; return; }
    if (ticketSide === "sell" && qty > heldQty(a.sym) + 1e-9) {
      note.textContent = "You hold " + heldQty(a.sym) + " " + a.sym + ". This book does not go short.";
      note.hidden = false;
      return;
    }

    var pos = positionOf(a.sym);
    if (ticketSide === "buy") {
      var newQty = (pos ? pos.qty : 0) + qty;
      var newAvg = pos ? (pos.avg * pos.qty + a.price * qty) / newQty : a.price;
      book.positions[a.sym] = { qty: newQty, avg: newAvg };
    } else {
      book.realized += (a.price - pos.avg) * qty;
      var left = pos.qty - qty;
      if (left <= 1e-9) delete book.positions[a.sym];
      else book.positions[a.sym] = { qty: left, avg: pos.avg };
    }

    book.fills.unshift({
      t: Date.now(), side: ticketSide, sym: a.sym, qty: qty, price: a.price
    });
    book.fills = book.fills.slice(0, 60);
    saveBook();
    paintBook();
    closeTicket();
    toast((ticketSide === "buy" ? "Bought " : "Sold ") + qty + " " + a.sym + " at " + money(a.price) + ".");
  }

  /* ---- portfolio ---- */

  function paintBook() {
    var count = Object.keys(book.positions).length;
    $("#folioCount").textContent = count || "";
    folioDockDot.hidden = !count;
    paintHeroPosition();
    if (folioModal.style.display !== "none" && !folioModal.classList.contains("gone")) renderFolio();
  }

  function paintHeroPosition() {
    var held = heldQty(state.selected);
    var pos = positionOf(state.selected);
    $("#heroPosition").textContent = held
      ? "holding " + held + " @ " + money(pos.avg)
      : (wallet.address ? "" : "connect a wallet to trade");
  }

  function renderFolio() {
    $("#folioAccount").textContent = wallet.address ? shortAddr(wallet.address) + " · paper book" : "Not connected";

    var value = marketValue(), open = openPnl();
    $("#folioStats").innerHTML = [
      ["Positions", Object.keys(book.positions).length],
      ["Market value", "$" + dollars(value)],
      ["Open P&L", signed(open)],
      ["Realised", signed(book.realized)]
    ].map(function (row) {
      return '<dl class="class-stat"><dt>' + row[0] + "</dt><dd>" + row[1] + "</dd></dl>";
    }).join("");

    var syms = Object.keys(book.positions);
    $("#folioRows").innerHTML = syms.length ? syms.map(function (sym) {
      var a = byId(sym), p = book.positions[sym];
      var pnl = (a.price - p.avg) * p.qty;
      return "<tr>" +
        '<td><span class="row-sym"><span class="asset-badge xs">' + sym.slice(0, 3) + "</span>" + sym + "</span></td>" +
        '<td class="num">' + (+p.qty.toFixed(4)) + "</td>" +
        '<td class="num">' + money(p.avg) + "</td>" +
        '<td class="num">' + money(a.price) + "</td>" +
        '<td class="num">$' + dollars(a.price * p.qty) + "</td>" +
        '<td class="num ' + (pnl >= 0 ? "up" : "down") + '">' + signed(pnl) + "</td>" +
        "</tr>";
    }).join("") : '<tr><td colspan="6" class="folio-empty">No positions yet. Pick an asset and press Buy.</td></tr>';

    $("#blotterRows").innerHTML = book.fills.length ? book.fills.slice(0, 12).map(function (f) {
      var d = new Date(f.t);
      return "<tr>" +
        "<td>" + d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "</td>" +
        '<td class="' + (f.side === "buy" ? "up" : "down") + '">' + (f.side === "buy" ? "Buy" : "Sell") + "</td>" +
        "<td>" + f.sym + "</td>" +
        '<td class="num">' + (+f.qty.toFixed(4)) + "</td>" +
        '<td class="num">' + money(f.price) + "</td>" +
        '<td class="num">$' + dollars(f.qty * f.price) + "</td>" +
        "</tr>";
    }).join("") : '<tr><td colspan="6" class="folio-empty">Nothing filled yet.</td></tr>';
  }

  function openFolio() {
    renderFolio();
    folioModal.style.display = "";
    folioModal.classList.remove("gone");
  }
  function closeFolio() {
    folioModal.classList.add("gone");
    setTimeout(function () { folioModal.style.display = "none"; }, 420);
  }

  $$(".trade-bar [data-side]").forEach(function (b) {
    b.addEventListener("click", function () { openTicket(b.dataset.side); });
  });
  $("#ticketQty").addEventListener("input", paintNotional);
  $$("#ticketQuick button").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = byId(state.selected);
      $("#ticketQty").value = b.dataset.qty === "max"
        ? (ticketSide === "sell" ? heldQty(a.sym) || 1 : Math.max(1, Math.floor(10000 / a.price)))
        : b.dataset.qty;
      paintNotional();
    });
  });
  $("#tradeCancel").addEventListener("click", closeTicket);
  $("#tradeSubmit").addEventListener("click", fillOrder);
  folioDock.addEventListener("click", openFolio);
  $("#folioSide").addEventListener("click", openFolio);
  $("#folioClose").addEventListener("click", closeFolio);
  $("#folioClear").addEventListener("click", function () {
    book = { positions: {}, fills: [], realized: 0 };
    saveBook();
    paintBook();
    renderFolio();
    toast("Book cleared.");
  });

  /* ------------------------------------------------------------------ menus */

  var menus = $$(".menu");

  function closeMenus() { menus.forEach(function (m) { m.classList.remove("open"); }); }
  function menusOpen() { return menus.some(function (m) { return m.classList.contains("open"); }); }

  menus.forEach(function (m) {
    m.querySelector(".menu-item").addEventListener("click", function (e) {
      e.stopPropagation();
      var was = m.classList.contains("open");
      closeMenus();
      if (!was) m.classList.add("open");
    });
    // once a menu is open, sliding across the bar switches between them
    m.addEventListener("mouseenter", function () {
      if (menusOpen()) { closeMenus(); m.classList.add("open"); }
    });
  });
  document.addEventListener("click", closeMenus);

  $$(".mi").forEach(function (item) {
    item.addEventListener("click", function () { closeMenus(); run(item.dataset.cmd); });
  });

  /* ---- what the menus actually do ---- */

  function toast(message) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1900);
  }

  function copyText(text, what) {
    if (!navigator.clipboard) { toast("This browser will not let the page copy."); return; }
    navigator.clipboard.writeText(text)
      .then(function () { toast("Copied the " + what + "."); })
      .catch(function () { toast("The copy was refused."); });
  }

  function quoteLine() {
    var a = byId(state.selected);
    return [a.sym, a.name, money(a.price), pct(a.change), "simulated quote from Market Desk"].join(" · ");
  }

  function tableCsv() {
    var head = ["symbol", "name", "venue", "class", "price", "change_pct", "market_cap"];
    var rows = visible().map(function (a) {
      return [a.sym, '"' + a.name + '"', a.venue, a.type, a.price.toFixed(4), a.change.toFixed(2), a.cap].join(",");
    });
    return head.join(",") + "\n" + rows.join("\n");
  }

  // Nudges every price and redraws the book, the way a desk refreshes its feed.
  function reseed() {
    ASSETS.forEach(function (a) {
      a.price = a.price * (1 + (Math.random() - 0.5) * 0.02);
      Object.keys(RANGES).forEach(function (r) { a.series[r] = makeSeries(a, r); });
      var s1 = a.series["1D"];
      a.open = s1[0];
      a.high = Math.max.apply(null, s1);
      a.low = Math.min.apply(null, s1);
      a.change = ((a.price - a.open) / a.open) * 100;
    });
    renderClass(state.filter);
    renderCards();
    renderRows();
    renderHeat();
    renderHero(true);
    toast("Quotes refreshed.");
  }

  var infoModal = $("#infoModal");
  function info(icon, title, html) {
    $("#infoIcon").textContent = icon;
    $("#infoTitle").textContent = title;
    $("#infoBody").innerHTML = html;
    infoModal.style.display = "";
    infoModal.classList.remove("gone");
  }
  $("#infoClose").addEventListener("click", function () {
    infoModal.classList.add("gone");
    setTimeout(function () { infoModal.style.display = "none"; }, 420);
  });

  function aboutHTML() {
    return '<div class="wallet-list">' +
      '<div class="wallet-row"><span>Assets tracked</span><b>' + ASSETS.length + "</b></div>" +
      '<div class="wallet-row"><span>Classes</span><b>Stocks · Crypto · ETFs · Commodities</b></div>' +
      '<div class="wallet-row"><span>Quotes</span><b>Simulated in your browser</b></div>' +
      '<div class="wallet-row"><span>Wallet</span><b>Read-only, no transactions</b></div>' +
      "</div>" +
      '<p class="wallet-hint">A desk that behaves like the real thing without pretending its numbers are real. Nothing here is investment advice.</p>';
  }

  function shortcutsHTML() {
    var keys = [
      ["1 – 5", "Watchlist, stocks, crypto, ETFs, commodities"],
      ["]", "Next asset in the current class"],
      ["/", "Search assets"],
      ["D", "Switch appearance"],
      ["R", "Refresh quotes"],
      ["C", "Copy the shown quote"],
      ["W", "Wallet"], ["B", "Portfolio"], ["T", "Terms"], ["G", "Ticker Drop"],
      ["Esc", "Close what is open"],
      ["WASD", "Move, rotate and drop in Ticker Drop"]
    ];
    return '<div class="wallet-list">' + keys.map(function (k) {
      return '<div class="wallet-row"><span>' + k[1] + "</span><b>" + k[0] + "</b></div>";
    }).join("") + "</div>";
  }

  function goTo(where) {
    var el = $({ top: "#heroCard", cards: "#cards", rows: "#rows" }[where]);
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }

  function run(cmd) {
    if (!cmd) return;
    var parts = cmd.split(":");
    switch (parts[0]) {
      case "about": info("📈", "About Market Desk", aboutHTML()); break;
      case "shortcuts": info("⌨️", "Keyboard shortcuts", shortcutsHTML()); break;
      case "wallet": openWallet(); break;
      case "terms": openModal(); break;
      case "theme": flipTheme(); break;
      case "refresh": reseed(); break;
      case "copyQuote": copyText(quoteLine(), "quote"); break;
      case "copyCsv": copyText(tableCsv(), "table"); break;
      case "print": window.print(); break;
      case "class": setFilter(parts[1]); break;
      case "range": setRange(parts[1]); break;
      case "next": feature(state.filter); break;
      case "go": goTo(parts[1]); break;
      case "folio": openFolio(); break;
      case "game": openGame(); break;
      case "scores": openScores(); break;
      case "x": window.open("https://x.com/useMarketDesk", "_blank", "noopener"); break;
    }
  }

  /* ------------------------------------------------------------ ticker drop */

  // A falling-block puzzle where every piece is a position: the blocks carry the
  // ticker, the colour is its asset class, and a full row is a closed trade.
  var COLS = 10, ROWS = 18, CELL = 26;
  var SHAPES = {
    I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
  };
  var SHAPE_KEYS = Object.keys(SHAPES);
  var ROW_VALUE = [0, 1200, 3000, 6400, 12000];   // booked P&L per rows closed

  // Sound is synthesised with Web Audio: no files to load, nothing to host.
  var sound = { ctx: null, on: read("markets.sfx") !== "off" };

  function tone(freq, dur, type, vol, delay) {
    if (!sound.on) return;
    try {
      if (!sound.ctx) sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var ctx = sound.ctx;
      var at = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(vol || 0.05, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    } catch (e) { sound.on = false; }
  }

  function sfx(name) {
    if (name === "move") tone(180, .035, "square", .035);
    else if (name === "rotate") tone(320, .045, "square", .04);
    else if (name === "hold") tone(420, .07, "triangle", .05);
    else if (name === "lock") tone(120, .07, "sine", .06);
    else if (name === "clear") { tone(440, .09, "triangle", .07); tone(660, .09, "triangle", .06, .07); tone(880, .14, "triangle", .05, .14); }
    else if (name === "level") { tone(520, .08, "square", .05); tone(780, .12, "square", .045, .08); }
    else if (name === "over") { tone(200, .18, "sawtooth", .05); tone(150, .22, "sawtooth", .045, .16); tone(90, .3, "sawtooth", .04, .34); }
  }

  var gameModal = $("#gameModal"), gameDock = $("#gameDock"), gameDockDot = $("#gameDockDot");
  var board = $("#board"), bx = board.getContext("2d");
  var nextCanvas = $("#nextCanvas"), nx = nextCanvas.getContext("2d");
  var holdCanvas = $("#holdCanvas"), hx = holdCanvas.getContext("2d");
  var LOCK_DELAY = 440, LOCK_RESETS = 12;
  var game = null, raf = null;

  function cssColor(token) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  function readable(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#ffffff";
    var v = parseInt(m[1], 16);
    var lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    return lum > 0.62 ? "#10141c" : "#ffffff";
  }

  function newPiece() {
    var key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    var shape = SHAPES[key];
    var asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
    return {
      key: key, cells: shape.cells.slice(), n: shape.n, asset: asset,
      color: CLASSES[asset.type].accent, label: asset.sym.slice(0, 4),
      x: Math.floor((COLS - shape.n) / 2), y: -2
    };
  }

  function collides(piece, offX, offY, cells) {
    cells = cells || piece.cells;
    for (var i = 0; i < cells.length; i++) {
      var cx = piece.x + cells[i][0] + offX;
      var cy = piece.y + cells[i][1] + offY;
      if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
      if (cy >= 0 && game.grid[cy][cx]) return true;
    }
    return false;
  }

  function rotate() {
    var n = game.piece.n;
    var turned = game.piece.cells.map(function (c) { return [n - 1 - c[1], c[0]]; });
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(game.piece, kicks[i], 0, turned)) {
        game.piece.x += kicks[i];
        game.piece.cells = turned;
        touched();
        sfx("rotate");
        return;
      }
    }
  }

  function grounded() { return collides(game.piece, 0, 1); }

  function touched() {
    // sliding or spinning a landed piece buys a little more time, up to a limit
    if (grounded() && game.lockResets < LOCK_RESETS) {
      game.lockAt = performance.now();
      game.lockResets++;
    }
  }

  function move(dx) {
    if (!collides(game.piece, dx, 0)) { game.piece.x += dx; touched(); sfx("move"); }
  }

  function hold() {
    if (game.holdUsed) return;
    var current = game.piece;
    if (game.hold) {
      game.piece = game.hold;
      game.piece.x = Math.floor((COLS - game.piece.n) / 2);
      game.piece.y = -2;
    } else {
      game.piece = game.next;
      game.next = newPiece();
      paintNext();
    }
    game.hold = { cells: SHAPES[current.key].cells.slice(), n: current.n, key: current.key,
                  asset: current.asset, color: current.color, label: current.label,
                  x: 0, y: -2 };
    game.holdUsed = true;
    sfx("hold");
    game.lockAt = 0;
    game.lockResets = 0;
    paintHold();
  }

  function lock() {
    game.piece.cells.forEach(function (c) {
      var cy = game.piece.y + c[1], cx = game.piece.x + c[0];
      if (cy >= 0) game.grid[cy][cx] = { color: game.piece.color, label: game.piece.label, sym: game.piece.asset.sym };
    });

    var closed = 0, moves = [], burst = [];
    for (var y = ROWS - 1; y >= 0; y--) {
      if (game.grid[y].every(function (c) { return !!c; })) {
        game.grid[y].forEach(function (c, i) {
          var a = byId(c.sym);
          if (a) moves.push(a.change);
          burst.push({ x: (i + .5) * CELL, y: (y + .5) * CELL, color: c.color });
        });
        game.grid.splice(y, 1);
        game.grid.unshift(new Array(COLS).fill(null));
        closed++;
        y++;
      }
    }

    if (closed) {
      var avgMove = moves.reduce(function (t, m) { return t + m; }, 0) / (moves.length || 1);
      var marketMult = Math.min(2.4, Math.max(0.6, 1 + avgMove / 4));   // gainers pay, losers do not
      game.streak++;
      var streakMult = Math.min(2.5, 1 + (game.streak - 1) * 0.25);
      var payout = Math.round(ROW_VALUE[closed] * game.level * marketMult * streakMult);

      game.lines += closed;
      game.pnl += payout;
      var wasLevel = game.level;
      game.level = 1 + Math.floor(game.lines / 8);

      popup("+$" + payout.toLocaleString("en-US"),
            "×" + marketMult.toFixed(2) + " market" + (game.streak > 1 ? " · ×" + streakMult.toFixed(2) + " streak" : ""),
            avgMove >= 0 ? "--green" : "--red");
      spark(burst);
      sfx(game.level > wasLevel ? "level" : "clear");
      paintStats();
    } else {
      game.streak = 0;
      sfx("lock");
      paintStats();
    }

    game.piece = game.next;
    game.next = newPiece();
    game.holdUsed = false;
    game.lockAt = 0;
    game.lockResets = 0;
    paintNext();
    if (collides(game.piece, 0, 0)) endGame();
  }

  function step() {
    if (grounded()) lock();
    else { game.piece.y++; game.lockAt = 0; }
  }

  function hardDrop() {
    while (!collides(game.piece, 0, 1)) game.piece.y++;
    lock();
  }

  function popup(text, sub, token) {
    game.popups.push({ text: text, sub: sub, color: cssColor(token) || "#ffffff", life: 1 });
  }

  function spark(cells) {
    cells.forEach(function (c) {
      for (var i = 0; i < 3; i++) {
        game.bits.push({
          x: c.x, y: c.y, color: c.color, life: 1,
          vx: (Math.random() - .5) * 3.4, vy: -Math.random() * 3.2 - 0.6
        });
      }
    });
  }

  function drawEffects() {
    game.bits = game.bits.filter(function (b) { return b.life > 0; });
    game.bits.forEach(function (b) {
      b.x += b.vx; b.y += b.vy; b.vy += 0.22; b.life -= 0.022;
      bx.globalAlpha = Math.max(0, b.life);
      bx.fillStyle = b.color;
      bx.fillRect(b.x - 2.5, b.y - 2.5, 5, 5);
    });
    bx.globalAlpha = 1;

    game.popups = game.popups.filter(function (p) { return p.life > 0; });
    game.popups.forEach(function (p, i) {
      p.life -= 0.012;
      var y = board.height / 2 - i * 34 - (1 - p.life) * 26;
      bx.globalAlpha = Math.min(1, p.life * 1.6);
      bx.textAlign = "center";
      bx.fillStyle = p.color;
      bx.font = '700 20px "JetBrains Mono", monospace';
      bx.fillText(p.text, board.width / 2, y);
      bx.fillStyle = cssColor("--ink-2") || "#a7b0bd";
      bx.font = '500 10px "JetBrains Mono", monospace';
      bx.fillText(p.sub, board.width / 2, y + 15);
      bx.globalAlpha = 1;
    });
  }

  function cell(ctx, px, py, size, color, label) {
    ctx.fillStyle = color;
    ctx.globalAlpha = .92;
    ctx.beginPath();
    ctx.roundRect(px + 1, py + 1, size - 2, size - 2, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (label && size >= 20) {
      ctx.fillStyle = readable(color);
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, px + size / 2, py + size / 2 + .5);
    }
  }

  function draw() {
    bx.clearRect(0, 0, board.width, board.height);

    bx.strokeStyle = cssColor("--hair-soft") || "rgba(255,255,255,.06)";
    bx.lineWidth = 1;
    for (var i = 1; i < COLS; i++) {
      bx.beginPath(); bx.moveTo(i * CELL + .5, 0); bx.lineTo(i * CELL + .5, ROWS * CELL); bx.stroke();
    }
    for (var j = 1; j < ROWS; j++) {
      bx.beginPath(); bx.moveTo(0, j * CELL + .5); bx.lineTo(COLS * CELL, j * CELL + .5); bx.stroke();
    }

    game.grid.forEach(function (row, y) {
      row.forEach(function (c, x) { if (c) cell(bx, x * CELL, y * CELL, CELL, c.color, c.label); });
    });

    if (game.piece) {
      // where it lands, shown faintly
      var ghost = 0;
      while (!collides(game.piece, 0, ghost + 1)) ghost++;
      bx.globalAlpha = .18;
      game.piece.cells.forEach(function (c) {
        var gy = game.piece.y + c[1] + ghost;
        if (gy >= 0) cell(bx, (game.piece.x + c[0]) * CELL, gy * CELL, CELL, game.piece.color, null);
      });
      bx.globalAlpha = 1;

      game.piece.cells.forEach(function (c) {
        var cy = game.piece.y + c[1];
        if (cy >= 0) cell(bx, (game.piece.x + c[0]) * CELL, cy * CELL, CELL, game.piece.color, game.piece.label);
      });
    }

    drawEffects();
  }

  function paintSlot(ctx, canvas, piece, nameEl, emptyText) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!piece) { nameEl.textContent = emptyText; return; }
    var size = 20;
    var offX = (canvas.width - piece.n * size) / 2;
    var offY = (canvas.height - piece.n * size) / 2;
    piece.cells.forEach(function (c) {
      cell(ctx, offX + c[0] * size, offY + c[1] * size, size, piece.color, piece.label);
    });
    nameEl.textContent = piece.asset.sym + " · " + money(piece.asset.price);
  }
  function paintNext() { paintSlot(nx, nextCanvas, game.next, $("#nextName"), "—"); }
  function paintHold() { paintSlot(hx, holdCanvas, game.hold, $("#holdName"), "empty"); }

  function bestKey() { return "markets.best." + (wallet.address || "guest"); }
  function bestScore() { return parseInt(read(bestKey()) || "0", 10) || 0; }

  function paintStats() {
    $("#gamePnl").textContent = "$" + game.pnl.toLocaleString("en-US");
    $("#gameLines").textContent = game.lines;
    $("#gameLevel").textContent = game.level;
    $("#gameStreak").textContent = game.streak > 1 ? "×" + game.streak : "—";
    $("#gameBest").textContent = "$" + bestScore().toLocaleString("en-US");
  }

  function endGame() {
    game.over = true;
    sfx("over");
    var best = bestScore();
    var beat = game.pnl > best;
    if (beat) { write(bestKey(), String(game.pnl)); paintStats(); }
    $("#gameOver").dataset.beat = beat ? "1" : "";
    $("#gameOverTitle").textContent = beat && game.pnl > 0 ? "New best" : game.pnl > 0 ? "Book closed" : "Margin call";
    $("#gameOverLine").textContent = "Booked $" + game.pnl.toLocaleString("en-US") +
      " across " + game.lines + (game.lines === 1 ? " row" : " rows") +
      (beat ? ". That is your best yet." : ". Best is $" + best.toLocaleString("en-US") + ".");
    $("#gameOver").hidden = false;
    recordRun();
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!game) return;
    if (game.over || game.paused) { draw(); return; }
    if (!game.last) game.last = now;
    var speed = Math.max(120, 780 - (game.level - 1) * 70);

    if (grounded()) {
      if (!game.lockAt) game.lockAt = now;
      if (now - game.lockAt >= LOCK_DELAY) { lock(); game.last = now; }
    } else if (now - game.last >= speed) {
      step();
      game.last = now;
    }
    draw();
  }

  function startGame() {
    game = {
      grid: Array.from({ length: ROWS }, function () { return new Array(COLS).fill(null); }),
      piece: newPiece(), next: newPiece(), hold: null, holdUsed: false,
      pnl: 0, lines: 0, level: 1, streak: 0, last: 0, lockAt: 0, lockResets: 0,
      popups: [], bits: [], paused: false, over: false
    };
    $("#gameOver").hidden = true;
    $("#gamePause").textContent = "Pause";
    paintStats();
    paintNext();
    paintHold();
    draw();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function openGame() {
    gameModal.style.display = "";
    gameModal.classList.remove("gone");
    gameDockDot.hidden = false;
    startGame();
  }

  function closeGame() {
    stopRepeat();
    gameModal.classList.add("gone");
    gameDockDot.hidden = true;
    setTimeout(function () { gameModal.style.display = "none"; }, 420);
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    game = null;
  }

  function gameOpen() { return !!game && !gameModal.classList.contains("gone"); }

  function paintMute() { $("#gameMute").textContent = sound.on ? "Sound on" : "Sound off"; }
  $("#gameMute").addEventListener("click", function () {
    sound.on = !sound.on;
    write("markets.sfx", sound.on ? "on" : "off");
    paintMute();
    if (sound.on) sfx("rotate");
  });
  paintMute();

  gameDock.addEventListener("click", openGame);
  $("#gameClose").addEventListener("click", closeGame);
  $("#gameAgain").addEventListener("click", startGame);
  $("#gamePause").addEventListener("click", function () {
    if (!game || game.over) return;
    game.paused = !game.paused;
    game.last = 0;
    $("#gamePause").textContent = game.paused ? "Resume" : "Pause";
  });
  $$(".game-pad button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!game) return;
    if (game.over || game.paused) { draw(); return; }
      var pad = b.dataset.pad;
      if (pad === "left") move(-1);
      else if (pad === "right") move(1);
      else if (pad === "rot") rotate();
      else if (pad === "down") step();
      else if (pad === "drop") hardDrop();
      else if (pad === "hold") hold();
      draw();
    });
  });

  /* ------------------------------------------------------------ scoreboard */

  // Published as an Artifact, the page gets a small store of its own, so a run
  // played by anyone who opens it lands where the owner can read it back. Served
  // as plain files there is no store, and everything below simply stays quiet.
  var store = null, scoresModal = $("#scoresModal");

  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("db").then(function (db) { store = db || null; }).catch(function () { store = null; });
  }

  var playerName = $("#gameName");
  playerName.value = read("markets.player") || "";
  playerName.addEventListener("input", function () { write("markets.player", playerName.value.trim()); });

  function recordRun() {
    if (!store) return;
    var id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    store.doc("runs/" + id).set({
      score: game.pnl,
      lines: game.lines,
      level: game.level,
      player: (playerName.value.trim() || "anonymous").slice(0, 18),
      wallet: wallet.address ? shortAddr(wallet.address) : "",
      at: new Date().toISOString()
    }).catch(function () { /* the run simply is not recorded */ });
  }

  function renderScores() {
    var rows = $("#scoresRows"), stats = $("#scoresStats");

    if (!store) {
      rows.innerHTML = '<tr><td colspan="6" class="folio-empty">This copy of the page has no store. Runs are recorded on the published version.</td></tr>';
      stats.innerHTML = "";
      return;
    }

    rows.innerHTML = '<tr><td colspan="6" class="folio-empty">Loading…</td></tr>';
    store.collection("runs").orderBy("score", "desc").limit(50).get().then(function (snap) {
      var runs = snap.docs.map(function (d) { return d.data(); });

      var players = {};
      runs.forEach(function (r) { players[r.player || "anonymous"] = true; });
      stats.innerHTML = [
        ["Runs", runs.length],
        ["Players", Object.keys(players).length],
        ["Best", runs.length ? "$" + (runs[0].score || 0).toLocaleString("en-US") : "—"],
        ["Rows closed", runs.reduce(function (t, r) { return t + (r.lines || 0); }, 0)]
      ].map(function (row) {
        return '<dl class="class-stat"><dt>' + row[0] + "</dt><dd>" + row[1] + "</dd></dl>";
      }).join("");

      rows.innerHTML = runs.length ? runs.map(function (r, i) {
        var when = new Date(r.at);
        return "<tr>" +
          '<td class="num">' + (i + 1) + "</td>" +
          "<td>" + escapeText(r.player || "anonymous") + (r.wallet ? ' <span class="hide-sm">· ' + escapeText(r.wallet) + "</span>" : "") + "</td>" +
          '<td class="num">$' + (r.score || 0).toLocaleString("en-US") + "</td>" +
          '<td class="num">' + (r.lines || 0) + "</td>" +
          '<td class="num">' + (r.level || 1) + "</td>" +
          "<td>" + (isNaN(when) ? "—" : when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })) + "</td>" +
          "</tr>";
      }).join("") : '<tr><td colspan="6" class="folio-empty">Nobody has finished a run yet.</td></tr>';
    }).catch(function () {
      rows.innerHTML = '<tr><td colspan="6" class="folio-empty">The store did not answer. Try refresh.</td></tr>';
    });
  }

  // Runs are written by whoever plays, so treat every field as text, not markup.
  function escapeText(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function openScores() {
    renderScores();
    scoresModal.style.display = "";
    scoresModal.classList.remove("gone");
  }
  function closeScores() {
    scoresModal.classList.add("gone");
    setTimeout(function () { scoresModal.style.display = "none"; }, 420);
  }
  $("#scoresClose").addEventListener("click", closeScores);
  $("#scoresRefresh").addEventListener("click", renderScores);

  // The scoreboard is yours: it stays out of the menu until this browser has
  // been unlocked once with #owner in the address.
  if (window.location.hash === "#owner") write("markets.owner", "1");
  if (read("markets.owner") === "1") $("#scoresMenuItem").hidden = false;

  /* ------------------------------------------------------------ keyboard */

  // Holding a key slides the piece: a short delay, then a fast repeat, the way
  // this genre expects. The browser's own repeat is too slow to play with.
  var repeat = { key: null, delay: null, tick: null };

  function stopRepeat() {
    clearTimeout(repeat.delay);
    clearInterval(repeat.tick);
    repeat.key = null;
  }

  function autoRepeat(key, action) {
    stopRepeat();
    action();
    repeat.key = key;
    repeat.delay = setTimeout(function () {
      repeat.tick = setInterval(function () {
        if (!game || game.over || game.paused) return stopRepeat();
        action();
        draw();
      }, 45);
    }, 170);
  }

  document.addEventListener("keyup", function (e) {
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === repeat.key) stopRepeat();
  });
  window.addEventListener("blur", stopRepeat);


  function sheetOpen(el) { return el && el.style.display !== "none" && !el.classList.contains("gone"); }

  document.addEventListener("keydown", function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (e.key === "Escape") e.target.blur();
      return;
    }

    if (e.key === "Escape") {
      if (gameOpen()) return closeGame();
      if (menusOpen()) return closeMenus();
      if (sheetOpen(infoModal)) return $("#infoClose").click();
      if (sheetOpen(tradeModal)) return closeTicket();
      if (sheetOpen(folioModal)) return closeFolio();
      if (sheetOpen(scoresModal)) return closeScores();
      if (sheetOpen(walletModal)) return $("#walletClose").click();
      return;
    }

    if (gameOpen()) {
      if (game.over || game.paused) {
        if (e.key.toLowerCase() === "p") $("#gamePause").click();
        return;
      }
      var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.repeat) { e.preventDefault(); return; }   // the page repeats these itself

      var handled = true;
      switch (key) {
        case "ArrowLeft": case "a": autoRepeat(key, function () { move(-1); }); break;
        case "ArrowRight": case "d": autoRepeat(key, function () { move(1); }); break;
        case "ArrowDown": case "s": autoRepeat(key, function () { step(); }); break;
        case "ArrowUp": case "w": rotate(); break;
        case " ": hardDrop(); break;
        case "e": case "Shift": hold(); break;
        case "p": $("#gamePause").click(); break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); draw(); }
      return;
    }

    if (sheetOpen(infoModal) || sheetOpen(walletModal) || sheetOpen(modal) ||
        sheetOpen(tradeModal) || sheetOpen(folioModal)) return;

    var k = e.key.toLowerCase();
    var byNumber = { "1": "all", "2": "stock", "3": "crypto", "4": "etf", "5": "commodity" };
    if (byNumber[e.key]) return setFilter(byNumber[e.key]);
    if (k === "d") return flipTheme();
    if (k === "r") return reseed();
    if (k === "c") return copyText(quoteLine(), "quote");
    if (k === "w") return openWallet();
    if (k === "t") return openModal();
    if (k === "g") return openGame();
    if (k === "b") return openFolio();
    if (e.key === "]") return feature(state.filter);
    if (e.key === "?") return run("shortcuts");
    if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
  });

  /* ------------------------------------------------------------------ boot */

  drawGrid();
  markSorted();
  renderHeat();
  loadBook();

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
