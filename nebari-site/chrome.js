// Nebari — the parts every page shares: header, footer, wallet button, logos, toasts,
// the background bonsai and the scroll reveal.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;

  const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">
    <rect x="33" y="0" width="34" height="18" rx="9"/>
    <rect x="33" y="82" width="34" height="18" rx="9"/>
    <rect x="0" y="33" width="18" height="34" rx="9"/>
    <rect x="82" y="33" width="18" height="34" rx="9"/>
    <rect x="16.5" y="16.5" width="17" height="17" rx="4.5"/>
    <rect x="66.5" y="16.5" width="17" height="17" rx="4.5"/>
    <rect x="16.5" y="66.5" width="17" height="17" rx="4.5"/>
    <rect x="66.5" y="66.5" width="17" height="17" rx="4.5"/>
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
          <a class="btn btn-primary btn-sm" href="launch.html"><span class="nav-cta-text">Launch a token</span></a>
        </div>
      </div>`;
    return el;
  }

  function footer() {
    const el = document.createElement('footer');
    el.className = 'footer';
    el.innerHTML = `
      <div class="wrap footer-in">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" href="index.html"><span class="mark">${LOGO}</span><span class="brand-name">${brand.toUpperCase()}</span></a>
            <p>Robinhood Chain tokens with roots in any stock or asset. Liquidity sealed at launch, fees paid to the people who hold them.</p>
            <div class="footer-social">
              <a class="icon-btn" href="${C.links.x}" target="_blank" rel="noopener" aria-label="${brand} on X">${X_ICON}</a>
            </div>
          </div>
          <div class="footer-cols">
            <div><h4>PROTOCOL</h4><a href="launch.html">Launch a token</a><a href="explore.html">Explore</a><a href="claim.html">Claim fees</a></div>
            <div><h4>LEARN</h4><a href="docs.html">Docs</a><a href="index.html#how">How it works</a><a href="index.html#assets">Assets</a><a href="index.html#faq">FAQ</a></div>
          </div>
        </div>
        <div class="footer-bottom"><p class="copy">© ${new Date().getFullYear()} ${brand}. Built on Robinhood Chain.</p></div>
      </div>`;
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
    const low = sym.toLowerCase();
    // transparent versions first (no disc behind the mark), then the round files, then the site icon
    const srcs = [
      { src: `assets/logos/bare/${low}.svg`, bare: true },
      { src: `assets/logos/bare/${low}.png`, bare: true },
      { src: `assets/logos/${low}.png` },
    ];
    if (asset.logo) srcs.push({ src: asset.logo });
    if (asset.domain) {
      srcs.push({ src: `https://www.google.com/s2/favicons?domain=${asset.domain}&sz=128` });
      srcs.push({ src: `https://icons.duckduckgo.com/ip3/${asset.domain}.ico` });
    }
    const img = document.createElement('img');
    img.alt = sym + ' logo'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    let i = 0, current = null;
    const setBare = (on) => {
      box.classList.toggle('asset-logo-bare', on);
      if (!on && asset.logoBg) { box.style.background = asset.logoBg; box.style.borderColor = asset.logoBg; box.classList.add('asset-logo-padded'); }
      else { box.style.background = ''; box.style.borderColor = ''; box.classList.remove('asset-logo-padded'); }
    };
    const next = () => {
      if (i >= srcs.length) { img.remove(); setBare(false); box.innerHTML = `<span class="mono">${sym.slice(0, 4)}</span>`; return; }
      current = srcs[i++];
      img.src = current.src;
    };
    img.onerror = next;
    img.onload = () => { if (img.naturalWidth < 8) next(); else setBare(!!current.bare); };
    next();
    box.appendChild(img);
    return box;
  }

  // --------------------------------------------------------- background
  function background() { /* plain black page, nothing drawn behind it */ }

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
        <span class="cookies-mark" aria-hidden="true">${LOGO}</span>
        <span class="mark">${LOGO}</span>
        <h3>A few cookies<br>before you come in.</h3>
        <p>${brand} keeps two things in this browser: which wallet you connected and your answer here. Nothing else, and nothing is sent to anyone. Accept to come in. Decline and we will show you the door.</p>
        <div class="cookies-actions">
          <button class="btn btn-primary" type="button" id="cookies-accept">Accept and enter</button>
          <button class="btn btn-ghost" type="button" id="cookies-decline">Decline</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('cookies-open');
    el.addEventListener('animationend', () => {}, { once: true });
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
