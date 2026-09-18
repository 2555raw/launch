/* The film, as one deterministic function of time.
 *
 * Nothing here animates by itself. setT(t) puts every element exactly where it
 * belongs at t seconds, so the renderer can step frame by frame and get the
 * same picture every run — no waiting on requestAnimationFrame, no drift, no
 * frames that land mid-transition because the machine was busy.
 *
 * The cut list and the beat come from the reference: 46.47s, a cut every few
 * seconds at 2.37 5.27 7.87 10.23 11.70 15.00 28.87 30.20 32.03 33.53 35.03
 * 46.07, and words landing on a 0.48s beat (~125 BPM).
 */
const W = 1024, H = 576, BEAT = 0.48;
const stage = document.getElementById("stage");

/* ---------------- the small amount of maths the whole film needs ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
/* The reference's motion is all one shape: fast out of the gate, long settle. */
const out = x => 1 - Math.pow(1 - clamp(x), 3);
const outq = x => 1 - Math.pow(1 - clamp(x), 5);
const io = x => (x = clamp(x)) < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
/* progress through a window that starts at `from` and lasts `dur` */
const seq = (t, from, dur) => clamp((t - from) / dur);

/* A word arriving: up in scale, out of blur, in one beat. The reference does
 * this to every piece of type it has, which is most of why it reads as one
 * piece rather than fourteen. */
function wordIn(el, p, { scale = 1.28, blur = 16, y = 0 } = {}) {
  const e = out(p);
  el.style.opacity = clamp(p * 2.2);
  el.style.filter = `blur(${(1 - e) * blur}px)`;
  el.style.transform = `translateY(${(1 - e) * y}px) scale(${lerp(scale, 1, e)})`;
}
function put(el, { x = 0, y = 0, s = 1, r = 0, o = 1, b = 0 }) {
  el.style.opacity = o;
  el.style.filter = b ? `blur(${b}px)` : "none";
  el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
}
const $ = (sel, root = stage) => root.querySelector(sel);
const el = (cls, html = "", tag = "div") => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.innerHTML = html;
  return n;
};

/* The site's own drop, the one the register draws beside every ticker. */
function drop(size, fill = .31, c = "#12a6d2") {
  const id = "d" + Math.random().toString(36).slice(2, 7);
  return `<svg width="${size}" height="${size * 1.12}" viewBox="0 0 20 22">
    <defs><clipPath id="${id}"><path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z"/></clipPath></defs>
    <path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z" fill="none" stroke="${c}" stroke-width="1.3"/>
    <rect x="0" y="${(21 - fill * 13).toFixed(1)}" width="20" height="22" fill="${c}" opacity=".85" clip-path="url(#${id})"/>
  </svg>`;
}
const MARK = `<img class="mark" src="logo.png" width="150" height="150">`;

/* A plate: what the site puts on a coin, class and fill and nothing uploaded. */
function plate(t, name, place, pct, w = 210) {
  return `<div class="plate" style="width:${w}px">
    <div style="height:${Math.round(w * .62)}px;background:linear-gradient(160deg,#16333d,#0c1c22);
                display:grid;place-items:center">${drop(Math.round(w * .3), pct / 100, "#3fd3e0")}</div>
    <div style="padding:12px 14px;text-align:left">
      <div style="font-weight:700;font-size:${Math.round(w * .085)}px">${name}</div>
      <div class="mono" style="font-size:${Math.round(w * .055)}px;color:#6a7a74;margin-top:3px">
        ${t} · ${place}</div>
      <div style="margin-top:9px;height:3px;background:#e2e8e6"><i style="display:block;height:100%;
        width:${pct}%;background:#12a6d2"></i></div>
      <div class="mono" style="font-size:${Math.round(w * .05)}px;color:#12a6d2;margin-top:6px">${pct}% full</div>
    </div></div>`;
}

/* ---------------- the scenes, in the reference's order and timing --------- */
const SCENES = [];
function scene(from, to, cls, html, at) {
  const node = el("sc " + cls, html);
  stage.appendChild(node);
  SCENES.push({ from, to, node, at });
  return node;
}

