// Shared page behaviour: mobile drawer, active nav link, scroll reveal, toast, copy.

const burger = document.querySelector(".burger");
const drawer = document.querySelector(".drawer");
if (burger && drawer) {
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    drawer.classList.toggle("open", open);
  });
  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) {
      burger.setAttribute("aria-expanded", "false");
      drawer.classList.remove("open");
    }
  });
}

// Lift the nav once the page scrolls.
const navWrap = document.querySelector(".nav-wrap");
if (navWrap) {
  const onScroll = () => navWrap.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Theme: light, dark, or the system's until someone picks. The choice is
// applied by a one-line script in each page's head, before anything paints.
const root = document.documentElement;
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const themeNow = () => root.dataset.theme || (systemDark.matches ? "dark" : "light");
function setTheme(t) {
  root.dataset.theme = t;
  try { localStorage.setItem("obscura.theme", t); } catch { /* this visit only */ }
  syncThemeButtons();
}
function syncThemeButtons() {
  for (const b of document.querySelectorAll("[data-theme-toggle]")) {
    const next = themeNow() === "dark" ? "light" : "dark";
    b.setAttribute("aria-label", `Switch to ${next} theme`);
    b.dataset.label = next === "dark" ? "Dark theme" : "Light theme";
  }
}
const themeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>';
const navRight = document.querySelector(".nav-right");
if (navRight) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "theme-btn"; b.dataset.themeToggle = "";
  b.innerHTML = themeIcon + "<span>Theme</span>";
  navRight.prepend(b);
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-theme-toggle]")) setTheme(themeNow() === "dark" ? "light" : "dark");
});
systemDark.addEventListener?.("change", syncThemeButtons);
syncThemeButtons();

// On wide screens the top bar moves to a side rail once the hero is passed.
// It is built from the top bar's own links, so every page gets the same one.
const ICONS = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  films: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  demo: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  token: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
  faq: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.3M12 17h.01"/>',
  verify: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  console: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
  launch: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
