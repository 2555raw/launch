// AZUR — charts, feed marquee, cycling prompt bubbles and hub wiring.
(function () {
  "use strict";

  // Asset badges. Bitcoin and Ethereum use their openly licensed marks; every
  // other ticker shows as text unless assets/logos/<ticker>.png exists, in which
  // case that file is drawn over it (add official logos there if you have the
  // right to use them).
  const MARKS = {
    BTC: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#f7931a"/><path fill="#fff" d="M46.1 27.4c.6-4.2-2.6-6.5-7-8l1.4-5.7-3.5-.9-1.4 5.6-2.8-.7 1.4-5.6-3.5-.9-1.4 5.7-2.2-.5-4.8-1.2-.9 3.7s2.6.6 2.5.6c1.4.4 1.7 1.3 1.6 2l-1.6 6.5.4.1-.4-.1-2.3 9.1c-.2.4-.6 1.1-1.6.8l-2.5-.6-1.7 4 4.6 1.1 2.5.7-1.4 5.8 3.5.9 1.4-5.7 2.8.7-1.4 5.7 3.5.9 1.4-5.8c6 1.1 10.5.7 12.4-4.7 1.5-4.4-.1-6.9-3.2-8.5 2.3-.5 4-2 4.4-5.1zm-8 11.2c-1.1 4.4-8.4 2-10.8 1.4l1.9-7.7c2.4.6 10 1.8 8.9 6.3zm1.1-11.3c-1 4-7.1 2-9.1 1.5l1.8-7c2 .5 8.3 1.4 7.3 5.5z"/></svg>',
    ETH: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#627eea"/><g fill="#fff"><path fill-opacity=".6" d="M32 8v17.7l15 6.7z"/><path d="M32 8 17 32.4l15-6.7z"/><path fill-opacity=".6" d="M32 44v12l15-20.8z"/><path d="M32 56V44l-15-8.8z"/><path fill-opacity=".2" d="m32 41.2 15-8.8-15-6.7z"/><path fill-opacity=".6" d="m17 32.4 15 8.8V25.7z"/></g></svg>'
  };
  // Company marks (icon data from Simple Icons, CC0), each on its brand colour.
  MARKS.GOOGL = "<svg viewBox=\"0 0 64 64\"><defs><clipPath id=\"gclip\"><path d=\"M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z\"/></clipPath></defs><circle cx=\"32\" cy=\"32\" r=\"32\" fill=\"#ffffff\"/><g transform=\"translate(18 18) scale(1.1667)\" clip-path=\"url(#gclip)\"><polygon fill=\"#4285f4\" points=\"12,12 30.13,3.55 31.14,6.19 31.77,8.96 32.00,11.78 31.83,14.61 31.26,17.39 30.31,20.05 28.98,22.56 27.32,24.86\"/><polygon fill=\"#34a853\" points=\"12,12 27.32,24.86 24.00,28.00 20.05,30.31 15.69,31.66 11.13,31.98 6.61,31.26 2.38,29.53 -1.35,26.89 -4.38,23.47\"/><polygon fill=\"#fbbc05\" points=\"12,12 -4.38,23.47 -5.94,20.85 -7.07,18.01 -7.77,15.04 -8.00,12.00 -7.77,8.96 -7.07,5.99 -5.94,3.15 -4.38,0.53\"/><polygon fill=\"#ea4335\" points=\"12,12 -4.38,0.53 -0.86,-3.32 3.55,-6.13 8.53,-7.70 13.74,-7.92 18.84,-6.79 23.47,-4.38 27.32,-0.86 30.13,3.55\"/></g></svg>";
  MARKS.HOOD = "<svg viewBox=\"0 0 64 64\"><circle cx=\"32\" cy=\"32\" r=\"32\" fill=\"#ccff00\"/><g transform=\"translate(18 18) scale(1.1667)\"><path fill=\"#000000\" d=\"M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852\"/></g></svg>";
  MARKS.AAPL = "<svg viewBox=\"0 0 64 64\"><circle cx=\"32\" cy=\"32\" r=\"32\" fill=\"#1c1c1e\"/><g transform=\"translate(18 18) scale(1.1667)\"><path fill=\"#ffffff\" d=\"M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701\"/></g></svg>";
  MARKS.TSLA = "<svg viewBox=\"0 0 64 64\"><circle cx=\"32\" cy=\"32\" r=\"32\" fill=\"#e31937\"/><g transform=\"translate(18 18) scale(1.1667)\"><path fill=\"#ffffff\" d=\"M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z\"/></g></svg>";
  MARKS.NVDA = "<svg viewBox=\"0 0 64 64\"><circle cx=\"32\" cy=\"32\" r=\"32\" fill=\"#76b900\"/><g transform=\"translate(14.5 14.5) scale(1.4583)\"><path fill=\"#ffffff\" d=\"M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z\"/></g></svg>";
  document.querySelectorAll(".coin[data-t]").forEach((el) => {
    const t = el.dataset.t;
    if (MARKS[t]) { el.innerHTML = MARKS[t]; el.classList.add("mark"); return; }
    el.textContent = t;
    if (t.length > 3) el.classList.add(t.length > 4 ? "xlong" : "long");
    const img = new Image();
    img.alt = "";
    img.onload = () => el.appendChild(img);
    img.src = "assets/logos/" + t.toLowerCase() + ".png";
  });

  // Seeded random walk so the charts look the same on every load.
  function walk(seed, n, drift, vol) {
    let s = seed, v = 0;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = [];
    for (let i = 0; i < n; i++) {
      v += drift + (rnd() - 0.5) * vol;
      pts.push(v);
    }
    return pts;
  }

  function toPath(pts, w, h, pad) {
    const min = Math.min(...pts), max = Math.max(...pts);
    const sx = w / (pts.length - 1);
    const sy = (h - pad * 2) / (max - min || 1);
    return pts.map((p, i) => (i ? "L" : "M") + (i * sx).toFixed(1) + " " + (h - pad - (p - min) * sy).toFixed(1)).join(" ");
  }

  // Balance charts (hero and docs): line, glow fill under it, and a live dot at the end.
  document.querySelectorAll("#heroChart, .doc-chart").forEach((svg, n) => {
    const pts = walk(+(svg.dataset.seed || 7), 90, 0.18, 4.2);
    const d = toPath(pts, 290, 170, 12);
    const end = d.slice(d.lastIndexOf("L") + 1).split(" ").map(Number);
    const id = "hg" + n;
    svg.innerHTML =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2f7bff" stop-opacity=".45"/><stop offset="1" stop-color="#2f7bff" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<path d="' + d + " L290 170 L0 170 Z" + '" fill="url(#' + id + ')"/>' +
      '<path class="line" d="' + d + '"/>' +
      '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="4" fill="#9cc7ff"/>';
  });

  // Small sparklines: red ones trend down, blue ones trend up.
  document.querySelectorAll(".spark").forEach((svg, i) => {
    const up = svg.classList.contains("up-l");
    const pts = walk(31 + i * 17, 50, up ? 0.25 : -0.05, 5);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = '<path d="' + toPath(pts, 100, +svg.viewBox.baseVal.height, 3) + '"/>';
  });

  // Feed marquee. Every account here is made up, and so is every avatar:
  // small hand-drawn SVGs, a few illustrated people and a few outlet logos.
  const V = (inner) => '<svg viewBox="0 0 64 64" aria-hidden="true">' + inner + "</svg>";
  const person = (bg, skin, hair, shirt, style) => V(
    '<rect width="64" height="64" fill="' + bg + '"/>' +
    '<path d="M6 64c2-12 13-17 26-17s24 5 26 17z" fill="' + shirt + '"/>' +
    '<rect x="27" y="36" width="10" height="12" rx="4" fill="' + skin + '" opacity=".85"/>' +
    '<ellipse cx="32" cy="28" rx="11" ry="13" fill="' + skin + '"/>' +
    ({
      short: '<path d="M20.5 26c-.5-9 5-14 11.5-14s12 4.5 11.5 14c-2-5-6-7.5-11.5-7.5S22.5 21 20.5 26z" fill="' + hair + '"/>',
      curly: '<g fill="' + hair + '"><circle cx="22" cy="21" r="5"/><circle cx="27" cy="15.5" r="5.5"/><circle cx="34" cy="14.5" r="5.5"/><circle cx="40.5" cy="18.5" r="5"/><circle cx="43" cy="25" r="3.5"/><circle cx="21" cy="27" r="3.5"/></g>',
      long: '<path d="M19 44c-1-12-2-32 13-32s14 20 13 32c-2-8-3-15-4-20-4 3-10 4-17 3-1 5-2 10-5 17z" fill="' + hair + '"/>',
      bald: '<path d="M21 27c0-2 .5-3.5 1-4.5 1 1.5 1 3 1 4.5zM43 27c0-2-.5-3.5-1-4.5-1 1.5-1 3-1 4.5z" fill="' + hair + '"/>'
    })[style] +
    '<circle cx="27.5" cy="29" r="1.4" fill="#1b1b1f"/><circle cx="36.5" cy="29" r="1.4" fill="#1b1b1f"/>' +
    '<path d="M28.5 35c2 1.6 5 1.6 7 0" fill="none" stroke="#1b1b1f" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>'
  );
  const av = {
    tapereader: person("#6f7f96", "#e9c3a4", "#3b2a20", "#1d2b44", "short"),
    orbitweekly: V('<rect width="64" height="64" fill="#050608"/><circle cx="32" cy="32" r="11" fill="#e9eef7"/>' +
      '<ellipse cx="32" cy="32" rx="22" ry="7" fill="none" stroke="#5aa2ff" stroke-width="3" transform="rotate(-20 32 32)"/>' +
      '<path d="M21 32a11 11 0 0 0 22 0" fill="#e9eef7"/>'),
    chainside: V('<rect width="64" height="64" fill="#12151b"/><g fill="none" stroke="#fff" stroke-width="4">' +
      '<rect x="12" y="24" width="24" height="16" rx="8"/><rect x="28" y="24" width="24" height="16" rx="8" stroke="#5aa2ff"/></g>'),
    launchpill: V('<rect width="64" height="64" fill="#f4f6f9"/><g transform="rotate(-40 32 32)">' +
      '<path d="M20 32a8 8 0 0 1 8-8h4v16h-4a8 8 0 0 1-8-8z" fill="#e5484d"/><path d="M32 24h4a8 8 0 0 1 0 16h-4z" fill="#2f7bff"/></g>'),
    macropulse: V('<rect width="64" height="64" fill="#0f3d2a"/><polyline points="10,34 22,34 27,22 34,44 39,30 42,34 54,34" fill="none" stroke="#7ef0b4" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'),
    oddflows: V('<rect width="64" height="64" fill="#d9ecff"/><path d="M12 38c0-9 9-14 19-14 9 0 15 5 17 11l6-6-1 13c-6 5-13 6-22 6-11 0-19-3-19-10z" fill="#2f6fd6"/>' +
      '<circle cx="24" cy="34" r="1.8" fill="#fff"/><path d="M30 22c0-4-3-6-3-9M30 22c0-4 3-6 3-9" fill="none" stroke="#5aa2ff" stroke-width="2.2" stroke-linecap="round"/>'),
    wirewatch: V('<rect width="64" height="64" fill="#10b35c"/><path d="M36 10 18 36h12l-4 18 20-28H34z" fill="#06140c"/>'),
    devdiaries: person("#c97d4e", "#8d5a3b", "#1a1210", "#f2f2f2", "curly"),
    hottokens: V('<rect width="64" height="64" fill="#1c1c1f"/><path d="M32 12c8 11 14 18 14 26a14 14 0 0 1-28 0c0-8 6-15 14-26z" fill="#f59e0b"/><path d="M32 30c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#fde68a"/>'),
    stocktokendaily: person("#9aa7c7", "#f1d2bd", "#b9793f", "#2f4f8f", "long"),
  };
  // Real posts as shown on screen; each card links to the author's profile on X.
  const posts = [
    ["*Walter Bloomberg", "Deltaone", "MUSK TARGETS RETAIL INVESTORS IN SPACEX IPO Elon Musk is considering allocating up to 30% of SpaceX's IPO to retail investors—far…", "#1f2937", "WB"],
    ["AST SpaceMobile", "AST_SpaceMobile", "FCC Grants AST SpaceMobile Commercial Authority to Deliver Direct-to-Device Cellular Broadband from Space Advancing…", "#0b0b0b", "AST"],
    ["Vlad Tenev", "vladtenev", "While we're building robinhood chain to be the best chain for RWA … it works great for memes too", "#1e3a5f", "VT"],
    ["Hims House", "himshouse", "🚨 BREAKING: FDA PEPTIDE PANEL VOTES YES ON BPC-157 $HIMS", "#f3efe6", "HH"],
    ["Watcher.Guru", "WatcherGuru", "JUST IN: us SEC prepares to allow blockchain-based tokenized stock trading.", "#12a150", "WG"],
    ["Johann Kerbrat", "JohannKerbrat", "$540M+ in protocol TVL. Three weeks in. Just getting started.", "#7c4a2d", "JK"],
    ["Polymarket Money", "PolymarketMoney", "BREAKING: US PPI falls to 5.5%, lower than expectations.", "#0f5132", "PM"],
    ["unusual_whales", "unusual_whales", "Trump: Russia ready to make a deal with Ukraine soon.", "#1d4ed8", "UW"],
  ];
  const check = '<svg class="ck" viewBox="0 0 24 24"><path d="M12 1l2.6 2.2 3.4-.4 1 3.3 3 1.7-1 3.2 1 3.2-3 1.7-1 3.3-3.4-.4L12 23l-2.6-2.2-3.4.4-1-3.3-3-1.7 1-3.2-1-3.2 3-1.7 1-3.3 3.4.4z"/><path d="M7.5 12.2l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.2"/></svg>';
  const mono = (bg, txt) => V('<rect width="64" height="64" fill="' + bg + '"/><text x="32" y="38" text-anchor="middle" font-family="Inter Tight,Inter,sans-serif" font-weight="800" font-size="' + (txt.length > 2 ? 17 : 22) + '" fill="' + (bg === "#f3efe6" ? "#1b1b1f" : "#fff") + '">' + txt + "</text>");
  const card = (p) =>
    '<a class="post" href="https://x.com/' + p[1] + '" target="_blank" rel="noopener"><span class="pfp">' + mono(p[3], p[4]) + "</span>" +
    '<div><div class="post-h"><b>' + p[0] + "</b>" + check + "<span>@" + p[1] + "</span></div><p>" + p[2] + "</p></div></a>";

  document.querySelectorAll(".feed-row").forEach((row, r) => {
    const list = r ? posts.slice(5).concat(posts.slice(0, 5)) : posts;
    const html = list.map(card).join("");
    row.innerHTML = html + html; // doubled so the loop is seamless
  });

  // Signal hub: every so often a news card lights up, a signal travels into the
  // star, and one of the alerts around it fires. Links fan out to the alerts.
  const monitor = document.querySelector(".monitor");
  const burst = document.querySelector(".burst");
  const star = burst && burst.querySelector(".star");
  const links = document.getElementById("burstLinks");
  const alertEls = [...document.querySelectorAll(".alert")];
  const centerOf = (el, rel) => {
    const r = el.getBoundingClientRect(), b = rel.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
  };
  function drawLinks() {
    if (!links || getComputedStyle(links).display === "none") return;
    const s = centerOf(star, burst);
    const b = burst.getBoundingClientRect();
    links.innerHTML = alertEls.map((a) => {
      const r = a.getBoundingClientRect();
      const leftSide = r.left + r.width / 2 < b.left + s.x;
      const x = (leftSide ? r.right - 6 : r.left + 6) - b.left;
      const y = r.top + r.height / 2 - b.top;
      const d = "M" + s.x + " " + s.y + " C" + (s.x + (x - s.x) * 0.45) + " " + s.y + " " + (x - (x - s.x) * 0.35) + " " + y + " " + x + " " + y;
      return '<path class="base" d="' + d + '"/><path class="flow" d="' + d + '"/>';
    }).join("");
  }
  if (burst && star) {
    window.addEventListener("resize", drawLinks);
    document.fonts ? document.fonts.ready.then(drawLinks) : window.addEventListener("load", drawLinks);
    drawLinks();

    const canFly = window.CSS && CSS.supports("offset-path", 'path("M0 0L1 1")') &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function fire() {
      if (!canFly || document.hidden || window.innerWidth <= 760) return;
      const m = monitor.getBoundingClientRect();
      if (m.bottom < 0 || m.top > window.innerHeight) return;
      const cards = [...document.querySelectorAll(".post")].filter((p) => {
        const r = p.getBoundingClientRect(), cx = r.left + r.width / 2;
        return cx > window.innerWidth * 0.12 && cx < window.innerWidth * 0.88;
      });
      if (!cards.length) return;
      const card = cards[(Math.random() * cards.length) | 0];
      card.classList.add("hot");
      setTimeout(() => card.classList.remove("hot"), 1700);
      const r = card.getBoundingClientRect();
      const x0 = r.left + r.width / 2 - m.left, y0 = r.bottom - m.top;
      const s = centerOf(star, monitor);
      const dot = document.createElement("span");
      dot.className = "signal";
      dot.style.offsetPath = 'path("M' + x0 + " " + y0 + " Q" + x0 + " " + (s.y - 20) + " " + s.x + " " + s.y + '")';
      monitor.appendChild(dot);
      dot.animate(
        [{ offsetDistance: "0%", opacity: 0 }, { opacity: 1, offset: 0.12 }, { offsetDistance: "100%", opacity: 1 }],
        { duration: 1200, easing: "cubic-bezier(.45,0,.75,1)" }
      ).onfinish = () => {
        dot.remove();
        star.classList.remove("hit");
        void star.offsetWidth;
        star.classList.add("hit");
        const al = alertEls[(Math.random() * alertEls.length) | 0];
        al.classList.add("ping");
        setTimeout(() => al.classList.remove("ping"), 1900);
      };
    }
    setInterval(fire, 1600);
  }

  // Prompt bubbles: one at a time turns blue.
  const bubbles = document.querySelectorAll(".bubble");
  let on = 0;
  if (bubbles.length) {
    bubbles[0].classList.add("on");
    setInterval(() => {
      bubbles[on].classList.remove("on");
      on = (on + 1) % bubbles.length;
      bubbles[on].classList.add("on");
    }, 1800);
  }

  // Hub wiring: curved connectors from each feature to the centre tile.
  const hub = document.getElementById("hub");
  const wires = document.getElementById("wires");
  function wire() {
    if (!hub || !wires || getComputedStyle(wires).display === "none") return;
    const box = hub.getBoundingClientRect();
    const core = hub.querySelector(".core-tile").getBoundingClientRect();
    const cy = core.top + core.height / 2 - box.top;
    let out = "";
    hub.querySelectorAll(".node").forEach((n) => {
      const r = n.getBoundingClientRect();
      const left = n.dataset.side === "l";
      const x1 = (left ? r.right : r.left) - box.left;
      const y1 = r.top + r.height / 2 - box.top;
      const x2 = (left ? core.left : core.right) - box.left;
      const mx = (x1 + x2) / 2;
      const d = "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + cy + " " + x2 + " " + cy;
      out += '<path d="' + d + '"/><path class="flow" d="' + d + '" style="animation-delay:' + (-Math.random() * 3.5).toFixed(2) + 's"/>';
    });
    wires.innerHTML = out;
  }
  window.addEventListener("resize", wire);
  document.fonts ? document.fonts.ready.then(wire) : window.addEventListener("load", wire);
  wire();

  // Terms gate: shown until the visitor accepts, then remembered per browser.
  const gate = document.getElementById("gate");
  if (gate) {
    const KEY = "azur-terms-accepted-v1";
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (e) {}
    const boxes = [...gate.querySelectorAll("input[type=checkbox]")];
    const ok = document.getElementById("gateOk");
    const no = document.getElementById("gateNo");
    const note = document.getElementById("gateNote");
    if (!seen) {
      gate.hidden = false;
      document.body.classList.add("gated");
      boxes[0].focus({ preventScroll: true });
    }
    const update = () => { ok.disabled = !boxes.every((b) => b.checked); };
    boxes.forEach((b) => b.addEventListener("change", () => { update(); note.hidden = true; }));
    no.addEventListener("click", () => { note.hidden = false; });
    ok.addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      gate.classList.add("out");
      setTimeout(() => {
        gate.hidden = true;
        document.body.classList.remove("gated");
      }, 200);
    });
    // keep keyboard focus inside the dialog while it is open
    gate.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...gate.querySelectorAll("input, a, button:not(:disabled)")];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    update();
  }

  // ---------------------------------------------------------------- site config
  // Put the real community links here; every Discord and X icon on the site uses them.
  const SOCIAL = {
    discord: "",   // e.g. "https://discord.gg/your-invite"
    x: "https://x.com/useAzur",
  };
  const LIVE_SITE = "https://spinpad-production.up.railway.app";
  document.querySelectorAll("[data-social]").forEach((a) => {
    const url = SOCIAL[a.dataset.social];
    if (url) a.href = url;
  });
  // The API only exists on the real server; previews and copies of the page skip it.
  const HAS_API = /^https?:$/.test(location.protocol) && !/claude|anthropic|usercontent/i.test(location.hostname);

  // ---------------------------------------------------------------- waitlist
  document.querySelectorAll("form.wl").forEach((form) => {
    const input = form.querySelector("input[type=email]");
    const btn = form.querySelector("button");
    const msg = form.querySelector(".wl-msg");
    const say = (text, kind) => { msg.innerHTML = text; msg.className = "wl-msg " + (kind || ""); };
    input.addEventListener("input", () => { if (msg.classList.contains("err")) say(""); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
        say("Enter a valid email, like name@example.com.", "err");
        input.focus();
        return;
      }
      if (!HAS_API) {
        say('Sign-ups open on the live site: <a href="' + LIVE_SITE + '/#join" target="_blank" rel="noopener">join there</a>.', "err");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Joining…";
      try {
        const r = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, source: form.dataset.source, website: form.querySelector(".hp").value }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
        form.classList.add("done");
        say(data.already
          ? "You're already on the list at #" + data.position + ". We'll email you soon."
          : "You're in. You are #" + data.position + " on the waitlist. Watch your inbox.", "ok");
      } catch (err) {
        say(err.message === "Failed to fetch" ? "Could not reach the server. Check your connection and try again." : err.message, "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "Join the waitlist";
      }
    });
  });

  // Official store badges: drop app-store.svg and google-play.svg (from Apple's and
  // Google's badge pages) into assets/badges/ and they replace the placeholder buttons.
  document.querySelectorAll("a.store[data-badge]").forEach((a) => {
    const img = new Image();
    img.alt = a.dataset.badge === "app-store" ? "Download on the App Store" : "Get it on Google Play";
    img.onload = () => {
      a.classList.add("has-badge");
      [...a.children].forEach((c) => { if (c.tagName !== "EM") c.remove(); });
      a.prepend(img);
    };
    img.src = "assets/badges/" + a.dataset.badge + ".svg";
  });

  // Store buttons, pricing buttons and "#join" links all lead to a form.
  function focusForm(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const form = input.closest("form");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      input.focus({ preventScroll: true });
      form.classList.remove("flash");
      void form.offsetWidth;
      form.classList.add("flash");
    }, 350);
  }
  document.querySelectorAll('a.store[href="#wlHero"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); focusForm("wlHero"); }));
  document.querySelectorAll('a[href="#join"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); focusForm("wlFoot"); }));

  // ---------------------------------------------------------------- live prices
  const pills = [...document.querySelectorAll(".pill")];
  const fmtPrice = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0 });
  async function loadPrices() {
    try {
      const r = await fetch("/api/prices");
      if (!r.ok) return;
      const { prices } = await r.json();
      pills.forEach((pill) => {
        const t = pill.querySelector(".coin").dataset.t;
        const p = prices[t];
        if (!p) return;
        const b = pill.querySelector(".pv b");
        const up = p.change >= 0;
        b.textContent = (up ? "+" : "−") + Math.abs(p.change).toFixed(2) + "%";
        b.classList.toggle("dn", !up);
        pill.querySelector(".pv small").textContent = t + " " + fmtPrice(p.price);
        pill.title = t + " live price";
      });
    } catch (e) { /* keep the sample figures */ }
  }
  if (pills.length && HAS_API) {
    loadPrices();
    setInterval(loadPrices, 60 * 1000);
  }

  // ---------------------------------------------------------------- page views
  // One small, cookie-free ping per page load, counted on our own server.
  if (HAS_API) {
    const payload = JSON.stringify({ path: location.pathname, ref: document.referrer });
    try {
      navigator.sendBeacon ? navigator.sendBeacon("/api/hit", new Blob([payload], { type: "application/json" }))
        : fetch("/api/hit", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true });
    } catch (e) { /* not important */ }
  }

  // ---------------------------------------------------------------- film
  const filmModal = document.getElementById("filmModal");
  if (filmModal) {
    const video = document.getElementById("filmVideo");
    const openBtn = document.getElementById("filmOpen");
    const close = () => { video.pause(); filmModal.hidden = true; document.body.classList.remove("gated"); openBtn.focus(); };
    openBtn.addEventListener("click", () => {
      filmModal.hidden = false;
      document.body.classList.add("gated");
      video.currentTime = 0;
      video.play().catch(() => {});
      document.getElementById("filmClose").focus();
    });
    document.getElementById("filmClose").addEventListener("click", close);
    filmModal.addEventListener("click", (e) => { if (e.target === filmModal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !filmModal.hidden) close(); });
  }
})();