/* 1 · 0.00–2.37 — the headline builds a word per beat, on the light ground. */
{
  const words = ["to a real", "body of water", "on chain?"];
  const n = scene(0, 2.37, "light", `
    <div class="in">
      <p class="w wb" id="s1a" style="font-size:31px;color:#6a7a74;font-weight:600">Is it possible</p>
      <h1 class="w wb cy" id="s1b" style="font-size:66px;margin:6px 0 10px">to bind a coin</h1>
      <p style="font-size:29px;color:#57635e;font-weight:500">
        ${words.map((w, i) => `<span class="w" id="s1w${i}">${w} </span>`).join("")}
      </p>
    </div>`);
  const ws = words.map((_, i) => $("#s1w" + i, n));
  n.at = t => {
    wordIn($("#s1a", n), seq(t, 0, .38), { scale: 1.2, blur: 12 });
    wordIn($("#s1b", n), seq(t, BEAT, .40), { scale: 1.45, blur: 22 });
    ws.forEach((w, i) => wordIn(w, seq(t, BEAT * (2 + i), .34), { scale: 1.18, blur: 10 }));
  };
  SCENES[SCENES.length - 1].at = n.at;
}

/* 2 · 2.37–5.27 — one capsule, restated twice, then squashed out of frame.
   The site's own network pill stands in for the reference's status capsule. */
{
  const n = scene(2.37, 5.27, "dark", `
    <div class="in">
      <div class="pill" id="s2p">
        <span class="ring" id="s2r"></span>
        <span style="text-align:left"><b id="s2t">0.0005 ETH</b><small id="s2s">launch fee</small></span>
      </div>
    </div>`);
  const p = $("#s2p", n), tx = $("#s2t", n), sb = $("#s2s", n), r = $("#s2r", n);
  SCENES[SCENES.length - 1].at = t => {
    const inn = out(seq(t, .1, .45));
    let s = lerp(1.5, 1, inn), o = clamp(seq(t, .1, .3)), b = (1 - inn) * 10, x = 0;
    if (t > 1.5) {                       // restated: shorter, tighter
      tx.textContent = "Cheap?"; sb.style.display = "none";
      r.style.width = r.style.height = "26px"; r.style.borderWidth = "3px";
      p.style.padding = "12px 30px"; tx.style.fontSize = "26px";
      s = lerp(.86, 1, out(seq(t, 1.5, .25)));
    }
    if (t > 2.1) {                       // the answer, in the site's green
      tx.textContent = "Yes"; p.classList.add("on");
      s = lerp(1.3, 1, out(seq(t, 2.1, .3)));
    }
    if (t > 2.65) {                      // and squashed away, as the reference does
      const q = seq(t, 2.65, .25);
      p.style.transform = `scale(${lerp(1, 1.5, q)},${lerp(1, .42, q)})`;
      p.style.filter = `blur(${q * 14}px)`; p.style.opacity = 1 - q * .9;
      return;
    }
    put(p, { s, o, b, x });
  };
}

/* 3 · 5.27–7.87 — a card comes up out of nothing and types its own caption. */
{
  const line = "And in this launch you'll find out how it works";
  const n = scene(5.27, 7.87, "light", `
    <div class="in">
      <div class="card" id="s3c" style="width:520px">
        <div class="body" style="height:292px"><span id="s3t"></span></div>
        <div class="bar"><i style="width:34%"></i></div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0b110f">
          <span style="width:26px;height:26px;border-radius:50%;background:#12a6d2"></span>
          <span style="font-size:12px;color:#8fa79d;text-align:left">Hydropad<br>
            <span style="color:#5d7a71">paired to real water</span></span>
        </div>
      </div>
    </div>`);
  const c = $("#s3c", n), tx = $("#s3t", n);
  SCENES[SCENES.length - 1].at = t => {
    const e = out(seq(t, 0, 1.6));
    put(c, { s: lerp(.30, 1, e), o: clamp(seq(t, 0, .25)), b: (1 - out(seq(t, 0, .5))) * 6 });
    tx.textContent = line.slice(0, Math.round(seq(t, .25, 1.5) * line.length));
  };
}

