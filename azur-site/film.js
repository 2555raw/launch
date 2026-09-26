// Azur film: every frame is a pure function of time, so the same timeline plays
// live in the browser and renders frame by frame to MP4 (?render).
(function () {
  "use strict";

  const DURATION = 30;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const expoOut = (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p));
  // fade a scene in over [a, a+fi] and out over [b-fo, b]
  const window_ = (t, a, b, fi = 0.35, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));

  // seeded random walk for the charts
  function walk(seed, n, drift, vol) {
    let s = seed, v = 0;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: n }, () => (v += drift + (rnd() - 0.5) * vol));
  }
  function toPath(pts, w, h, top, bottom) {
    const min = Math.min(...pts), max = Math.max(...pts);
    return pts.map((p, i) => [i * w / (pts.length - 1), bottom - (p - min) / (max - min || 1) * (bottom - top)]);
  }
  const d = (xy) => xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  // ---------------------------------------------------------------- scene data
  const sc = [1, 2, 3, 4, 5, 6, 7].map((i) => $("sc" + i));

  // 1: a price line across the screen
  const lineXY = toPath(walk(11, 120, 0.35, 5), 1920, 0, 640, 900);
  const pline = $("pline");
  pline.setAttribute("d", d(lineXY));
  const plineLen = pline.getTotalLength();
  const words = [...$("h1").children];

  // 2: app chart
  const appXY = toPath(walk(5, 70, 0.3, 4), 800, 260, 20, 240);
  $("appLine").setAttribute("d", d(appXY));
  $("appArea").setAttribute("d", d(appXY) + " L800 260 L0 260 Z");
  const appLine = $("appLine");
  const appLen = appLine.getTotalLength();

  // 3: prompt
  const PROMPT = "Tell me when HOOD breaks its 50-day average";
  $("askText").textContent = PROMPT;

  // 4: price crossing its average
  const N = 90;
  const raw = walk(21, N, 0, 6);
  const trend = raw.map((v, i) => v + (i < 55 ? -i * 0.25 : -55 * 0.25 + (i - 55) * 1.4));
  const pxXY = toPath(trend, 1000, 420, 40, 380);
  const maXY = pxXY.map((p, i) => {
    const from = Math.max(0, i - 14);
    const avg = pxXY.slice(from, i + 1).reduce((s, q) => s + q[1], 0) / (i + 1 - from);
    return [p[0], avg + 18];
  });
  $("px").setAttribute("d", d(pxXY));
  $("ma").setAttribute("d", d(maXY));
  const px = $("px"), ma = $("ma");
  const pxLen = px.getTotalLength(), maLen = ma.getTotalLength();
  // where price climbs above the average (smaller y is higher on screen)
  let cross = pxXY.findIndex((p, i) => i > 50 && p[1] < maXY[i][1] - 4);
  if (cross < 0) cross = 70;
  const crossP = cross / (N - 1);
  const crossXY = pxXY[cross];
  const rings = [...$("ring").children];

  // ---------------------------------------------------------------- render one frame
  function render(t) {
    // scene visibility
    const vis = [
      window_(t, 0, 4.2, 0.3, 0.4),
      window_(t, 4.0, 7.6),
      window_(t, 7.4, 12.2, 0.2, 0.3),
      window_(t, 12.0, 17.2),
      window_(t, 17.0, 21.2),
      window_(t, 21.0, 24.2, 0.15, 0.4),
      window_(t, 24.0, 30.0, 0.3, 0.6),
    ];
    sc.forEach((el, i) => { el.style.opacity = vis[i]; el.style.visibility = vis[i] > 0 ? "visible" : "hidden"; });

    // 1 ------------------------------------------------------------
    if (vis[0] > 0) {
      const p = easeInOut(seg(t, 0.15, 3.5));
      pline.style.strokeDasharray = plineLen;
      pline.style.strokeDashoffset = plineLen * (1 - p);
      const pt = pline.getPointAtLength(plineLen * p);
      $("phead").setAttribute("cx", pt.x);
      $("phead").setAttribute("cy", pt.y);
      $("phead").style.opacity = p > 0 && p < 1 ? 1 : p;
      words.forEach((w, i) => {
        const q = easeOut(seg(t, 0.7 + i * 0.28, 1.25 + i * 0.28));
        w.style.opacity = q;
        w.style.filter = "blur(" + (1 - q) * 18 + "px)";
        w.style.transform = "translateY(" + (1 - q) * 50 + "px)";
      });
      sc[0].style.transform = "scale(" + lerp(1, 1.08, seg(t, 3.7, 4.2)) + ")";
    }

    // 2 ------------------------------------------------------------
    if (vis[1] > 0) {
      const r = easeInOut(seg(t, 4.1, 5.3));             // reveal edge, bottom to top
      const edge = (1 - r) * 100;
      $("app").style.clipPath = "inset(" + edge + "% 0 0 0 round 34px)";
      $("app").style.transform = "scale(" + lerp(0.94, 1, easeOut(seg(t, 4.0, 5.6))) + ")";
      // a band of dots rides the reveal edge, then dissolves
      const band = 12 + 40 * (1 - r);
      const yEdge = 180 + 720 * (edge / 100);
      const dots = $("dots");
      dots.style.opacity = 1 - seg(t, 5.2, 5.8);
      const m = "linear-gradient(to bottom, transparent " + (yEdge - band * 4) + "px, #000 " + (yEdge - band) + "px, #000 " + yEdge + "px, transparent " + (yEdge + band * 2) + "px)";
      dots.style.webkitMaskImage = m;
      dots.style.maskImage = m;
      appLine.style.strokeDasharray = appLen;
      appLine.style.strokeDashoffset = appLen * (1 - easeInOut(seg(t, 5.0, 6.4)));
      $("appArea").style.opacity = seg(t, 5.6, 6.4);
      const c = easeOut(seg(t, 5.7, 6.3));
      $("cap2").style.opacity = c;
      $("cap2").style.transform = "translateY(" + (1 - c) * 24 + "px)";
    }

    // 3 ------------------------------------------------------------
    if (vis[2] > 0) {
      const typedP = seg(t, 7.6, 10.2);
      const n = Math.round(PROMPT.length * typedP);
      const typed = $("typed");
      if (typed.textContent.length !== n) typed.textContent = PROMPT.slice(0, n);
      const blinkOn = typedP < 1 ? true : Math.floor((t - 10.2) * 2.4) % 2 === 0;
      $("caret").style.opacity = blinkOn ? 1 : 0;
      // keep the caret near the right third while the line grows
      const w = typed.offsetWidth;
      const tx = Math.min(180, 1380 - w);
      const shrink = easeInOut(seg(t, 10.4, 11.0));
      const big = $("bigtype");
      big.style.transform = "translate(" + lerp(tx, 400, shrink) + "px," + lerp(0, 10, shrink) + "px) scale(" + lerp(1, 0.27, shrink) + ")";
      big.style.transformOrigin = "0 50%";
      big.style.opacity = 1 - seg(t, 10.7, 11.0);
      const a = easeOut(seg(t, 10.55, 11.1));
      const ask = $("ask");
      ask.style.opacity = a;
      ask.style.transform = "scale(" + lerp(0.92, 1, a) + ")";
      // send: pulse, then press
      const pulse = seg(t, 11.2, 11.75);
      const s = 1 + Math.sin(pulse * Math.PI) * 0.12 - (t > 11.6 && t < 11.75 ? 0.08 : 0);
      $("askSend").style.transform = "scale(" + s + ")";
      $("askSend").style.boxShadow = "0 0 " + (30 + Math.sin(pulse * Math.PI) * 50) + "px rgba(47,123,255," + (0.6 + Math.sin(pulse * Math.PI) * 0.3) + ")";
    }

    // 4 ------------------------------------------------------------
    if (vis[3] > 0) {
      const inP = easeOut(seg(t, 12.0, 12.6));
      $("chartCard").style.transform = "translateY(" + (1 - inP) * 50 + "px)";
      const drawP = easeInOut(seg(t, 12.4, 14.8));
      px.style.strokeDasharray = pxLen;
      px.style.strokeDashoffset = pxLen * (1 - drawP);
      ma.style.strokeDasharray = "10 10";
      ma.style.clipPath = "inset(0 " + (1 - drawP) * 100 + "% 0 0)";
      const crossed = drawP >= crossP;
      const tc = 12.4 + 2.4 * crossP;  // roughly when the line reaches the cross
      $("dotX").setAttribute("cx", crossXY[0]);
      $("dotX").setAttribute("cy", crossXY[1]);
      $("dotX").style.opacity = crossed ? 1 : 0;
      rings.forEach((r, i) => {
        const q = seg(t, tc + i * 0.35, tc + 1.4 + i * 0.35);
        r.setAttribute("cx", crossXY[0]);
        r.setAttribute("cy", crossXY[1]);
        r.setAttribute("r", 10 + q * 90);
        r.style.opacity = crossed && q < 1 ? (1 - q) * 0.9 : 0;
      });
      const price = lerp(53.12, 54.94, drawP);
      $("ccPx").textContent = "$" + price.toFixed(2);
      const al = expoOut(seg(t, 14.5, 15.3));
      $("alertCard").style.opacity = al;
      $("alertCard").style.transform = "translateX(" + (1 - al) * 140 + "px)";
    }

    // 5 ------------------------------------------------------------
    if (vis[4] > 0) {
      const o = easeOut(seg(t, 17.0, 17.6));
      $("order").style.transform = "scale(" + lerp(0.94, 1, o) + ")";
      // cursor glides to Approve and clicks
      const m = easeInOut(seg(t, 17.7, 18.9));
      const btn = { x: 960 + 170, y: 540 + 185 };
      const cx = lerp(1560, btn.x, m), cy = lerp(980, btn.y, m);
      const click = seg(t, 19.0, 19.25);
      const cur = $("cursor");
      cur.style.left = cx - 18 + "px";
      cur.style.top = cy - 18 + "px";
      cur.style.opacity = seg(t, 17.5, 17.8) * (1 - seg(t, 19.5, 19.8));
      cur.style.transform = "scale(" + (1 - Math.sin(click * Math.PI) * 0.25) + ")";
      $("okBtn").style.transform = "scale(" + (1 - Math.sin(click * Math.PI) * 0.05) + ")";
      $("okBtn").style.filter = "brightness(" + (1 + Math.sin(click * Math.PI) * 0.4) + ")";
      const f = easeOut(seg(t, 19.3, 19.8));
      $("filled").style.opacity = f;
      $("filled").firstElementChild.style.transform = "scale(" + lerp(0.5, 1, expoOut(seg(t, 19.35, 20.0))) + ")";
    }

    // 6 ------------------------------------------------------------
    if (vis[5] > 0) {
      const a = expoOut(seg(t, 21.1, 21.7));
      $("k1").style.opacity = a;
      $("k1").style.transform = "translateY(" + (1 - a) * 140 + "px)";
      const b = easeOut(seg(t, 21.55, 22.3));
      $("k2").style.clipPath = "inset(" + (1 - b) * 100 + "% 0 0 0)";
      $("k2").style.transform = "translateY(" + (1 - b) * 60 + "px)";
      sc[5].style.transform = "scale(" + lerp(1, 1.06, seg(t, 23.6, 24.2)) + ")";
    }

    // 7 ------------------------------------------------------------
    if (vis[6] > 0) {
      const mk = expoOut(seg(t, 24.2, 25.1));
      const mark = sc[6].querySelector(".end-mark");
      mark.style.opacity = mk;
      mark.style.transform = "scale(" + lerp(0.7, 1, mk) + ") rotate(" + lerp(-12, 0, mk) + "deg)";
      const nm = easeOut(seg(t, 24.7, 25.4));
      const name = sc[6].querySelector(".end-name");
      name.style.opacity = nm;
      name.style.transform = "translateY(" + (1 - nm) * 30 + "px)";
      const u = easeOut(seg(t, 25.1, 25.7));
      const url = sc[6].querySelector(".end-url");
      url.style.opacity = u;
      url.style.transform = "translateY(" + (1 - u) * 20 + "px)";
    }
  }

  // ---------------------------------------------------------------- modes
  const params = new URLSearchParams(location.search);
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve());

  if (params.has("render")) {
    // frame-by-frame export: the renderer calls renderAt(t) and screenshots
    document.body.classList.add("render");
    window.filmDuration = DURATION;
    window.renderAt = (t) => { render(t); return true; };
    ready.then(() => { render(0); window.filmReady = true; });
    return;
  }

  const stage = $("stage");
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  fit();

  // Optional music: drop assets/film-music.mp3 in and a sound toggle appears.
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = "assets/film-music.mp3";
  const soundBtn = $("soundBtn");
  let soundOn = false;
  audio.addEventListener("canplaythrough", () => { soundBtn.hidden = false; }, { once: true });
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) { audio.currentTime = clock % DURATION; audio.play().catch(() => {}); } else audio.pause();
  });

  let playing = true, clock = 0, last = null;
  const playBtn = $("playBtn"), barFill = $("barFill");
  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    if (soundOn) playing ? audio.play().catch(() => {}) : audio.pause();
  });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(now) {
    if (last === null) last = now;
    if (playing) clock += (now - last) / 1000;
    last = now;
    const t = clock % DURATION;
    // loop the music with the picture
    if (soundOn && playing && Math.abs(audio.currentTime - t) > 0.3) audio.currentTime = t;
    render(t);
    barFill.style.width = (t / DURATION) * 100 + "%";
    requestAnimationFrame(frame);
  }
  ready.then(() => {
    if (reduced) { render(25.8); playing = false; playBtn.textContent = "Play"; }
    requestAnimationFrame(frame);
  });
})();
