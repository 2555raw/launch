/* Language: English or Simplified Chinese (中文). The choice is kept per browser;
 * a first visit follows the browser language, and ?lang=zh / ?lang=en set it.
 * Chinese is applied by swapping text in place from /i18n/zh.json, including
 * text the page adds later. On the Chinese site price moves follow the Chinese
 * market convention: up is red, down is green. */
(() => {
  const KEY = 'seekr.lang', root = document.documentElement;
  const q = new URLSearchParams(location.search).get('lang');
  let lang = q === 'zh' || q === 'en' ? q : null;
  try { if (lang) localStorage.setItem(KEY, lang); else lang = localStorage.getItem(KEY); } catch {}
  if (!lang) lang = /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
  const reveal = () => root.classList.remove('i18n-wait');

  /* the switch sits next to the day/night button (site pages) or in the sidebar foot (the app) */
  const flip = () => {
    try { localStorage.setItem(KEY, lang === 'zh' ? 'en' : 'zh'); } catch {}
    const u = new URL(location.href);
    /* a plain reload, so it also works when the address carries a #section */
    if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.toString()); } else location.reload();
  };
  const addSwitch = () => {
    if (document.getElementById('langToggle')) return;
    const site = document.getElementById('themeToggle'), app = document.getElementById('themeBtn'), tb = site || app;
    if (!tb) return;
    const b = document.createElement('button'); b.id = 'langToggle'; b.type = 'button';
    b.className = site ? 'lang-btn' : 'icon-btn lang-app';
    b.textContent = lang === 'zh' ? 'EN' : '中文'; b.title = lang === 'zh' ? 'English' : '切换到中文'; b.setAttribute('aria-label', b.title);
    b.onclick = flip;
    tb.parentNode.insertBefore(b, tb);
    /* on phones the switch lives in the menu, where there is room */
    const links = document.getElementById('navLinks');
    if (site && links) { const m = document.createElement('a'); m.href = '#'; m.className = 'lang-menu'; m.textContent = lang === 'zh' ? 'English' : '中文'; m.onclick = (e) => { e.preventDefault(); flip(); }; links.appendChild(m); }
  };
  /* the switch only shows once the Chinese dictionary is published */
  const ver = document.currentScript ? (document.currentScript.src.split('v=')[1] || '') : '';
  const withSwitch = () => { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addSwitch); else addSwitch(); };
  if (lang !== 'zh') { root.lang = 'en'; reveal(); fetch('/i18n/zh.json?v=' + ver, { method: 'HEAD' }).then((r) => { if (r.ok) withSwitch(); }).catch(() => null); return; }

  root.lang = 'zh-CN';
  const SKIP = 'script,style,code,pre,textarea,[data-no-i18n]';
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  let D = null;
  const text = (n) => {
    if (!n.parentElement || n.parentElement.closest(SKIP)) return;
    const k = norm(n.nodeValue); if (!k) return;
    const t = D[k]; if (!t) return;
    const lead = n.nodeValue.match(/^\s*/)[0], trail = n.nodeValue.match(/\s*$/)[0];
    n.nodeValue = lead + t + trail;
  };
  const attrs = (el) => { for (const a of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute && el.getAttribute(a); if (v && D[norm(v)]) el.setAttribute(a, D[norm(v)]); } };
  const walk = (node) => {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1 || node.closest(SKIP)) return;
    attrs(node); node.querySelectorAll('[placeholder],[aria-label],[title]').forEach(attrs);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) text(n);
  };
  fetch('/i18n/zh.json?v=' + ver).then((r) => { if (!r.ok) throw new Error('no dictionary'); return r.json(); }).then((d) => {
    D = d; withSwitch();
    const go = () => {
      if (D[norm(document.title)]) document.title = D[norm(document.title)];
      walk(document.body); reveal();
      new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') text(m.target); else m.addedNodes.forEach(walk); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }).catch(() => { root.lang = 'en'; reveal(); });
  setTimeout(reveal, 1500);
})();