/* 4 · 7.87–10.23 — three words arriving out of a dark grid, one per beat. */
{
  const n = scene(7.87, 10.23, "dark grid", `
    <div class="in">
      <span class="w big" id="s4a">But the</span>
      <span class="w big" id="s4b"> question</span>
      <span class="w big" id="s4c"> is…</span>
    </div>`);
  SCENES[SCENES.length - 1].at = t => {
    wordIn($("#s4a", n), seq(t, .15, .36), { scale: 1.5, blur: 24 });
    wordIn($("#s4b", n), seq(t, .15 + BEAT, .36), { scale: 1.5, blur: 24 });
    wordIn($("#s4c", n), seq(t, .15 + BEAT * 2, .36), { scale: 1.4, blur: 20 });
  };
}

/* 5 · 10.23–11.70 — the question itself, under the reference's soft bloom. */
{
  const n = scene(10.23, 11.70, "light", `
    <div class="radial"></div>
    <div class="in"><h1 class="w" id="s5" style="font-size:58px">Why water?</h1></div>`);
  SCENES[SCENES.length - 1].at = t => {
    wordIn($("#s5", n), seq(t, .1, .5), { scale: 1.3, blur: 26 });
  };
}

/* 6 · 11.70–15.00 — the mark alone, then what it stands for beside it, then a
   note pinned over the top, exactly as the reference pins its own. */
{
  const n = scene(11.70, 15.00, "dark", `
    <div class="in" style="display:flex;align-items:center;gap:22px" id="s6row">
      ${MARK}
      <span class="w" id="s6t" style="font-size:44px;font-weight:600;white-space:nowrap">Paired to real water</span>
    </div>
    <div class="note w" id="s6n" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">
      So if you can pick a lake…</div>`);
  const row = $("#s6row", n), mk = $(".mark", n), tx = $("#s6t", n), note = $("#s6n", n);
  SCENES[SCENES.length - 1].at = t => {
    note.style.opacity = 0;
    const grow = out(seq(t, 0, .7));
    let s = lerp(.2, 1, grow), o = clamp(seq(t, 0, .2));
    if (t > 1.0) s = lerp(1, .62, out(seq(t, 1.0, .5)));   // makes room for the words
    put(mk, { s, o, b: (1 - grow) * 12 });
    const p = seq(t, 1.35, .45);
    tx.style.opacity = clamp(p * 2); tx.style.filter = `blur(${(1 - out(p)) * 14}px)`;
    tx.style.transform = `translateX(${(1 - out(p)) * 40}px)`;
    tx.style.width = p > 0 ? "auto" : "0";
    row.style.opacity = t > 2.3 ? 0 : 1;
    if (t > 2.3) wordIn(note, seq(t, 2.3, .3), { scale: 1.3, blur: 12 });
  };
}

/* 7 · 15.00–18.00 — a small card, then the promise, then who it is for. */
{
  const n = scene(15.00, 18.00, "light", `
    <div class="in">
      <div class="sq" id="s7c" style="width:128px;height:96px;font-size:13px;color:#57635e">
        <span>In that register</span></div>
      <p style="font-size:30px;margin-top:0" id="s7p">
        <span class="w" id="s7a">You can bind a coin</span>
        <span class="w" id="s7b" style="color:#b8860b;font-weight:600"> to a real place</span>
        <span class="w" id="s7c2" style="color:#57635e"> that anyone can read</span>
      </p>
    </div>`);
  const c = $("#s7c", n), p = $("#s7p", n);
  SCENES[SCENES.length - 1].at = t => {
    const gone = t > 1.0;
    put(c, { s: lerp(.7, 1, out(seq(t, 0, .4))), o: gone ? clamp(1 - seq(t, 1.0, .3)) : clamp(seq(t, 0, .3)),
             b: gone ? seq(t, 1.0, .3) * 8 : (1 - out(seq(t, 0, .4))) * 6, y: gone ? 0 : 0 });
    c.style.position = "absolute"; c.style.left = "50%"; c.style.top = "50%";
    c.style.marginLeft = "-64px"; c.style.marginTop = "-48px";
    p.style.opacity = t > 1.0 ? 1 : 0;
    wordIn($("#s7a", n), seq(t, 1.05, .34), { scale: 1.2, blur: 12 });
    wordIn($("#s7b", n), seq(t, 1.05 + BEAT, .34), { scale: 1.2, blur: 12 });
    wordIn($("#s7c2", n), seq(t, 1.05 + BEAT * 2.2, .34), { scale: 1.2, blur: 12 });
  };
}

