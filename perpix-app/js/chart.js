/* Canvas charts. No library, so there is nothing to load and nothing to break.
   One scale places the line, the axis labels and the crosshair, so that every
   label names a value the chart actually reaches. */

import { auto, dateTime } from './format.js';
import { rgba } from './logos.js';

const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

/* A canvas can end up with no size: the screen changed before the frame
   arrived, or it sits inside something hidden. Drawing there does not fail
   quietly, it throws on a negative radius, so it is checked once here rather
   than in every drawing function. */
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!(w > 0 && h > 0)) return null;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/** The main chart, with axis, fill, baseline and crosshair.
 *  Returns a teardown function. */
export function drawChart(canvas, rows, { color, baseline = null, suffix = '' } = {}) {
  const wrap = canvas.parentElement;
  const tip = wrap.querySelector('.px-tip');
  const data = (rows || []).filter(r => Number.isFinite(r.c));
  /* Read at draw time, not at module load, so a theme change repaints in the
     new palette rather than the one that was current when the page opened. */
  const theme = {
    line: cssVar(wrap, '--line') || '#E6E9EE',
    dim: cssVar(wrap, '--dim') || '#98A1AE',
    up: cssVar(wrap, '--up') || '#0E9F6E',
    down: cssVar(wrap, '--down') || '#D8342A',
    panel: cssVar(wrap, '--panel') || '#FFFFFF',
  };

  let geo = null;

  function layout() {
    const fit = fitCanvas(canvas);
    if (!fit) { geo = null; return; }
    const { w, h } = fit;
    const padL = 10, padR = 62, padT = 14, padB = 24;
    const plotW = Math.max(1, w - padL - padR), plotH = Math.max(1, h - padT - padB);
    const vals = data.map(r => r.c);
    if (baseline !== null) vals.push(baseline);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || Math.abs(hi) * 0.02 || 1;
    lo -= span * 0.1; hi += span * 0.1;
    const stroke = color || (data[data.length - 1].c >= data[0].c ? theme.up : theme.down);
    geo = {
      w, h, padL, padT, plotW, plotH, lo, hi, stroke,
      x: (i) => padL + (i / Math.max(data.length - 1, 1)) * plotW,
      y: (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH,
    };
  }

  function render() {
    if (!geo) return;
    const { w, h, padL, padT, plotW, plotH, lo, hi, x, y, stroke } = geo;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * (i / 4), py = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = theme.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
      ctx.fillStyle = theme.dim; ctx.textAlign = 'left';
      ctx.fillText(auto(v) + suffix, padL + plotW + 8, py);
    }

    // The index's base: where the basket stood the day it listed.
    if (baseline !== null) {
      const py = Math.round(y(baseline)) + 0.5;
      ctx.save();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = theme.dim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
      ctx.restore();
    }

    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, rgba(stroke, 0.22));
    grad.addColorStop(1, rgba(stroke, 0));
    ctx.beginPath(); ctx.moveTo(x(0), y(data[0].c));
    data.forEach((r, i) => ctx.lineTo(x(i), y(r.c)));
    ctx.lineTo(x(data.length - 1), padT + plotH); ctx.lineTo(x(0), padT + plotH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(x(0), y(data[0].c));
    data.forEach((r, i) => ctx.lineTo(x(i), y(r.c)));
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    ctx.fillStyle = theme.dim; ctx.textAlign = 'center'; ctx.font = '11px Inter, sans-serif';
    [0, Math.floor(data.length / 2), data.length - 1].forEach(i => {
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(data[i].t));
      ctx.fillText(label, Math.min(Math.max(x(i), 30), padL + plotW - 30), h - 8);
    });
  }

  function empty() {
    const fit = fitCanvas(canvas);
    if (!fit) return;
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.dim; ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No series to draw over this period', w / 2, h / 2);
  }

  if (data.length < 2) { empty(); return () => {}; }
  layout();
  if (!geo) return () => {};
  render();

  const onMove = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    if (!geo) return;
    const { padL, padT, plotW, plotH, x, y, stroke } = geo;
    if (mx < padL || mx > padL + plotW) return onLeave();
    const i = Math.min(Math.max(Math.round(((mx - padL) / plotW) * (data.length - 1)), 0), data.length - 1);
    const r = data[i];
    render();
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = theme.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x(i)) + .5, padT); ctx.lineTo(Math.round(x(i)) + .5, padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.arc(x(i), y(r.c), 4, 0, Math.PI * 2);
    ctx.fillStyle = theme.panel; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
    if (tip) {
      tip.hidden = false;
      tip.innerHTML = `<b>${auto(r.c)}${suffix}</b><span>${dateTime(r.t)}</span>`;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(x(i) - tw / 2, 4), geo.w - tw - 4) + 'px';
      tip.style.top = Math.max(y(r.c) - tip.offsetHeight - 14, 4) + 'px';
    }
  };
  const onLeave = () => { if (tip) tip.hidden = true; render(); };
  const onResize = () => { layout(); render(); };

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', onResize);
  return () => {
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', onResize);
  };
}

/** A minimal line for a table row: shape, with no axes and no labels. */
export function sparkline(canvas, rows, color) {
  const data = (rows || []).filter(r => Number.isFinite(r.c));
  const fit = fitCanvas(canvas);
  if (!fit) return;
  const { ctx, w, h } = fit;
  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const vals = data.map(r => r.c);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i) => (i / (data.length - 1)) * (w - 2) + 1;
  const y = (v) => h - 3 - ((v - lo) / span) * (h - 6);

  ctx.beginPath(); ctx.moveTo(x(0), y(vals[0]));
  vals.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(vals.length - 1), h); ctx.lineTo(x(0), h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(color, 0.28)); grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath(); ctx.moveTo(x(0), y(vals[0]));
  vals.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
}

/** Weight wheel: the basket at a glance, each leg in its brand colour. */
export function drawDonut(canvas, legs, size = 132) {
  canvas.style.width = canvas.style.height = size + 'px';
  // The gap between slices is the ground behind the wheel, not white.
  const gap = cssVar(canvas.parentElement || canvas, '--panel') || '#FFFFFF';
  const fit = fitCanvas(canvas);
  if (!fit) return;
  const { ctx, w, h } = fit;
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) / 2 - 2;
  if (r <= 0 || !legs?.length) return;
  const cx = w / 2, cy = h / 2, inner = r * 0.62;
  let a = -Math.PI / 2;
  for (const leg of legs) {
    const sweep = (leg.weight / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + sweep);
    ctx.arc(cx, cy, inner, a + sweep, a, true);
    ctx.closePath();
    ctx.fillStyle = leg.asset?.color || '#8A94A6';
    ctx.fill();
    ctx.strokeStyle = gap; ctx.lineWidth = 2; ctx.stroke();
    a += sweep;
  }
}
