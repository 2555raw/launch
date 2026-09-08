/* Price chart on canvas: one scale places the line, the axis labels and the
   crosshair, so every label names a value the chart actually reaches.
   No library, so there is nothing to load and nothing to break. */

import { isNA, price as fmtPrice, dateOnly, num } from './format.js';

const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

function hexA(hex, a) {
  const m = (hex || '#888').replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16) || 136;
  const g = parseInt(n.slice(2, 4), 16) || 136;
  const b = parseInt(n.slice(4, 6), 16) || 136;
  return `rgba(${r},${g},${b},${a})`;
}

/** Draws the chart and wires the crosshair. Returns a teardown function. */
export function drawChart(canvas, rows, { currency = 'USD', volume = true } = {}) {
  const wrap = canvas.parentElement;
  const tip = wrap.querySelector('.tk-tip');
  const ctx = canvas.getContext('2d');

  const theme = {
    line: css(wrap, '--line') || '#212730',
    dim: css(wrap, '--dim') || '#5D6878',
    up: css(wrap, '--up') || '#16C784',
    down: css(wrap, '--down') || '#EA3943',
  };

  const data = (rows || []).filter(r => !isNA(r.c));
  let geo = null;

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padL = 8, padR = 66, padT = 12, volH = volume ? 46 : 0, padB = 22 + volH;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const closes = data.map(r => r.c);
    let lo = Math.min(...closes), hi = Math.max(...closes);
    const span = hi - lo || Math.abs(hi) * 0.02 || 1;
    lo -= span * 0.08; hi += span * 0.08;

    geo = {
      w, h, padL, padR, padT, padB, plotW, plotH, volH, lo, hi,
      x: (i) => padL + (i / Math.max(data.length - 1, 1)) * plotW,
      y: (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH,
      stroke: data[data.length - 1].c >= data[0].c ? theme.up : theme.down,
    };
  }

  function render() {
    const { w, h, padL, padT, plotW, plotH, volH, lo, hi, x, y, stroke } = geo;
    ctx.clearRect(0, 0, w, h);

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * (i / 4), py = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = theme.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
      ctx.fillStyle = theme.dim; ctx.textAlign = 'left';
      ctx.fillText(fmtPrice(v, currency), padL + plotW + 8, py);
    }

    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, hexA(stroke, .22)); grad.addColorStop(1, hexA(stroke, 0));
    ctx.beginPath(); ctx.moveTo(x(0), y(data[0].c));
    data.forEach((r, i) => ctx.lineTo(x(i), y(r.c)));
    ctx.lineTo(x(data.length - 1), padT + plotH); ctx.lineTo(x(0), padT + plotH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(x(0), y(data[0].c));
    data.forEach((r, i) => ctx.lineTo(x(i), y(r.c)));
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();

    if (volume) {
      const vols = data.map(r => (isNA(r.v) ? 0 : r.v));
      const vmax = Math.max(...vols) || 1;
      const base = h - 22;
      data.forEach((r, i) => {
        const vh = (vols[i] / vmax) * (volH - 8);
        const rose = i > 0 && r.c >= data[i - 1].c;
        ctx.fillStyle = hexA(rose ? theme.up : theme.down, .3);
        ctx.fillRect(x(i) - 1, base - vh, 2, vh);
      });
    }

    ctx.fillStyle = theme.dim; ctx.textAlign = 'center'; ctx.font = '11px Inter, sans-serif';
    [0, Math.floor(data.length / 2), data.length - 1].forEach((i) => {
      ctx.fillText(dateOnly(data[i].t), Math.min(Math.max(x(i), 36), padL + plotW - 36), h - 8);
    });
  }

  function empty() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.dim; ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Datos no disponibles para este periodo', w / 2, h / 2);
  }

  if (data.length < 2) { empty(); return () => {}; }

  layout(); render();

  const onMove = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const { padL, padT, plotW, plotH, x, y, stroke } = geo;
    if (mx < padL || mx > padL + plotW) return onLeave();
    const i = Math.min(Math.max(Math.round(((mx - padL) / plotW) * (data.length - 1)), 0), data.length - 1);
    const r = data[i];
    render();                                   // clears the previous crosshair
    ctx.strokeStyle = theme.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x(i)) + .5, padT); ctx.lineTo(Math.round(x(i)) + .5, padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.arc(x(i), y(r.c), 3.5, 0, Math.PI * 2); ctx.fillStyle = stroke; ctx.fill();
    if (tip) {
      tip.style.display = 'block';
      tip.innerHTML = `<b>${fmtPrice(r.c, currency)}</b><span>${dateOnly(r.t)}${isNA(r.v) ? '' : ` · vol ${num(r.v, 0)}`}</span>`;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(x(i) - tw / 2, 4), geo.w - tw - 4) + 'px';
      tip.style.top = Math.max(y(r.c) - tip.offsetHeight - 12, 4) + 'px';
    }
  };
  const onLeave = () => { if (tip) tip.style.display = 'none'; render(); };
  const onResize = () => { layout(); render(); };

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  window.addEventListener('resize', onResize);
  return () => {
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('resize', onResize);
  };
}
