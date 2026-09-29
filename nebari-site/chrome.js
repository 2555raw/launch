// Nebari — the parts every page shares: header, footer, wallet button, logos, toasts,
// the background bonsai and the scroll reveal.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;

  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
    <rect x="10" y="2" width="12" height="6" rx="3"/>
    <rect x="10" y="24" width="12" height="6" rx="3"/>
    <rect x="2" y="10" width="6" height="12" rx="3"/>
    <rect x="24" y="10" width="6" height="12" rx="3"/>
    <rect x="7" y="7" width="6" height="6" rx="2"/>
    <rect x="19" y="7" width="6" height="6" rx="2"/>
    <rect x="7" y="19" width="6" height="6" rx="2"/>
    <rect x="19" y="19" width="6" height="6" rx="2"/>
  </svg>`;
  const X_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2.1l7.7-8.8L1.6 2h6.8l4.7 6.2L18.9 2zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20z"/></svg>';

  const page = document.body.dataset.page || '';
  const brand = C.brand || 'Nebari';

  const NAV = [
    ['index.html#about', 'About', 'about'],
    ['index.html#how', 'How it works', 'how'],
    ['index.html#assets', 'Assets', 'assets'],
    ['index.html#faq', 'FAQ', 'faq'],
    ['explore.html', 'Explore', 'explore'],
    ['claim.html', 'Claim', 'claim'],
    ['docs.html', 'Docs', 'docs'],
  ];

  function header() {
    const el = document.createElement('header');
    el.className = 'nav'; el.id = 'nav';
    el.innerHTML = `
      <div class="wrap nav-in">
        <a class="brand" href="index.html" aria-label="${brand}, home"><span class="mark">${LOGO}</span><span class="brand-name">${brand.toUpperCase()}</span></a>
        <nav class="nav-links" id="navlinks" aria-label="Main">
          ${NAV.map(([href, label, key]) => `<a href="${href}" class="${page === key ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="nav-right">
          <a class="icon-btn" href="${C.links.x}" target="_blank" rel="noopener" aria-label="${brand} on X">${X_ICON}</a>
          <button class="icon-btn burger" id="burger" type="button" aria-label="Open the menu" aria-expanded="false" aria-controls="navlinks">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm wallet-btn" id="wallet-btn" type="button">Connect wallet</button>
          <a class="btn btn-primary btn-sm" href="launch.html"><span class="nav-cta-text">Launch a token</span><span class="arrow" aria-hidden="true">↗</span></a>
        </div>
      </div>`;
    return el;
  }

  function footer() {
    const el = document.createElement('footer');
    el.className = 'footer wrap';
    el.innerHTML = `
      <div class="footer-brand">
        <a class="brand" href="index.html"><span class="mark">${LOGO}</span><span class="brand-name">${brand.toUpperCase()}</span></a>
        <p>Launch a Robinhood Chain token rooted to any stock or asset. Liquidity locked forever at launch, fees paid to the people who hold it.</p>
        <a class="icon-btn" href="${C.links.x}" target="_blank" rel="noopener" aria-label="${brand} on X">${X_ICON}</a>
      </div>
      <div class="footer-cols">
        <div><h4>PROTOCOL</h4><a href="launch.html">Launch a token</a><a href="explore.html">Explore</a><a href="claim.html">Claim fees</a></div>
        <div><h4>LEARN</h4><a href="docs.html">Docs</a><a href="index.html#how">How it works</a><a href="index.html#assets">Assets</a><a href="index.html#faq">FAQ</a></div>
      </div>
      <p class="copy">© ${new Date().getFullYear()} ${brand}. Built on Robinhood Chain. Nebari (根張り) is the root spread of a bonsai: the part that holds everything up.</p>`;
    return el;
  }

  // ------------------------------------------------------------- toast
  let toastEl, toastTimer;
  function toast(msg, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2600);
  }

  // ------------------------------------------------------------- logos
  // Real logos, with a chain of fallbacks: a file you drop in assets/logos/, the
  // asset's own site icon (two services), then a monogram.
  function logoEl(asset) {
    const box = document.createElement('span');
    box.className = 'asset-logo';
    const sym = (asset.symbol || '?').toUpperCase();
    const srcs = [];
    if (asset.logo) srcs.push(asset.logo);
    srcs.push(`assets/logos/${sym.toLowerCase()}.png`);
    if (asset.domain) {
      srcs.push(`https://www.google.com/s2/favicons?domain=${asset.domain}&sz=128`);
      srcs.push(`https://icons.duckduckgo.com/ip3/${asset.domain}.ico`);
    }
    const img = document.createElement('img');
    img.alt = sym + ' logo'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    let i = 0;
    const next = () => {
      if (i >= srcs.length) { img.remove(); box.innerHTML = `<span class="mono">${sym.slice(0, 4)}</span>`; return; }
      img.src = srcs[i++];
    };
    img.onerror = next;
    img.onload = () => { if (img.naturalWidth < 8) next(); };
    next();
    box.appendChild(img);
    return box;
  }

  // --------------------------------------------------------- background
  function background() {
    const bg = document.createElement('div');
    bg.className = 'bg'; bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<div class="bg-glow"></div><canvas class="bg-bonsai" id="bg-bonsai"></canvas><div class="bg-vignette"></div>';
    document.body.prepend(bg);
    const petals = document.createElement('canvas');
    petals.className = 'petals'; petals.setAttribute('aria-hidden', 'true');
    document.body.appendChild(petals);
    const canvas = bg.querySelector('canvas');
    if (window.Bonsai) {
      Bonsai.mount(canvas, (w, h) => {
        const mobile = w < 760;
        return { x: mobile ? w * 0.5 : w * 0.72, y: mobile ? h * 0.98 : h * 0.96, height: mobile ? h * 0.5 : Math.min(h * 0.78, w * 0.46), seed: 'nebari-home', growth: 1, bokeh: true };
      });
      Bonsai.petals(petals, { count: 24 });
    }
    const base = page === 'home' ? 1 : 0.62; // app pages keep the tree quieter behind the panels
    const fade = () => {
      const vh = window.innerHeight;
      const o = Math.max(0.3, Math.min(1, 1 - (window.scrollY - vh * 0.5) / (vh * 0.9)));
      canvas.style.opacity = (o * base).toFixed(2);
    };
    window.addEventListener('scroll', fade, { passive: true });
    fade();
  }

  // ------------------------------------------------------------- wallet
  function wireWallet() {
    const btn = document.getElementById('wallet-btn');
    if (!btn || !window.Nebari) return;
    const render = (w) => {
      if (w.account) {
        btn.innerHTML = `<span class="wallet-dot"></span>${Nebari.fmt.addr(w.account)}`;
        btn.title = 'Connected with ' + (w.name || 'wallet') + '. Click to disconnect.';
      } else {
        btn.textContent = 'Connect wallet'; btn.title = '';
      }
      if (w.account && w.chainId && w.chainId !== C.network.chainId) btn.innerHTML += ' · wrong network';
    };
    Nebari.onWallet(render);
    btn.addEventListener('click', async () => {
      if (Nebari.wallet.account) { Nebari.disconnect(); toast('Wallet disconnected'); return; }
      try { await Nebari.connect(); toast('Connected to ' + C.network.name); }
      catch (e) { toast(Nebari.explainError(e), 4000); }
    });
    render(Nebari.wallet);
    Nebari.autoConnect();
  }

  // ------------------------------------------------------------ cookies
  // Shown on every visit until accepted. Decline leaves the site for the address in config.
  function cookies() {
    let seen = false;
    try { seen = localStorage.getItem('nebari:cookies') === 'accepted'; } catch (_) { seen = false; }
    if (seen) return;
    const el = document.createElement('div');
    el.className = 'cookies'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Cookies');
    el.innerHTML = `
      <div class="cookies-box">
        <canvas class="cookies-canvas" aria-hidden="true"></canvas>
        <span class="mark">${LOGO}</span>
        <h3>A few <em>cookies</em><br>before you come in.</h3>
        <p>${brand} keeps two things in this browser: which wallet you connected and your answer here. Nothing else, and nothing is sent to anyone. Accept to come in. Decline and we will show you the door.</p>
        <div class="cookies-actions">
          <button class="btn btn-primary" type="button" id="cookies-accept">Accept and enter</button>
          <button class="btn btn-ghost" type="button" id="cookies-decline">Decline</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('cookies-open');
    if (window.Bonsai) Bonsai.mount(el.querySelector('.cookies-canvas'), (w, h) => ({ x: w * 0.55, y: h * 0.96, height: h * 0.9, seed: 'nebari-cookies', growth: 1, shadow: false }));
    el.querySelector('#cookies-accept').focus();
    el.querySelector('#cookies-accept').addEventListener('click', () => {
      try { localStorage.setItem('nebari:cookies', 'accepted'); } catch (_) { /* ignore */ }
      el.remove(); document.body.classList.remove('cookies-open');
    });
    el.querySelector('#cookies-decline').addEventListener('click', () => {
      try { localStorage.removeItem('nebari:cookies'); localStorage.removeItem('nebari:wallet'); } catch (_) { /* ignore */ }
      const to = (C.cookies && C.cookies.declineRedirect) || 'https://www.ponslaunchpad.com/';
      window.location.href = to;
    });
  }

  // --------------------------------------------------------------- boot
  document.addEventListener('DOMContentLoaded', () => {
    const pageEl = document.querySelector('.page') || document.body;
    pageEl.prepend(header());
    pageEl.appendChild(footer());
    background();

    const nav = document.getElementById('nav');
    const burger = document.getElementById('burger');
    const links = document.getElementById('navlinks');
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', () => links.classList.remove('open'));
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }
    wireWallet();
    cookies();
  });

  window.Chrome = { toast, logoEl, LOGO };
})();
