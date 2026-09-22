/* ===========================================================================
   RENTA — page behaviour. No dependencies.
   =========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- the vault ---
     One source of truth: data/vault.js, written by scripts/recompute.js from
     the Rolls. The calculator, the chart and the copy all read from here, so
     a number can never disagree with itself on this page.                  */
  var D = window.RENTA_DATA;
  if (!D) { console.error('RENTA: data/vault.js did not load'); return; }

  /* ------------------------------------------------------ language ------
     The page's lang decides the words and the number format. Only English
     ships; a second language is a table here plus a dictionary in i18n/. */
  var LANG = document.documentElement.lang || 'en';
  var LOCALE = { en: 'en-GB', zh: 'zh-CN' }[LANG] || 'en-GB';
  var STRINGS = {
    en: {
      months: {}, long: { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' },
      words: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
      opened: 'The vault opened at ', price: 'Price', kept: 'Kept', of: 'of',
      chartAria: function (a, b, p) { return 'Line chart of the vRENTA share price rising from 1.0000 euro on ' + a + ' to ' + p + ' at the close of ' + b + '. The figures behind it are listed in The Roll table above.'; },
      note: function (d, sh, n, p4, w, r, c) { return 'Deposited on ' + d + ' at €1.0000, that is <b>' + sh + ' vRENTA</b>. After ' + n + ' closes vRENTA is ' + p4 + ', so it is worth <b>' + w + '</b> — ' + r + ' of rent the vault kept, and ' + c + ' from the curve tax. Nothing was paid out along the way.'; },
      cities: {}, countries: {},
      building: function (n) { return n + ' building' + (n > 1 ? 's' : ''); }, apartments: 'apartments', netRentClose: 'of net rent at the last close.',
      cityAria: function (c, n) { return 'Schematic map of ' + c + ' by district, with ' + n + ' building' + (n > 1 ? 's' : '') + ' marked.'; },
      built: 'built', bought: 'bought', facts: ['Apartments', 'Let', 'Held at', 'Net rent, last close'], also: 'Also in '
    }
  };
  var TX = STRINGS[LANG] || STRINGS.en;   /* not T: the chart uses T for its top margin */
  var tr = function (map, k) { return map[k] || k; };

  var euro = function (n, dp) {
    return '€' + n.toLocaleString(LOCALE, {
      minimumFractionDigits: dp === undefined ? 2 : dp,
      maximumFractionDigits: dp === undefined ? 2 : dp
    });
  };
  var price4 = function (p) { return '€' + p.toFixed(4); };
  var dateT = function (d) { var p = d.split(' '); return p[0] + ' ' + tr(TX.months, p[1]) + ' ' + p[2]; };


  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CLOSES = [{ date: dateT('1 ' + MON[+D.closes[0].month.slice(5, 7) - 1] + ' ' + D.closes[0].month.slice(0, 4)),
                  label: tr(TX.months, 'Opened'), price: 1, rent: 0, curve: 0, collected: null, costs: null, kept: null }]
    .concat(D.closes.map(function (c) {
      return { date: dateT(c.date), label: tr(TX.months, c.label), price: c.price, rent: c.rentPerShare, curve: c.curvePerShare,
               collected: c.collected, costs: c.costs, kept: c.kept };
    }));

  var PRICE_NOW   = D.price;
  var RENT_TOTAL  = D.rentPerShareTotal;
  var CURVE_TOTAL = D.curvePerShareTotal;


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
  /* Connect wallet is handled by gate.js + wallet.js; app.js only lends them the toast */
  window.RENTA_SAY = say;

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
  var sections = ['portfolio', 'roll', 'dashboard', 'faq'].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('#navlinks a').forEach(function (a) {
          var owns = a.getAttribute('data-spy') || (a.getAttribute('href') || '').slice(1);
          a.classList.toggle('is-active', owns === e.target.id);
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
  var pins = $$('.rt-pin'), props = $$('#portfolio tr[data-city]'), shapes = $$('.rt-c');

  /* -------------------------------------------------------- city view ----
     Click a pin, or a building, and step into the city: its districts, the
     one the building is in lit, and the building itself at its real spot. */
  var CITIES = window.RENTA_CITIES || {};
  var FACADES = window.RENTA_FACADES || {};
  var view = $('#cityview'), lastFocus = null;

  function cityHTML(city) {
    var c = CITIES[city]; if (!c) return null;
    var mine = D.buildings.filter(function (b) { return b.city === city; });
    var svg = ['<svg viewBox="' + c.viewBox + '" class="rt-city-svg" role="img" aria-label="' + TX.cityAria(tr(TX.cities, city), mine.length) + '">'];
    svg.push('<defs><clipPath id="cityclip"><path d="' + c.limit + '"/></clipPath></defs>');
    svg.push('<path class="rt-city-limit" d="' + c.limit + '"/>');
    svg.push('<g clip-path="url(#cityclip)">');
    c.districts.forEach(function (d, i) {
      svg.push('<path class="rt-dist' + (d.own ? ' rt-dist--own' : '') + (i % 2 ? ' rt-dist--alt' : '') + '" d="' + d.d + '" data-district="' + d.name + '"><title>' + d.name + '</title></path>');
    });
    svg.push('</g>');
    /* labels: the small central cells keep their name for hover only, and a
       district that holds a building gets its name moved clear of the pin */
    c.districts.forEach(function (d) {
      if (d.area < 2100 && !d.own) return;
      var small = d.area < 3200;
      var x = d.cx, y = d.cy;
      c.buildings.forEach(function (b) { if (Math.hypot(b.x - x, b.y - y) < 34) y = b.y - 22; });
      svg.push('<text class="rt-dist-label' + (d.own ? ' rt-dist-label--own' : '') + (small ? ' rt-dist-label--sm' : '') + '" x="' + x + '" y="' + y + '" text-anchor="middle">' + d.name + '</text>');
    });
    c.buildings.forEach(function (b, i) {
      svg.push('<g class="rt-pin rt-pin--city" data-building="' + b.id + '" tabindex="0" role="img" aria-label="' + b.name + ', ' + b.district + '">' +
        '<title>' + b.name + '</title>' +
        '<circle class="rt-pin-ping" cx="' + b.x + '" cy="' + b.y + '" r="11" style="animation-delay:' + (i * 0.5) + 's"/>' +
        '<circle class="rt-pin-ring" cx="' + b.x + '" cy="' + b.y + '" r="12"/>' +
        '<circle class="rt-pin-dot" cx="' + b.x + '" cy="' + b.y + '" r="6.5"/></g>');
    });
    /* scale bar and north */
    var W = +c.viewBox.split(' ')[2], H = +c.viewBox.split(' ')[3];
    svg.push('<g class="rt-city-scale"><line x1="' + (W - 30 - c.scalePx) + '" y1="' + (H - 22) + '" x2="' + (W - 30) + '" y2="' + (H - 22) + '"/>' +
      '<line x1="' + (W - 30 - c.scalePx) + '" y1="' + (H - 27) + '" x2="' + (W - 30 - c.scalePx) + '" y2="' + (H - 17) + '"/><line x1="' + (W - 30) + '" y1="' + (H - 27) + '" x2="' + (W - 30) + '" y2="' + (H - 17) + '"/>' +
      '<text x="' + (W - 30 - c.scalePx / 2) + '" y="' + (H - 30) + '" text-anchor="middle">' + c.scaleKm + ' km</text></g>');
    svg.push('<g class="rt-city-north"><path d="M' + (W - 30) + ',22 l-6,16 6,-4 6,4z"/><text x="' + (W - 30) + '" y="52" text-anchor="middle">N</text></g>');
    svg.push('</svg>');

    var side = mine.map(function (b) {
      return '<article class="rt-bcard" data-building="' + b.id + '">' +
        '<div class="rt-bcard-art">' + (FACADES[b.id] || '') + '</div>' +
        '<div class="rt-bcard-body">' +
        '<h3 class="rt-h4">' + b.name + '</h3>' +
        '<p class="rt-bcard-district">' + b.district + ' · ' + TX.built + ' ' + b.built + ' · ' + TX.bought + ' ' + b.bought.slice(0, 7) + '</p>' +
        '<dl class="rt-bcard-facts">' +
        '<div><dt>' + TX.facts[0] + '</dt><dd class="rt-num">' + b.units + '</dd></div>' +
        '<div><dt>' + TX.facts[1] + '</dt><dd class="rt-num">' + b.let + '%</dd></div>' +
        '<div><dt>' + TX.facts[2] + '</dt><dd class="rt-num">' + euro(b.value, 0) + '</dd></div>' +
        '<div><dt>' + TX.facts[3] + '</dt><dd class="rt-num rt-pos">' + euro(b.net, 0) + '</dd></div>' +
        '</dl></div></article>';
    }).join('');
    var others = Object.keys(CITIES).filter(function (k) { return k !== city && c.region && CITIES[k].region === c.region; });
    if (others.length) side += '<p class="rt-city-more">' + TX.also + tr(TX.countries, c.region) + ': ' + others.map(function (k) { return '<a href="#map" data-open-city="' + k + '">' + tr(TX.cities, k) + ' →</a>'; }).join(' ') + '</p>';

    var units = mine.reduce(function (s, b) { return s + b.units; }, 0);
    var rent = mine.reduce(function (s, b) { return s + b.net; }, 0);
    return {
      eyebrow: tr(TX.countries, c.country) + (c.region ? ' · ' + tr(TX.countries, c.region) : ''),
      title: tr(TX.cities, city),
      sub: TX.building(mine.length) + ' · ' + units + ' ' + TX.apartments + ' · ' + euro(rent, 0) + ' ' + TX.netRentClose,
      map: svg.join(''), side: side
    };
  }

  function openCity(city) {
    var h = cityHTML(city); if (!h || !view) return;
    $('#city-eyebrow').textContent = h.eyebrow;
    $('#city-title').textContent = h.title;
    $('#city-sub').textContent = h.sub;
    $('#city-map').innerHTML = h.map;
    $('#city-side').innerHTML = h.side;
    lastFocus = document.activeElement;
    view.hidden = false;
    document.body.classList.add('rt-locked');
    requestAnimationFrame(function () { view.classList.add('is-on'); $('.rt-city-close', view).focus(); });
    /* hovering a card lights its pin and district, and back */
    $$('.rt-bcard', view).concat($$('.rt-pin--city', view)).forEach(function (el) {
      var id = el.getAttribute('data-building');
      var on = function (yes) {
        $$('[data-building="' + id + '"]', view).forEach(function (x) { x.classList.toggle('is-on', yes); });
        var b = D.buildings.filter(function (b) { return b.id === id; })[0];
        if (b) $$('[data-district="' + b.district + '"]', view).forEach(function (x) { x.classList.toggle('is-on', yes); });
      };
      el.addEventListener('mouseenter', function () { on(true); });
      el.addEventListener('mouseleave', function () { on(false); });
    });
    $$('[data-open-city]', view).forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); openCity(a.getAttribute('data-open-city')); });
    });
  }
  function closeCity() {
    if (!view || view.hidden) return;
    view.classList.remove('is-on');
    document.body.classList.remove('rt-locked');
    setTimeout(function () { view.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }, 220);
  }
  if (view) {
    $$('[data-city-close]', view).forEach(function (b) { b.addEventListener('click', closeCity); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCity(); });
  }
  pins.forEach(function (p) {
    var open = function () { openCity(p.getAttribute('data-city')); };
    p.addEventListener('click', open);
    p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  props.forEach(function (r) {
    var open = function () { openCity(r.getAttribute('data-city')); };
    r.addEventListener('click', open);
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  /* which country each city we own in belongs to, so the whole country
     lights up with its pin */
  var COUNTRY = {
    Lisbon: 'Portugal',
    Madrid: 'Spain', Barcelona: 'Spain', Terrassa: 'Spain',
    Turin: 'Italy',
    Leipzig: 'Germany', Rotterdam: 'Netherlands', 'Kraków': 'Poland'
  };
  /* Terrassa is twenty kilometres from Barcelona — one pin at this scale */
  var PIN = { Terrassa: 'Barcelona' };

  function light(city, on) {
    var pin = PIN[city] || city;
    pins.forEach(function (p) {
      if (p.getAttribute('data-city') === pin) p.classList.toggle('is-on', on);
    });
    props.forEach(function (p) {
      if (p.getAttribute('data-city') === city) p.classList.toggle('is-on', on);
    });
    var country = COUNTRY[city];
    if (!country) return;
    shapes.forEach(function (s) {
      if (s.getAttribute('data-country') === country) s.classList.toggle('is-on', on);
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

    oShares.textContent = shares.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' vRENTA';
    oWorth.textContent  = euro(worth);
    oRent.textContent   = '+' + euro(rent);
    oCurve.textContent  = '+' + euro(curve);

    var opened = CLOSES[0].date.slice(0, -5);
    oNote.innerHTML = TX.note(opened, shares.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), TX.words[D.closes.length], price4(PRICE_NOW), euro(worth), euro(rent), euro(curve));
  }

  function setAmount(value, fromInput) {
    var n = Math.max(MIN, Math.min(MAX, Math.round(value || MIN)));
    if (!fromInput) input.value = n.toLocaleString(LOCALE);
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
    var lo = 0.998, hi = Math.ceil((PRICE_NOW + 0.002) * 200) / 200;
    var x = function (i) { return L + (W - L - R) * (i / (CLOSES.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + TX.chartAria(CLOSES[0].date, CLOSES[CLOSES.length - 1].date, price4(PRICE_NOW)) + '">'];

    svg.push('<defs><linearGradient id="rtFade" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0" stop-color="#63D6F2" stop-opacity=".22"/>' +
             '<stop offset="1" stop-color="#63D6F2" stop-opacity="0"/></linearGradient></defs>');

    var grid = []; for (var g = 1.0; g <= hi - 0.001; g += 0.005) grid.push(+g.toFixed(3));
    grid.forEach(function (v) {
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
    svg.push('<text class="rt-last-label" x="' + (x(last) + 12) + '" y="' + (y(CLOSES[last].price) + 4).toFixed(1) + '">' + price4(PRICE_NOW) + '</text>');
    svg.push('</svg>');

    host.insertAdjacentHTML('afterbegin', svg.join(''));

    var svgEl = $('svg', host), cross = $('#cross', host);

    function show(i, node) {
      var c = CLOSES[i];
      var box = host.getBoundingClientRect(), nb = node.getBoundingClientRect();
      tip.innerHTML = c.kept === null
        ? '<b>' + c.date + '</b><br><i>' + TX.opened + price4(1) + '</i>'
        : '<b>' + c.date + '</b><br>' + TX.price + ' <i>' + price4(c.price) + '</i><br>' + TX.kept + ' ' + euro(c.kept, 0) + ' <i>' + TX.of + ' ' + euro(c.collected, 0) + '</i>';
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
