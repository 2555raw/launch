// AZUR docs: sidebar toggle, search filter, Ctrl/Cmd+K, and "On this page" scroll tracking.
(function () {
  "use strict";
  const body = document.body;
  const open = document.getElementById("sideOpen");
  const mobile = () => window.matchMedia("(max-width: 820px)").matches;

  document.getElementById("sideToggle").addEventListener("click", () => {
    if (mobile()) { body.classList.remove("menu"); return; }
    body.classList.add("collapsed");
    open.hidden = false;
  });
  open.addEventListener("click", () => {
    if (mobile()) { body.classList.toggle("menu"); return; }
    body.classList.remove("collapsed");
    open.hidden = true;
  });
  if (mobile()) open.hidden = false;
  document.querySelectorAll(".side-nav a").forEach((a) => a.addEventListener("click", () => body.classList.remove("menu")));

  // Search: hides the sections (and their index links) that do not match.
  const q = document.getElementById("q");
  const sections = [...document.querySelectorAll(".content section")];
  const tocLinks = [...document.querySelectorAll("#toc a")];
  const navLinks = [...document.querySelectorAll(".side-nav a")];
  const noHits = document.getElementById("noHits");
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    let hits = 0;
    sections.forEach((s) => {
      const text = (s.dataset.k + " " + s.textContent).toLowerCase();
      const match = !term || text.includes(term);
      s.classList.toggle("hide", !match);
      if (match) hits++;
      tocLinks.filter((a) => a.hash === "#" + s.id).forEach((a) => (a.hidden = !match));
    });
    navLinks.forEach((a) => {
      const target = a.hash === "#top" ? null : document.querySelector(a.hash);
      a.hidden = !!(term && target && target.classList.contains("hide"));
    });
    noHits.hidden = hits > 0;
    const first = sections.find((s) => !s.classList.contains("hide"));
    if (term && first) first.scrollIntoView({ block: "start" });
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (mobile()) body.classList.add("menu");
      q.focus();
      q.select();
    }
    if (e.key === "Escape") body.classList.remove("menu");
  });

  // Section picker jumps to that part of the page.
  document.getElementById("product").addEventListener("change", (e) => {
    const id = e.target.selectedIndex === 1 ? "chain" : "top";
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
  });

  // Highlight the section currently on screen, in both indexes.
  function track() {
    let current = sections[0];
    for (const s of sections) {
      if (s.classList.contains("hide")) continue;
      if (s.getBoundingClientRect().top < window.innerHeight * 0.35) current = s;
    }
    tocLinks.forEach((a) => a.classList.toggle("on", a.hash === "#" + current.id));
    const navHit = navLinks.find((a) => a.hash === "#" + current.id);
    navLinks.forEach((a) => a.classList.toggle("active", navHit ? a === navHit : a.hash === "#top"));
  }
  window.addEventListener("scroll", track, { passive: true });
  track();

  // Demo buttons on the approval card.
  document.querySelectorAll(".confirm-btns button").forEach((b) =>
    b.addEventListener("click", () => {
      const card = b.closest(".confirm");
      card.querySelector("p").textContent = b.classList.contains("ok")
        ? "Approved. Order sent: 10 HOOD filled at $54.91."
        : "Declined. Nothing was sent.";
      card.querySelector(".confirm-btns").remove();
    })
  );
})();
