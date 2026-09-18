/* Every water in the register that has a photograph, one per beat and a half,
 * with its name and its coordinates on it.
 *
 * Same clock as the long film: setT(t) places everything and the renderer
 * steps, so a cut lands on the frame it is meant to rather than on whichever
 * one the browser got round to painting.
 *
 * 125 BPM · a shot every 0.96s · ten shots · 9.6s of pictures, then the close.
 *
 * What is deliberately NOT on these cards is a fill percentage. The site
 * generates that number rather than measuring it, and printed beside a named
 * reservoir with its real coordinates it would read as a reading.
 */
const BEAT = 0.48, SHOT = BEAT * 1.5;   // ten shots in 7.2s, which is the pace the format runs at
const stage = document.getElementById("s");
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const out = x => 1 - Math.pow(1 - clamp(x), 3);
const seq = (t, f, d) => clamp((t - f) / d);

const WATERS = [
  ["MEAD", "Lake Mead",        "Nevada / Arizona, US",   "Reservoir", "36.0161° N, 114.7377° W"],
  ["SHT",  "Shasta",           "California, US",         "Reservoir", "40.7182° N, 122.4189° W"],
  ["ICE",  "Vatnajökull",      "Iceland",                "Glacier",   "64.4167° N,  16.8000° W"],
  ["ORO",  "Oroville",         "California, US",         "Reservoir", "39.5386° N, 121.4858° W"],
  ["GLC",  "Perito Moreno",    "Santa Cruz, Argentina",  "Glacier",   "50.4967° S,  73.1377° W"],
  ["TGR",  "Three Gorges",     "Hubei, China",           "Reservoir", "30.8235° N, 111.0033° E"],
  ["ALP",  "Aletsch",          "Valais, Switzerland",    "Glacier",   "46.5000° N,   8.0500° E"],
  ["POW",  "Lake Powell",      "Utah / Arizona, US",     "Reservoir", "36.9370° N, 111.4838° W"],
  ["GRN",  "Greenland Core",   "Greenland Ice Sheet",    "Glacier",   "72.5796° N,  38.4592° W"],
  ["TRR",  "Laguna Rosa",      "Torrevieja, Spain",      "Reservoir", "37.9800° N,   0.7000° W"],
];

const SHOTS = [];
(function (photos) {
  WATERS.forEach((w, i) => {
    const n = document.createElement("div");
    n.className = "sh";
    n.innerHTML = `
      <div class="ph" style="background-image:url(data:image/jpeg;base64,${photos[w[0]]})"></div>
      <p class="tk">${w[0]}</p>
      <div class="cap">
        <h1 class="nm">${w[1]}</h1>
        <p class="pl">${w[2]}</p>
        <span class="cl">${w[3]}</span>
        <p class="co">${w[4]}</p>
      </div>`;
    stage.appendChild(n);
    SHOTS.push({ from: i * SHOT, to: (i + 1) * SHOT, node: n,
                 ph: n.querySelector(".ph"), cap: n.querySelector(".cap"),
                 tk: n.querySelector(".tk"),
                 dir: i % 2 ? -1 : 1 });
  });

  const endFrom = WATERS.length * SHOT;
  const end = document.createElement("div");
  end.className = "sh";
  end.innerHTML = `<div class="end"><div>
    <img class="mk" src="logo.png" width="200" height="200">
    <p class="st" style="margin:0 0 34px">PAIRED TO REAL WATER</p>
    <p class="big">Pick a lake.</p>
    <p class="st">HYDROPAD.SITE</p></div></div>`;
  stage.appendChild(end);

  window.DURATION = endFrom + SHOT * 2;
  window.setT = function (T) {
    for (const s of SHOTS) {
      const on = T >= s.from && T < s.to;
      s.node.style.opacity = on ? 1 : 0;
      if (!on) continue;
      const t = T - s.from, d = seq(t, 0, SHOT), e = out(seq(t, 0, .22));
      /* The photograph pushes across the shot and alternates direction, so ten
       * cuts in a row do not all shove the eye the same way. */
      s.ph.style.transform =
        `scale(${lerp(1.10, 1.19, d)}) translateX(${lerp(-14, 14, d) * s.dir}px)`;
      s.ph.style.filter = `blur(${(1 - e) * 16}px) saturate(${lerp(1.18, 1.05, d)})`;
      s.cap.style.opacity = clamp(seq(t, .04, .16));
      s.cap.style.filter = `blur(${(1 - out(seq(t, .04, .26))) * 14}px)`;
      s.cap.style.transform = `translateY(${(1 - out(seq(t, .04, .34))) * 42}px)`;
      s.tk.style.opacity = clamp(seq(t, 0, .12));
      s.tk.style.transform = `translateX(${(1 - out(seq(t, 0, .3))) * -30}px)`;
    }
    const on = T >= endFrom;
    end.style.opacity = on ? 1 : 0;
    if (on) {
      const t = T - endFrom, e = out(seq(t, 0, .5));
      const inner = end.firstElementChild.firstElementChild;
      inner.style.filter = `blur(${(1 - e) * 18}px)`;
      inner.style.transform = `scale(${lerp(1.12, 1, e)})`;
      inner.style.opacity = clamp(seq(t, 0, .22));
    }
  };
  window.setT(0);
  window.READY = true;
})(PHOTOS);
