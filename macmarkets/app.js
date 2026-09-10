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
    var first = s[0], last = s[s.length - 1];
    var chg = ((last - first) / first) * 100;
    var abs = last - first;

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

  function setFilter(f) {
    state.filter = f;
    $$(".seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.filter === f); });
    $$(".side-item").forEach(function (b) { b.classList.toggle("on", b.dataset.filter === f); });
    renderCards(); renderRows();
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

  var indices = [
    { el: "#idxSpx", v: 0.62 }, { el: "#idxNdx", v: 0.94 }, { el: "#idxVix", v: -3.10 }
  ];

  function startTicking() {
    if (reduced) return;
    setInterval(function () {
      var a = ASSETS[Math.floor(Math.random() * ASSETS.length)];
      paintQuote(a, stepQuote(a));
    }, 1200);

    setInterval(function () {
      indices.forEach(function (ix) {
        ix.v += (Math.random() - 0.5) * 0.08;
        var el = $(ix.el);
        el.textContent = pct(ix.v);
        el.className = ix.v >= 0 ? "up" : "down";
      });
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
  renderCards();
  renderRows();
  renderHero(false);

  if (read(STORE.terms)) {
    closeModal();
    enter();
  } else {
    setTimeout(function () { agree.focus(); }, 500);
  }
})();
