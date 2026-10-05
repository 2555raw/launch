// Pure function of time: render(t) puts every element where it belongs at t seconds.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
/** 0 → 1 between a and b, eased. */
const prog = (t, a, b) => ease((t - a) / (b - a));
/** Visible from `in` to `out`, fading over `f` seconds. */
const win = (t, i, o, f = 0.35) => clamp((t - i) / f) * clamp((o - t) / f);
const $ = (id) => document.getElementById(id);
const set = (id, o) => { const el = $(id); if (!el) return; for (const k in o) el.style[k] = o[k]; };
window.play = () => { const s = performance.now(); const loop = () => { window.render(((performance.now() - s) / 1000) % window.DURATION); requestAnimationFrame(loop); }; loop(); };
