/* Peg landing page behaviour: nav, reveals, counters, ticker, live-ish prices. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav ---------- */

  var nav = document.getElementById("nav");
  var links = document.getElementById("navLinks");
  var burger = document.getElementById("burger");

  function onScroll() { nav.classList.toggle("stuck", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  burger.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("year").textContent = String(new Date().getFullYear());

  /* ---------- reveal on scroll ---------- */

  var revealables = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        setTimeout(function () { el.classList.add("in"); }, i * 70);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- hero stat counters ---------- */

  var counters = document.querySelectorAll("[data-count]");
  function runCounter(el) {
    var target = parseFloat(el.dataset.count);
    var prefix = el.dataset.prefix || "";
    var suffix = el.dataset.suffix || "";
    var decimals = (el.dataset.count.split(".")[1] || "").length;
    if (reduced) { el.textContent = prefix + target.toFixed(decimals) + suffix; return; }
    var start = performance.now();
    var dur = 1100;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- market data (simulated) ---------- */

  var markets = [
    { sym: "USDC/USDT", base: 1.0001, depth: "$18.4M", vol: "$412.8M" },
    { sym: "DAI/USDC",  base: 0.9998, depth: "$9.1M",  vol: "$186.2M" },
    { sym: "USDe/USDT", base: 0.9994, depth: "$6.7M",  vol: "$143.5M" },
    { sym: "PYUSD/USDC",base: 1.0002, depth: "$3.2M",  vol: "$58.9M"  },
    { sym: "FRAX/USDC", base: 0.9991, depth: "$2.4M",  vol: "$41.3M"  },
    { sym: "EURC/USDC", base: 1.0872, depth: "$4.8M",  vol: "$77.6M"  }
  ];

  function drift(base, scale) {
    return base * (1 + (Math.random() - 0.5) * scale);
  }

  var tbody = document.getElementById("marketBody");
  markets.forEach(function (m) {
    m.price = drift(m.base, 0.0006);
    m.change = (Math.random() - 0.45) * 0.18;

    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><span class="sym-cell"><span class="sym-badge">' + m.sym.slice(0, 2) + "</span>" + m.sym + "</span></td>" +
      '<td class="price"></td>' +
      '<td class="change"></td>' +
      "<td>" + m.depth + "</td>" +
      "<td>" + m.vol + "</td>" +
      '<td class="td-action"><button class="btn btn-outline" type="button">Trade</button></td>';
    tbody.appendChild(tr);
    m.row = tr;
    paintRow(m, 0);
  });

  function paintRow(m, dir) {
    var priceCell = m.row.querySelector(".price");
    var changeCell = m.row.querySelector(".change");
    priceCell.textContent = m.price.toFixed(m.base > 1.05 ? 4 : 5);
    changeCell.textContent = (m.change >= 0 ? "+" : "") + m.change.toFixed(2) + "%";
    changeCell.className = "change " + (m.change >= 0 ? "up" : "down");
    if (!dir) return;
    var cls = dir > 0 ? "flash-up" : "flash-down";
    priceCell.classList.remove("flash-up", "flash-down");
    void priceCell.offsetWidth;
    priceCell.classList.add(cls);
  }

  if (!reduced) {
    setInterval(function () {
      var m = markets[Math.floor(Math.random() * markets.length)];
      var next = drift(m.price, 0.0004);
      var dir = next > m.price ? 1 : -1;
      m.price = next;
      m.change += dir * Math.random() * 0.02;
      paintRow(m, dir);
    }, 1400);
  }

  /* ---------- ticker ---------- */

  var ticker = document.getElementById("ticker");
  var tickerItems = markets.concat([
    { sym: "USDT.e/USDC", price: 0.9997, change: 0.01 },
    { sym: "crvUSD/USDC", price: 0.9989, change: -0.06 },
    { sym: "GHO/USDC",    price: 0.9996, change: 0.04 },
    { sym: "sDAI/DAI",    price: 1.0741, change: 0.11 }
  ]);

  function tickerHTML() {
    return tickerItems.map(function (m) {
      var cls = m.change >= 0 ? "up" : "down";
      var sign = m.change >= 0 ? "+" : "";
      return '<span class="tick"><span class="sym">' + m.sym + "</span><span>" +
        m.price.toFixed(4) + '</span><span class="' + cls + '">' + sign + m.change.toFixed(2) + "%</span></span>";
    }).join("");
  }
  ticker.innerHTML = tickerHTML() + tickerHTML();

  /* ---------- hero sparkline ---------- */

  var line = document.getElementById("sparkLine");
  var fill = document.getElementById("sparkFill");
  var priceEl = document.getElementById("heroPrice");
  var chgEl = document.getElementById("heroChg");
  var W = 320, H = 90, N = 48;
  var series = [];
  var v = 1.0001;
  for (var i = 0; i < N; i++) { v = drift(v, 0.0005); series.push(v); }

  function drawSpark() {
    var min = Math.min.apply(null, series);
    var max = Math.max.apply(null, series);
    var span = (max - min) || 1e-6;
    var pts = series.map(function (p, idx) {
      var x = (idx / (N - 1)) * W;
      var y = H - 6 - ((p - min) / span) * (H - 16);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    line.setAttribute("d", "M" + pts.join("L"));
    fill.setAttribute("d", "M0," + H + "L" + pts.join("L") + "L" + W + "," + H + "Z");

    var last = series[series.length - 1];
    var first = series[0];
    var pct = ((last - first) / first) * 100;
    priceEl.textContent = last.toFixed(5);
    chgEl.textContent = (pct >= 0 ? "+" : "") + pct.toFixed(3) + "%";
    chgEl.className = "chg " + (pct >= 0 ? "up" : "down");
  }
  drawSpark();

  if (!reduced) {
    setInterval(function () {
      series.push(drift(series[series.length - 1], 0.0005));
      series.shift();
      drawSpark();
    }, 1200);
  }

  /* ---------- waitlist form (front end only) ---------- */

  var form = document.getElementById("waitlist");
  var note = document.getElementById("ctaNote");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = form.querySelector("input");
    if (!input.value || input.value.indexOf("@") < 1) {
      note.textContent = "Enter a valid email address.";
      note.className = "cta-note";
      input.focus();
      return;
    }
    note.textContent = "You are on the list. Watch for an invite from access@peg.trade.";
    note.className = "cta-note ok";
    form.reset();
  });
})();