/* 8 · 18.00–20.50 — the alternative, zoomed into slowly: a feed of coins named
   after nothing at all. The reference spends this beat on the same joke. */
{
  const tiles = Array.from({ length: 9 }, () =>
    `<div style="aspect-ratio:1;background:#efefef;display:grid;place-items:center;font-size:30px">💩</div>`).join("");
  const n = scene(18.00, 20.50, "light", `
    <div class="in"><div id="s8" style="width:300px;background:#fff;border-radius:14px;overflow:hidden;
        box-shadow:0 26px 60px -26px rgba(0,0,0,.45)">
      <div style="display:flex;align-items:center;gap:12px;padding:14px">
        <span style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f58529,#dd2a7b)"></span>
        <span style="text-align:left;font-size:13px"><b>GENERICCOIN</b><br>
          <span class="mono" style="color:#8a8a8a;font-size:11px">43 posts · 660 holders</span></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px">${tiles}</div>
    </div></div>`);
  const c = $("#s8", n);
  SCENES[SCENES.length - 1].at = t => {
    put(c, { s: lerp(.55, 1.15, io(seq(t, 0, 2.4))), o: clamp(seq(t, 0, .35)),
             y: lerp(30, -20, seq(t, 0, 2.4)), b: (1 - out(seq(t, 0, .45))) * 8 });
  };
}

/* 9 · 20.50–28.87 — the long calm one. Three objects arrive a beat and a half
   apart and then the whole plane drifts. The reference gives this section
   eight and a half seconds and no words at all, and the piece needs it. */
{
  const n = scene(20.50, 28.87, "light gridl", `
    <div style="position:absolute;inset:0" id="s9plane">
      <div style="position:absolute;left:180px;top:300px" id="s9a">${drop(74, .31)}</div>
      <div style="position:absolute;left:430px;top:190px" id="s9b">${plate("SHT", "Shasta", "California, US", 58, 190)}</div>
      <div style="position:absolute;left:770px;top:330px" id="s9c">${MARK}</div>
    </div>`);
  const pl = $("#s9plane", n), a = $("#s9a", n), b = $("#s9b", n), c = $("#s9c", n);
  $(".mark", c).width = 96; $(".mark", c).height = 96;
  SCENES[SCENES.length - 1].at = t => {
    const d = t / 8.37;
    pl.style.transform = `translate(${lerp(40, -70, io(d))}px,${lerp(10, -26, io(d))}px) scale(${lerp(1.04, 1.13, d)})`;
    put(a, { s: lerp(.4, 1, out(seq(t, .2, .8))), o: clamp(seq(t, .2, .4)), b: (1 - out(seq(t, .2, .8))) * 10 });
    put(b, { s: lerp(.5, 1, out(seq(t, 2.5, .9))), o: clamp(seq(t, 2.5, .4)), r: lerp(-4, 0, out(seq(t, 2.5, 1.2))),
             b: (1 - out(seq(t, 2.5, .9))) * 10 });
    put(c, { s: lerp(.4, 1, out(seq(t, 5.0, .9))), o: clamp(seq(t, 5.0, .4)), b: (1 - out(seq(t, 5.0, .9))) * 10 });
  };
}

/* 10 · 28.87–32.03 — the register itself, in two shots, pushing in.
   The reference cuts inside this beat at 30.20; so does this. */
