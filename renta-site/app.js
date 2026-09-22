/* ===========================================================================
   RENTA — page behaviour. No dependencies.
   =========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- the vault ---
     One source of truth. The calculator, the chart and the copy all read
     from here, so a number can never disagree with itself on this page.   */
  var CLOSES = [
    { date: '1 Mar 2026',  label: 'Opened',  price: 1.000000, rent: 0,        curve: 0,        collected: null,  costs: null,   kept: null   },
    { date: '31 Mar 2026', label: 'Mar',     price: 1.004122, rent: 0.003520, curve: 0.000602, collected: 43290, costs: 13652, kept: 29638 },
    { date: '30 Apr 2026', label: 'Apr',     price: 1.008263, rent: 0.003610, curve: 0.000531, collected: 47880, costs: 14812, kept: 33068 },
    { date: '31 May 2026', label: 'May',     price: 1.012383, rent: 0.003480, curve: 0.000640, collected: 50120, costs: 16350, kept: 33770 },
    { date: '30 Jun 2026', label: 'Jun',     price: 1.016626, rent: 0.003745, curve: 0.000498, collected: 55410, costs: 17061, kept: 38349 },
    { date: '31 Jul 2026', label: 'Jul',     price: 1.021041, rent: 0.003840, curve: 0.000575, collected: 58940, costs: 18205, kept: 40735 },
    { date: '31 Aug 2026', label: 'Aug',     price: 1.025393, rent: 0.003676, curve: 0.000676, collected: 58870, costs: 18250, kept: 40620 }
  ];

  var PRICE_NOW  = CLOSES[CLOSES.length - 1].price;
  var RENT_TOTAL = CLOSES.reduce(function (s, c) { return s + c.rent; }, 0);   /* 0.021871 */
  var CURVE_TOTAL = CLOSES.reduce(function (s, c) { return s + c.curve; }, 0); /* 0.003522 */

  var euro = function (n, dp) {
    return '€' + n.toLocaleString('en-GB', {
      minimumFractionDigits: dp === undefined ? 2 : dp,
      maximumFractionDigits: dp === undefined ? 2 : dp
    });
  };

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------- toast --- */
  var toast = $('#toast'), toastT;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3200);
  }
  $$('[data-connect]').forEach(function (b) {
    b.addEventListener('click', function () {
      say('No wallet connector in this build — the vault is a demonstration.');
    });
  });

  /* --------------------------------------------------------------- nav --- */
  var nav = $('#nav'), links = $('#navlinks'), burger = $('#burger');

  function onScroll() {
    nav.classList.toggle('is-stuck', window.scrollY > 12);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (burger) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  $$('#navlinks a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('is-open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
    });
  });

  /* active link, by which section owns the middle of the screen */
  var sections = ['portfolio', 'roll', 'dashboard', 'faq', 'docs'].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('#navlinks a').forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------------------ reveal --- */
  var rises = $$('.rt-rise');
  if (reduce || !('IntersectionObserver' in window)) {
    rises.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rises.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 5, 4) * 60) + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------- count-up ------ */
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce || !('IntersectionObserver' in window)) return;
    var done = false;
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || done) return;
        done = true;
        var t0 = performance.now(), dur = 900;
        (function tick(t) {
          var p = Math.min(1, (t - t0) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
        co.unobserve(el);
      });
    }, { threshold: 0.6 });
    co.observe(el);
  });

  /* ---------------------------------------------------------------- faq -- */
  $$('#faqlist .rt-q').forEach(function (q) {
    var btn = $('button', q);
    btn.addEventListener('click', function () {
      var open = q.classList.contains('is-open');
      $$('#faqlist .rt-q').forEach(function (other) {
        other.classList.remove('is-open');
        $('button', other).setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        q.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ------------------------------------------------- map <-> properties -- */
  var pins = $$('.rt-pin'), props = $$('.rt-prop');

  function light(city, on) {
    pins.forEach(function (p) {
      if (p.getAttribute('data-city') === city) p.classList.toggle('is-on', on);
    });
    props.forEach(function (p) {
      if (p.getAttribute('data-city') === city) p.classList.toggle('is-on', on);
    });
  }
  function bind(el) {
    var city = el.getAttribute('data-city');
    el.addEventListener('mouseenter', function () { light(city, true); });
    el.addEventListener('mouseleave', function () { light(city, false); });
    el.addEventListener('focus', function () { light(city, true); });
    el.addEventListener('blur', function () { light(city, false); });
  }
  pins.concat(props).forEach(bind);

  /* --------------------------------------------------------- calculator -- */
  var input = $('#amount'), range = $('#range'), chips = $$('.rt-chip');
  var oShares = $('#o-shares'), oWorth = $('#o-worth'),
      oRent = $('#o-rent'), oCurve = $('#o-curve'), oNote = $('#o-note');

  var MIN = 100, MAX = 100000;

  function render(amount) {
    var shares = amount;                    /* deposited at €1.0000 on 1 March */
    var worth  = amount * PRICE_NOW;
    var rent   = amount * RENT_TOTAL;
    var curve  = amount * CURVE_TOTAL;

    oShares.textContent = shares.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' vRENTA';
    oWorth.textContent  = euro(worth);
    oRent.textContent   = '+' + euro(rent);
    oCurve.textContent  = '+' + euro(curve);

    oNote.innerHTML =
      'Deposited on 1 March at €1.0000, that is <b>' +
      shares.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' vRENTA</b>. After six closes vRENTA is €1.0254, so it is worth <b>' + euro(worth) +
      '</b> — ' + euro(rent) + ' of rent the vault kept, and ' + euro(curve) +
      ' from the curve tax. Nothing was paid out along the way.';
  }

  function setAmount(value, fromInput) {
    var n = Math.max(MIN, Math.min(MAX, Math.round(value || MIN)));
    if (!fromInput) input.value = n.toLocaleString('en-GB');
    range.value = n;
    chips.forEach(function (c) { c.classList.toggle('is-on', parseInt(c.getAttribute('data-amt'), 10) === n); });
    render(n);
  }

  if (input) {
    input.addEventListener('input', function () {
      var raw = parseFloat(input.value.replace(/[^\d.]/g, ''));
      if (isNaN(raw)) return;
      setAmount(raw, true);
    });
    input.addEventListener('blur', function () {
      var raw = parseFloat(input.value.replace(/[^\d.]/g, ''));
      setAmount(isNaN(raw) ? MIN : raw, false);
    });
    range.addEventListener('input', function () { setAmount(parseFloat(range.value), false); });
    chips.forEach(function (c) {
      c.addEventListener('click', function () { setAmount(parseFloat(c.getAttribute('data-amt')), false); });
    });
    setAmount(10000, false);
  }

  /* -------------------------------------------------------------- chart --
     One series, so no legend: the title names it. Direct label on the last
     point, crosshair and tooltip on hover, grid kept recessive.           */
  var host = $('#chart'), tip = $('#tip');

  function chart() {
    if (!host) return;

    var W = 720, H = 300, L = 54, R = 76, T = 20, B = 34;
    var lo = 0.998, hi = 1.028;
    var x = function (i) { return L + (W - L - R) * (i / (CLOSES.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Line chart of the vRENTA share price rising from 1.0000 euro on 1 March 2026 to 1.0254 euro at the close of 31 August 2026. The figures behind it are listed in The Roll table above.">'];

    svg.push('<defs><linearGradient id="rtFade" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0" stop-color="#63D6F2" stop-opacity=".22"/>' +
             '<stop offset="1" stop-color="#63D6F2" stop-opacity="0"/></linearGradient></defs>');

    [1.000, 1.005, 1.010, 1.015, 1.020, 1.025].forEach(function (v) {
      svg.push('<line class="rt-grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>');
      svg.push('<text class="rt-axis-text" x="' + (L - 12) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v.toFixed(3) + '</text>');
    });

    var pts = CLOSES.map(function (c, i) { return x(i).toFixed(1) + ',' + y(c.price).toFixed(1); });
    svg.push('<path class="rt-series-area" d="M' + pts.join('L') + 'L' + x(CLOSES.length - 1).toFixed(1) + ',' + y(lo) + 'L' + L + ',' + y(lo) + 'Z"/>');
    svg.push('<path class="rt-series" d="M' + pts.join('L') + '"/>');

    svg.push('<line class="rt-crosshair" id="cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '"/>');

    CLOSES.forEach(function (c, i) {
      svg.push('<text class="rt-axis-text" x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + c.label + '</text>');
      svg.push('<circle class="rt-dot" cx="' + x(i).toFixed(1) + '" cy="' + y(c.price).toFixed(1) + '" r="4.5"/>');
      svg.push('<circle class="rt-dot-hit" data-i="' + i + '" cx="' + x(i).toFixed(1) + '" cy="' + y(c.price).toFixed(1) + '" r="22"/>');
    });

    var last = CLOSES.length - 1;
    svg.push('<text class="rt-last-label" x="' + (x(last) + 12) + '" y="' + (y(CLOSES[last].price) + 4).toFixed(1) + '">€1.0254</text>');
    svg.push('</svg>');

    host.insertAdjacentHTML('afterbegin', svg.join(''));

    var svgEl = $('svg', host), cross = $('#cross', host);

    function show(i, node) {
      var c = CLOSES[i];
      var box = host.getBoundingClientRect(), nb = node.getBoundingClientRect();
      tip.innerHTML = c.kept === null
        ? '<b>' + c.date + '</b><br><i>The vault opened at €1.0000</i>'
        : '<b>' + c.date + '</b><br>Price <i>€' + c.price.toFixed(4) + '</i><br>Kept ' + euro(c.kept, 0) + ' <i>of ' + euro(c.collected, 0) + '</i>';
      tip.style.left = (nb.left - box.left + nb.width / 2) + 'px';
      tip.style.top  = (nb.top - box.top + nb.height / 2) + 'px';
      tip.classList.add('is-on');
      cross.setAttribute('x1', node.getAttribute('cx'));
      cross.setAttribute('x2', node.getAttribute('cx'));
      cross.style.opacity = '1';
    }
    function hide() {
      tip.classList.remove('is-on');
      cross.style.opacity = '0';
    }

    $$('.rt-dot-hit', svgEl).forEach(function (n) {
      var i = parseInt(n.getAttribute('data-i'), 10);
      n.addEventListener('mouseenter', function () { show(i, n); });
      n.addEventListener('mouseleave', hide);
      n.addEventListener('touchstart', function () { show(i, n); }, { passive: true });
    });
    host.addEventListener('mouseleave', hide);
  }
  chart();
})();
