/* RENTA docs — the sidebar follows the heading you are reading. */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('#side a'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  if (!heads.length) return;

  function setActive(id) {
    links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); });
  }

  /* the active heading is the last one above the reading line */
  var ticking = false;
  function update() {
    ticking = false;
    var line = window.scrollY + window.innerHeight * 0.28;
    var current = heads[0];
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top + window.scrollY <= line) current = heads[i];
    }
    setActive(current.id);
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
