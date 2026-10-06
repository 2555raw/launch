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

// Highlight the nav link of the section in view.
const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
if (sections.length && "IntersectionObserver" in window) {
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links) a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));
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
  } catch {
    toast("Copy blocked by the browser; select the text instead");
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