function registerWall(id, from, to, startScale, endScale, ox) {
  const rows = [
    ["MEAD", "Lake Mead", "Nevada / Arizona, US", 31],
    ["SHT", "Shasta", "California, US", 58],
    ["ICE", "Vatnajökull", "Iceland", 74],
    ["ORO", "Oroville", "California, US", 71],
    ["CNT", "Cantareira", "São Paulo, BR", 62],
    ["ALP", "Aletsch", "Valais, CH", 66],
    ["POW", "Powell", "Utah / Arizona, US", 29],
    ["GUR", "Guri", "Bolívar, VE", 52],
    ["TGR", "Tigris", "Iraq", 79],
  ];
  const n = scene(from, to, "dark", `
    <div id="${id}" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:1000px">
      ${rows.map(r => plate(r[0], r[1], r[2], r[3], 320)).join("")}
    </div>`);
  const g = $("#" + id, n);
  SCENES[SCENES.length - 1].at = t => {
    const d = seq(t, 0, to - from);
    put(g, { s: lerp(startScale, endScale, io(d)), x: lerp(ox, ox - 40, d), y: lerp(20, -40, d),
             o: clamp(seq(t, 0, .25)) });
  };
}
registerWall("s10a", 28.87, 30.20, .72, .80, 0);
registerWall("s10b", 30.20, 32.03, .90, 1.00, -40);

/* 11 · 32.03–33.53 — one of them, alone, drifting the way the reference lets
   its watch photograph drift. */
{
  const n = scene(32.03, 33.53, "light", `
    <div class="in" id="s11">${plate("MEAD", "Lake Mead", "Nevada / Arizona, US", 31, 300)}</div>`);
  const c = $("#s11", n);
  SCENES[SCENES.length - 1].at = t => {
    const d = seq(t, 0, 1.5);
    put(c, { s: lerp(1.02, 1.1, d), x: lerp(-170, 150, io(d)), r: lerp(-3.5, 2.5, io(d)),
             o: clamp(seq(t, 0, .18)), b: (1 - out(seq(t, 0, .35))) * 8 });
  };
}

/* 12 · 33.53–35.03 — the turn, in the reference's one deep-navy shot, its type
   glowing. Theirs is pink; ours is the cyan the mark is cut from. */
{
  const n = scene(33.53, 35.03, "deep", `
    <div class="in">
      <p class="glow" style="font-size:52px;font-weight:700;font-style:italic">
        <span class="w" id="s12a">and I thought</span></p>
      <p class="glow cyl" style="font-size:24px;margin-top:8px">
        <span class="w" id="s12b">it would be perfect to show you</span></p>
    </div>`);
  SCENES[SCENES.length - 1].at = t => {
    wordIn($("#s12a", n), seq(t, .05, .4), { scale: 1.35, blur: 20 });
    wordIn($("#s12b", n), seq(t, .05 + BEAT, .4), { scale: 1.2, blur: 14 });
  };
}

