/* Vesica — the documentation page: nothing but the contents rail.
   Measured on scroll rather than by observer, because jumping to an anchor
   lands the heading outside any sensible band and an observer would leave the
   previous entry lit. */

const links = [...document.querySelectorAll('#toc a[href^="#"]')];
const marks = links.map(a => ({ a, el: document.querySelector(a.getAttribute('href')) }))
                   .filter(m => m.el && m.a.querySelector('em') === null);

function markRead() {
  if (!marks.length) return;
  let i = 0;
  marks.forEach((m, n) => { if (m.el.getBoundingClientRect().top <= 120) i = n; });
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) i = marks.length - 1;
  links.forEach(a => a.classList.remove('on'));
  marks[i].a.classList.add('on');
}

let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; markRead(); });
}, { passive: true });
addEventListener('hashchange', markRead);
markRead();


/* ---------- the contracts table ----------
   Rendered rather than written into the markup, so there is exactly one place
   that decides whether an address exists: deployments.js. A row with no
   deployment says so; it does not show a number that looks like one. */

(function contractsTable() {
  const host = document.getElementById('dx-contracts');
  const note = document.getElementById('dx-deploy-note');
  if (note) note.textContent = deploymentNote();
  if (!host || typeof VAULTS === 'undefined') return;

  host.innerHTML = VAULTS.slice(0, 10).map(v => `
    <a class="dx-tr" href="vault.html?v=${v.t}" title="Open the ${v.name} vault">
      <b>${v.t}</b>
      <span class="dx-addr">${addressCell(v.t)}</span>
      <span class="${isDeployed(v.t) ? 'dx-ok' : 'dx-ph'}">${isDeployed(v.t) ? 'Verified' : 'Not deployed'}</span>
    </a>`).join('');
})();