function iconFor(href) {
  if (/#story|index\.html$|^\.?\/?$/.test(href)) return ICONS.info;
  if (/#films/.test(href)) return ICONS.films;
  if (/#demo/.test(href)) return ICONS.demo;
  if (/#token/.test(href)) return ICONS.token;
  if (/#faq/.test(href)) return ICONS.faq;
  if (/verify/.test(href)) return ICONS.verify;
  if (/console/.test(href)) return ICONS.console;
  return ICONS.info;
}
const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const topNav = document.querySelector(".nav");
if (topNav) {
  const rail = document.createElement("nav");
  rail.className = "side-rail";
  rail.setAttribute("aria-label", "Main, side");
  const brand = topNav.querySelector(".brand");
  const home = document.createElement("a");
  home.className = "side-item side-brand";
  home.href = brand.getAttribute("href");
  home.dataset.label = "Obscura";
  home.setAttribute("aria-label", "Obscura, home");
  home.innerHTML = brand.querySelector(".brand-mark").innerHTML;
  const items = [...topNav.querySelectorAll(".nav-links a")].map((a) => {
    const it = document.createElement("a");
    it.className = "side-item";
    it.href = a.getAttribute("href");
    it.dataset.label = a.textContent.trim();
    it.setAttribute("aria-label", a.textContent.trim());
    if (a.getAttribute("aria-current") === "page") it.setAttribute("aria-current", "page");
    it.innerHTML = svg(iconFor(it.getAttribute("href")));
    return it;
  });
  const sep = () => Object.assign(document.createElement("span"), { className: "side-sep" });
  const extras = [];
  const x = topNav.querySelector('a[href*="x.com"]');
  if (x) {
    const it = document.createElement("a");
    it.className = "side-item"; it.href = x.href; it.target = "_blank"; it.rel = "noopener";
    it.dataset.label = "Obscura on X"; it.setAttribute("aria-label", "Obscura on X");
    it.innerHTML = x.innerHTML;
    extras.push(it);
  }
  if (topNav.querySelector("[data-wallet-open]")) {
    const it = document.createElement("button");
    it.type = "button"; it.className = "side-item"; it.dataset.walletOpen = ""; it.dataset.compact = "";
    it.dataset.label = "Connect wallet"; it.setAttribute("aria-label", "Connect wallet");
    it.innerHTML = svg(ICONS.wallet);
    extras.push(it);
  }
  const launch = topNav.querySelector('a.btn-dark[href="console.html"]');
  if (launch) {
    const it = document.createElement("a");
    it.className = "side-item side-launch"; it.href = "console.html";
    it.dataset.label = "Launch app"; it.setAttribute("aria-label", "Launch app");
    it.innerHTML = svg(ICONS.launch);
    extras.push(it);
  }
  const theme = document.createElement("button");
  theme.type = "button"; theme.className = "side-item"; theme.dataset.themeToggle = "";
  theme.innerHTML = themeIcon;
  extras.unshift(theme);
  rail.append(home, sep(), ...items, ...(extras.length ? [sep(), ...extras] : []));
  syncThemeButtons();
  document.body.append(rail);

  // Past the first screen, the bar becomes the rail; back near the top, it returns.
  const wide = matchMedia("(min-width: 1360px)");
  const update = () => {
    document.documentElement.classList.toggle("side-on", wide.matches && scrollY > innerHeight * 0.6);
    const max = document.documentElement.scrollHeight - innerHeight;
    rail.style.setProperty("--read", max > 0 ? Math.min(1, scrollY / max).toFixed(3) : "0");
  };
  addEventListener("scroll", update, { passive: true });
  wide.addEventListener?.("change", update);
  update();
}

// Highlight the nav link of the section in view.
const links = [...document.querySelectorAll('.nav-links a[href^="#"], .side-rail a.side-item:not(.side-brand)[href^="#"]')];
const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
// The current section is the last one whose top has passed 40% of the viewport,
// so short sections near the end (the FAQ) still get their turn.
if (sections.length) {
  let ticking = false;
  const spy = () => {
    ticking = false;
    const line = innerHeight * 0.4;
    let current = null;
    for (const sec of sections) if (sec.getBoundingClientRect().top <= line) current = sec;
    if (current && current.getBoundingClientRect().bottom < 0) current = null;
    for (const a of links) a.setAttribute("aria-current", String(!!current && a.getAttribute("href") === "#" + current.id));
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  spy();
}

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("in"));
}

let toastTimer;
export function toast(text) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

export async function copy(text, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
    return true;
  } catch {
    toast("Copy blocked by the browser; select the text instead");
    return false;
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const src = document.querySelector(btn.dataset.copy);
  if (src) copy(src.value ?? src.textContent, btn.dataset.copyLabel || "Copied");
});

// Inside a preview frame (for example a claude.ai link), wallets, chain lookups
// and downloads are blocked. Point people at the full site instead of letting
// those features fail quietly.
const FULL_SITE = "https://launch-production-c4cd.up.railway.app";
let framed = false;
try { framed = window.self !== window.top; } catch { framed = true; }
if (framed && !location.href.startsWith(FULL_SITE)) {
  const bar = document.createElement("div");
  bar.className = "preview-bar";
  bar.setAttribute("role", "note");
  const text = document.createElement("span");
  text.textContent = "Preview: wallets, balance checks and downloads only work on the full site.";
  const link = document.createElement("a");
  link.href = FULL_SITE + location.pathname.replace(/^.*\//, "/") + location.hash;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Open the full site";
  bar.append(text, link);
  document.body.prepend(bar);
  document.documentElement.classList.add("has-preview-bar");
}

// Sealing needs the Web Crypto API, which browsers only expose on https.
if (!globalThis.crypto?.subtle) {
  const bar = document.createElement("div");
  bar.className = "preview-bar";
  bar.setAttribute("role", "alert");
  bar.textContent = "This page needs a secure connection (https) to seal and check proofs. Open it from its https address.";
  document.body.prepend(bar);
  document.documentElement.classList.add("has-preview-bar");
}

// Install as an app and keep working offline (see sw.js). Not inside a preview
// frame, and only where browsers allow service workers.
if ("serviceWorker" in navigator && !framed && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Anonymous counts (see server.js): a page view or an action name, nothing else.
const counting = !framed && /^https?:$/.test(location.protocol) && !navigator.webdriver;
export function track(name) {
  if (!counting) return;
  try { navigator.sendBeacon?.("/api/e", new Blob([JSON.stringify({ e: name })], { type: "application/json" })); } catch { /* not counted */ }
}
track("view:" + location.pathname.replace(/\/index\.html$/, "/"));
addEventListener("appinstalled", () => track("install"));