/* 13 · 35.03–46.07 — the long close. One icon, restated at six different
   sizes, becoming a notification and going back, and the last line under it.
   This is eleven seconds on one idea, which is what the reference does and
   what makes its ending land rather than stop. */
{
  const n = scene(35.03, 46.07, "grey", `
    <div class="in" style="position:relative;width:1024px;height:576px">
      <div class="sq" id="s13sq" style="position:absolute;left:50%;top:50%;width:96px;height:96px;
           margin:-48px 0 0 -48px">${drop(46, .31)}</div>
      <div class="sq" id="s13card" style="position:absolute;left:50%;top:50%;width:300px;height:78px;
           margin:-39px 0 0 -150px;place-items:stretch;padding:12px 14px;text-align:left">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#12a6d2">
            <span>◆ Lake Mead</span><span style="color:#9aa5a1">6:30 AM</span></div>
          <div style="font-weight:700;font-size:15px;margin-top:6px">31% full</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span style="font-size:10px;color:#9aa5a1">36.0161° N, 114.7377° W</span>
            <span style="width:64px;height:7px;border-radius:4px;background:#12a6d2"></span></div>
        </div></div>
      <div id="s13big" style="position:absolute;left:50%;top:50%;margin:-60px 0 0 -54px">${drop(108, .31)}</div>
      <p class="w wb" id="s13t" style="position:absolute;left:0;right:0;top:64%;font-size:22px;
         color:#12a6d2;font-weight:600">pick a lake</p>
    </div>`);
  const sq = $("#s13sq", n), card = $("#s13card", n), big = $("#s13big", n), tx = $("#s13t", n);
  /* The beats the reference hits in this stretch, as offsets from its start. */
  SCENES[SCENES.length - 1].at = t => {
    sq.style.opacity = card.style.opacity = big.style.opacity = 0;
    tx.style.opacity = 0;
    const show = (e, o) => { e.style.opacity = o; };

    if (t < 1.0) {                                   // the icon, small
      sq.style.background = '#fff';
      show(sq, 1); put(sq, { s: lerp(.5, 1, out(seq(t, 0, .5))), o: clamp(seq(t, 0, .25)),
                             b: (1 - out(seq(t, 0, .5))) * 10 });
    } else if (t < 1.55) {                           // stretched, on its way to a card
      show(sq, 1); const q = seq(t, 1.0, .55);
      /* The reference floods this shape with its accent while it stretches, so
         the morph reads as one object changing rather than two crossfading. */
      sq.style.background = `rgba(18,166,210,${(io(q) * .75).toFixed(3)})`;
      sq.style.transform = `scale(${lerp(1, 3.1, io(q))},${lerp(1, .78, io(q))})`;
      sq.style.filter = `blur(${io(q) * 5}px)`; sq.style.opacity = 1 - q * .25;
    } else if (t < 3.0) {                            // the notification it becomes
      show(card, 1); put(card, { s: lerp(1.06, 1, out(seq(t, 1.55, .35))), o: clamp(seq(t, 1.55, .2)),
                                 b: (1 - out(seq(t, 1.55, .35))) * 7 });
    } else if (t < 4.0) {                            // and big, twice, a beat apart
      show(big, 1); put(big, { s: lerp(.4, 1.25, out(seq(t, 3.0, .45))), o: clamp(seq(t, 3.0, .2)),
                               b: t > 3.55 ? (t - 3.55) * 26 : (1 - out(seq(t, 3.0, .45))) * 12 });
    } else if (t < 5.6) {                            // back to almost nothing
      show(sq, 1); put(sq, { s: lerp(.34, 1, out(seq(t, 4.0, 1.4))), o: clamp(seq(t, 4.0, .2)) });
    } else if (t < 6.6) {
      show(card, 1); put(card, { s: lerp(.9, 1.02, out(seq(t, 5.6, .5))), o: clamp(seq(t, 5.6, .2)) });
    } else {                                          // and the last one, held
      show(big, 1);
      const g = seq(t, 6.6, .7);
      put(big, { s: lerp(.5, 1.5, out(g)), o: clamp(seq(t, 6.6, .2)), b: (1 - out(g)) * 16 });
      if (t > 9.3) wordIn(tx, seq(t, 9.3, .45), { scale: 1.4, blur: 12 });
    }
  };
}

/* 14 · 46.07–46.47 — out, on the one thing worth remembering. */
{
  const n = scene(46.07, 46.60, "dark", `
    <div class="in"><p class="mono w wb" id="s14" style="font-size:26px;letter-spacing:.22em;
       color:#3fd3e0">HYDROPAD.SITE</p></div>`);
  SCENES[SCENES.length - 1].at = t => wordIn($("#s14", n), seq(t, 0, .3), { scale: 1.2, blur: 10 });
}

/* ---------------- the clock ---------------- */
window.DURATION = 46.47;
window.setT = function setT(T) {
  for (const s of SCENES) {
    const on = T >= s.from && T < s.to;
    s.node.style.opacity = on ? 1 : 0;
    s.node.style.pointerEvents = "none";
    if (on) s.at(T - s.from);
  }
};
window.setT(0);
