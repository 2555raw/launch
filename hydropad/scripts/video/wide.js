/* The wide cut: the same ten waters, twice as long on each, and a good deal
 * more happening inside the shot.
 *
 * 100 BPM to match score2.wav — a beat every 0.6s, a shot every two beats, ten
 * shots and then two bars to close. 14.4s exactly, which is six bars, so the
 * picture and the music end on the same frame.
 *
 * Every element in a shot arrives on its own offset rather than the whole card
 * fading in at once: the ticker, then the name, then the place, then the chip,
 * then the coordinates typing. That stagger is most of what makes a static
 * photograph feel like it is doing something.
 */
const BEAT = 0.6, SHOT = BEAT * 2, W = 1920, H = 1080;
const stage = document.getElementById("s");
const bar = document.querySelector("#bar i");
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const out = x => 1 - Math.pow(1 - clamp(x), 3);
const io = x => (x = clamp(x)) < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2;
/* Overshoot: what makes a thing land rather than merely arrive. */
const back = (x, k = 1.7) => { x = clamp(x); const c = k + 1;
  return 1 + c*Math.pow(x-1, 3) + k*Math.pow(x-1, 2); };
const seq = (t, f, d) => clamp((t - f) / d);

const WATERS = [
  ["MEAD", "Lake Mead",      "Nevada / Arizona, US",  "Reservoir", "36.0161° N, 114.7377° W"],
  ["SHT",  "Shasta",         "California, US",        "Reservoir", "40.7182° N, 122.4189° W"],
  ["ICE",  "Vatnajökull",    "Iceland",               "Glacier",   "64.4167° N,  16.8000° W"],
  ["ORO",  "Oroville",       "California, US",        "Reservoir", "39.5386° N, 121.4858° W"],
  ["GLC",  "Perito Moreno",  "Santa Cruz, Argentina", "Glacier",   "50.4967° S,  73.1377° W"],
  ["TGR",  "Three Gorges",   "Hubei, China",          "Reservoir", "30.8235° N, 111.0033° E"],
  ["ALP",  "Aletsch",        "Valais, Switzerland",   "Glacier",   "46.5000° N,   8.0500° E"],
  ["POW",  "Lake Powell",    "Utah / Arizona, US",    "Reservoir", "36.9370° N, 111.4838° W"],
  ["GRN",  "Greenland Core", "Greenland Ice Sheet",   "Glacier",   "72.5796° N,  38.4592° W"],
  ["TRR",  "Laguna Rosa",    "Torrevieja, Spain",     "Reservoir", "37.9800° N,   0.7000° W"],
];

const S = [];
WATERS.forEach((w, i) => {
  const n = document.createElement("div");
  n.className = "sh";
  n.innerHTML = `
    <div class="ph" style="background-image:url(data:image/jpeg;base64,${PHOTOS[w[0]]})"></div>
    <p class="tk">${w[0]}</p>
    <p class="cnt">${String(i + 1).padStart(2, "0")} / ${WATERS.length}</p>
    <div class="cap">
      <h1 class="nm">${w[1]}</h1>
      <p class="pl">${w[2]}</p>
      <div class="row"><span class="cl">${w[3]}</span><span class="co"></span></div>
    </div>`;
  stage.insertBefore(n, stage.firstChild);
  S.push({ from: i*SHOT, to: (i+1)*SHOT, node: n, coords: w[4],
           ph: n.querySelector(".ph"), nm: n.querySelector(".nm"),
           pl: n.querySelector(".pl"), cl: n.querySelector(".cl"),
           co: n.querySelector(".co"), tk: n.querySelector(".tk"),
           cnt: n.querySelector(".cnt"), dir: i % 2 ? -1 : 1 });
});

const endFrom = WATERS.length * SHOT;
const end = document.createElement("div");
end.className = "end";
end.innerHTML = `<div>
  <img class="mk" src="logo.png" width="176" height="176">
  <p class="st" style="margin:0 0 30px">PAIRED TO REAL WATER</p>
  <p class="big">Pick a lake.</p>
  <p class="st">HYDROPAD.SITE</p></div>`;
stage.appendChild(end);

window.DURATION = endFrom + BEAT * 4;     // two bars to close: 14.4s in total
window.setT = function (T) {
  bar.style.width = (clamp(T / endFrom) * 100) + "%";
  document.querySelector("#bar").style.opacity = T >= endFrom ? 0 : 1;

  for (const s of S) {
    const on = T >= s.from && T < s.to;
    s.node.style.opacity = on ? 1 : 0;
    if (!on) continue;
    const t = T - s.from, d = seq(t, 0, SHOT);

    /* The photograph: in from a hard scale and a blur, then a long push that
       alternates direction shot to shot, so ten cuts do not all shove the eye
       the same way. */
    const e = out(seq(t, 0, .34));
    s.ph.style.transform =
      `scale(${lerp(1.26, 1.10, e) * lerp(1, 1.07, d)})` +
      ` translateX(${lerp(-26, 26, io(d)) * s.dir}px) translateY(${lerp(8, -8, d)}px)`;
    s.ph.style.filter = `blur(${(1-e)*22}px) saturate(${lerp(1.3, 1.02, e)}) brightness(${lerp(1.22, 1, e)})`;
    s.node.style.transform = `translateX(${(1 - out(seq(t, 0, .42))) * 34 * s.dir}px)`;

    /* Then everything else, one after another rather than all at once. */
    const tk = seq(t, .02, .26);
    s.tk.style.opacity = clamp(tk*2);
    s.tk.style.transform = `translateX(${(1-out(tk))*-46}px) scale(${lerp(.9,1,out(tk))})`;
    s.cnt.style.opacity = clamp(seq(t, .10, .3));

    const nm = seq(t, .08, .46);
    s.nm.style.opacity = clamp(nm*3);
    s.nm.style.filter = `blur(${(1-out(nm))*18}px)`;
    s.nm.style.transform = `translateY(${(1-back(nm))*54}px) scale(${lerp(1.10, 1, back(nm))})`;

    const pl = seq(t, .20, .34);
    s.pl.style.opacity = clamp(pl*2);
    s.pl.style.transform = `translateY(${(1-out(pl))*26}px)`;

    const cl = seq(t, .30, .34);
    s.cl.style.opacity = clamp(cl*2.5);
    s.cl.style.transform = `scale(${lerp(.72, 1, back(cl, 2.4))})`;

    /* The coordinates type themselves in, because a number that assembles
       reads as a number being read off something. */
    const ty = seq(t, .40, .55);
    s.co.textContent = s.coords.slice(0, Math.round(ty * s.coords.length));
    s.co.style.opacity = clamp(seq(t, .40, .1));
  }

  const on = T >= endFrom;
  end.style.opacity = on ? 1 : 0;
  if (on) {
    const t = T - endFrom, e = out(seq(t, 0, .5));
    const inner = end.firstElementChild;
    inner.style.filter = `blur(${(1-e)*20}px)`;
    inner.style.transform = `scale(${lerp(1.14, 1, back(seq(t, 0, .7), 1.2))})`;
    inner.style.opacity = clamp(seq(t, 0, .22));
  }
};
window.setT(0);
window.READY = true;
