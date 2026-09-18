/* Cusp — the home page: the brand marks in the stock grid, and the copy button. */

document.querySelectorAll('.hm-stock[data-logo]').forEach(el => {
  const l = LOGOS[el.dataset.logo];
  if (!l) return;
  const dot = el.querySelector('span');
  dot.style.background = '#EEEEEE';
  dot.style.color = l.c === '#000000' ? '#3D3B4F' : l.c;
  dot.innerHTML = `<svg viewBox="${l.vb}" fill="currentColor"><path d="${l.p}"${l.evenodd ? ' fill-rule="evenodd"' : ''}/></svg>`;
});

document.getElementById('ca-copy').addEventListener('click', () => {
  const text = document.getElementById('ca').textContent.trim();
  const ok = () => { const b = document.getElementById('ca-copy'); b.style.color = '#1C9A69'; setTimeout(() => b.style.color = '', 1200); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, ok);
  else {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (_) {}
    ta.remove();
  }
});
