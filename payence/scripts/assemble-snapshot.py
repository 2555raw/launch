#!/usr/bin/env python3
"""Flatten the static export into one self-contained HTML file.

    npm run snapshot                          # exports to .next-snapshot/
    python3 scripts/assemble-snapshot.py out.html

The export is a normal Next.js page: markup plus a stylesheet plus the React
runtime. A single file can carry the first two but not the third, so the
behaviour that lived in React is restored here as a small vanilla script — the
bar that inverts over the ink sections, the menu, the platform tabs, the FAQ,
the freeze switch and the ticking budget. Everything renders at rest; nothing
waits on an observer to become visible.
"""

import glob
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPORT = ROOT / ".next-snapshot"

VANILLA = r"""
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the floating bar gains a shadow once the page has moved */
  const bar = $('header > div');
  if (bar) {
    const SHADOW = 'shadow-[0_18px_44px_-30px_rgba(21,21,21,0.6)]';
    const onScroll = () => bar.classList.toggle(SHADOW, window.scrollY > 12);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* mobile menu */
  const burger = $('button[aria-controls="mobile-menu"]');
  const menu = $('#mobile-menu');
  if (burger && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      $$('.burger-bar', burger).forEach((el, i) => {
        el.style.transform = open ? (i === 0 ? 'rotate(45deg)' : i === 2 ? 'rotate(-45deg)' : '') : '';
        el.style.top = open ? '5px' : ['0px', '5px', '10px'][i];
        if (i === 1) el.style.opacity = open ? '0' : '1';
      });
    };
    setOpen(false);
    burger.addEventListener('click', () => setOpen(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  }

  /* the authorization log writes itself out once it is in view */
  const term = $('#agent-terminal');
  if (term && !still) {
    const lines = $$('[data-term-line]', term);
    const caret = $('[data-term-caret]', term);
    lines.forEach((l) => { l.hidden = true; });
    if (caret) caret.hidden = false;
    let i = 0;
    const step = () => {
      if (i >= lines.length) { if (caret) caret.hidden = true; return; }
      lines[i].hidden = false;
      i += 1;
      setTimeout(step, 220);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); setTimeout(step, 260); }
    }, { threshold: 0.25 });
    io.observe(term);
  }

  /* the card panel: the allowlist, what you took off it, and the freeze switch */
  const panel = $('[data-card-panel]');
  if (panel) {
    const list = $('[data-allow-list]', panel);
    const suggest = $('[data-allow-suggest]', panel);
    const count = $('[data-allow-count]', panel);
    const input = $('[data-allow-input]', panel);
    const addBtn = $('[data-allow-add]', panel);
    const freeze = $('[data-freeze]', panel);
    const state = $('[data-card-state]', panel);
    const light = $('[data-freeze-light]', panel);
    const copy = $('[data-freeze-copy]', panel);

    const clean = (v) => v.replace(/[<>&"]/g, '');
    const named = (el) => (el.dataset.suggest || el.textContent || '').replace(/^\+\s*/, '').replace(/\s*×$/, '').trim();
    const listed = (name) =>
      $$('li', list).some((li) => named(li).toLowerCase() === name.toLowerCase());

    const sync = () => {
      if (count) count.textContent = $$('li', list).length + ' allowed';
      if (suggest) suggest.hidden = $$('[data-suggest]', suggest).length === 0;
    };

    const addSuggestion = (name) => {
      if (!suggest || $(`[data-suggest="${name}"]`, suggest)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.suggest = name;
      b.className =
        'inline-flex items-center gap-1.5 rounded-pill border border-dashed border-canvas/25 py-1.5 pl-3 pr-3 font-mono text-[12px] text-canvas/55 transition-colors duration-200 hover:border-positive hover:text-positive';
      b.innerHTML = '<span aria-hidden>+</span>' + clean(name);
      suggest.appendChild(b);
      wireSuggestion(b);
      sync();
    };

    const addChip = (name) => {
      if (!list || !name || listed(name)) return;
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="inline-flex items-center gap-2 rounded-pill border border-hairDark bg-canvas/[0.04] py-1.5 pl-3.5 pr-2 font-mono text-[12px]">' +
        clean(name) +
        '<button type="button" aria-label="Remove ' + clean(name) + '" class="flex h-4 w-4 items-center justify-center rounded-full border border-canvas/25 text-[10px] leading-none text-canvas/60 transition-colors duration-200 hover:border-coral hover:text-coral">×</button></span>';
      list.appendChild(li);
      wireChip(li);
      sync();
    };

    function wireChip(li) {
      const btn = $('button', li);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const name = named(li);
        li.remove();
        addSuggestion(name);
        sync();
      });
    }

    function wireSuggestion(b) {
      b.addEventListener('click', () => {
        const name = named(b);
        b.remove();
        addChip(name);
        sync();
      });
    }

    if (list) $$('li', list).forEach(wireChip);
    if (suggest) $$('[data-suggest]', suggest).forEach(wireSuggestion);

    const submit = () => {
      const name = (input?.value || '').trim();
      if (!name) return;
      const pending = suggest && $(`[data-suggest="${name}"]`, suggest);
      if (pending) pending.remove();
      addChip(name);
      input.value = '';
    };
    addBtn?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    freeze?.addEventListener('click', () => {
      const frozen = freeze.getAttribute('aria-pressed') !== 'true';
      freeze.setAttribute('aria-pressed', String(frozen));
      freeze.textContent = frozen ? 'Unfreeze card' : 'Freeze card';
      freeze.className =
        'h-9 shrink-0 rounded-pill px-4 text-[13px] font-medium transition-colors duration-200 ' +
        (frozen ? 'bg-danger text-canvas' : 'bg-canvas text-ink hover:bg-coral hover:text-canvas');
      if (light) {
        light.className =
          'h-2 w-2 rounded-full transition-colors duration-300 ' +
          (frozen
            ? 'bg-danger shadow-[0_0_10px_rgba(229,72,77,0.8)]'
            : 'bg-positive shadow-[0_0_10px_rgba(40,169,107,0.7)]');
      }
      if (state) {
        state.className =
          'inline-flex items-center gap-2 rounded-pill border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ' +
          (frozen ? 'border-danger/50 text-danger' : 'border-positive/40 text-positive');
        state.innerHTML =
          '<i class="h-1.5 w-1.5 rounded-full animate-pulseDot ' +
          (frozen ? 'bg-danger' : 'bg-positive') + '"></i>' +
          (frozen ? 'Frozen' : 'Active');
      }
      if (copy) copy.textContent = frozen
        ? 'Frozen. Every agent payment on this card is declined.'
        : 'Freeze instantly to block every agent payment.';
    });
  }

  /* the card face takes its colour from two custom properties */
  const face = $('[data-card-face]');
  const swatches = $$('[data-card-theme]');
  if (face && swatches.length) {
    const ON = 'border-canvas ring-2 ring-canvas/70 ring-offset-2 ring-offset-[#0F0F0F]';
    const OFF = 'border-canvas/25';
    swatches.forEach((sw) => {
      sw.addEventListener('click', () => {
        face.style.setProperty('--face', sw.dataset.face);
        face.style.setProperty('--ink', sw.dataset.ink);
        swatches.forEach((other) => {
          const on = other === sw;
          other.setAttribute('aria-pressed', String(on));
          other.className =
            'h-6 w-6 rounded-full border transition-transform duration-200 hover:scale-110 ' +
            (on ? ON : OFF);
        });
      });
    });
  }

  /* the terms gate: it waits until the visitor has scrolled into the page */
  const gate = $('[data-terms-gate]');
  const blocked = $('[data-terms-blocked]');
  if (gate && blocked) {
    const KEY = 'payence-terms';
    let accepted = false;
    try { accepted = localStorage.getItem(KEY) === 'accepted'; } catch (_) {}

    const lock = (on) => { document.body.style.overflow = on ? 'hidden' : ''; };
    const show = (which) => {
      gate.hidden = which !== 'gate';
      blocked.hidden = which !== 'blocked';
      lock(which !== 'none');
      if (which === 'gate') $('[data-terms-accept]', gate)?.focus();
    };

    if (!accepted) {
      const onScroll = () => {
        if (window.scrollY < 520) return;
        removeEventListener('scroll', onScroll);
        show('gate');
      };
      addEventListener('scroll', onScroll, { passive: true });
    }

    $('[data-terms-accept]', gate)?.addEventListener('click', () => {
      try { localStorage.setItem(KEY, 'accepted'); } catch (_) {}
      show('none');
    });
    $('[data-terms-decline]', gate)?.addEventListener('click', () => show('blocked'));
    $('[data-terms-print]', gate)?.addEventListener('click', () => window.print());
    $('[data-terms-review]', blocked)?.addEventListener('click', () => show('gate'));

    /* Tab stays inside the dialog while it is up */
    addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || gate.hidden) return;
      const f = $$('button, [href], input, [tabindex]:not([tabindex="-1"])', gate);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* the network picker: one choice, and the mark lands on the card */
  const picker = $('[data-network-picker]');
  if (picker) {
    const toggle = $('[data-network-toggle]', picker);
    const menu = $('[data-network-menu]', picker);
    const current = $('[data-network-current]', picker);
    const onCard = $('[data-card-network]');
    const tick = $('[data-network-tick]', picker);

    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      const chev = toggle.querySelector('svg:last-of-type');
      if (chev) chev.classList.toggle('rotate-180', open);
    };
    setOpen(false);

    toggle?.addEventListener('click', () => setOpen(menu.hidden));
    document.addEventListener('mousedown', (e) => {
      if (!picker.contains(e.target)) setOpen(false);
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

    $$('[data-network-option]', menu).forEach((opt) => {
      opt.addEventListener('click', () => {
        const name = opt.dataset.networkName || '';
        const mark = opt.querySelector('svg');

        // the mark the option shows is the mark that lands on the card
        if (onCard && mark) {
          onCard.innerHTML = '';
          onCard.appendChild(mark.cloneNode(true));
          const label = document.createElement('span');
          label.className = 'mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] opacity-60';
          label.textContent = name;
          onCard.appendChild(label);
        }
        if (current && mark) {
          current.innerHTML = '';
          current.appendChild(mark.cloneNode(true));
          const label = document.createElement('span');
          label.className = 'font-mono text-[12px]';
          label.textContent = name;
          current.appendChild(label);
        }

        $$('[data-network-option]', menu).forEach((other) => {
          const on = other === opt;
          other.setAttribute('aria-checked', String(on));
          other.classList.toggle('bg-canvas/[0.04]', on);
        });
        if (tick) opt.appendChild(tick);

        setOpen(false);
      });
    });
  }

  /* the remaining budget ticks the way a live figure would */
  const budget = $$('p').find((p) => /^\$2,\d{3}$/.test((p.textContent || '').trim()));
  if (budget && !still) {
    let v = 2391;
    setInterval(() => {
      v = v <= 2280 ? 2391 : v - (Math.floor(Math.random() * 9) + 2);
      budget.textContent = '$' + v.toLocaleString('en-US');
      budget.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    }, 2600);
  }
})();
"""

HEAD = """<title>Payence Payment Rail</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap">"""


def main() -> int:
    target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "payence-snapshot.html")

    index = EXPORT / "index.html"
    if not index.exists():
        print("No export found. Run `npm run snapshot` first.", file=sys.stderr)
        return 1

    html = index.read_text()
    css = pathlib.Path(glob.glob(str(EXPORT / "_next/static/css/*.css"))[0]).read_text()

    body = html.split("<body>", 1)[1].split("</body>", 1)[0]
    body = re.sub(r"<script[\s\S]*?</script>", "", body)
    body = re.sub(r"<!--\$-->|<!--/\$-->|<!---->", "", body)
    # Framer Motion serialises its `initial` state; nothing ships at opacity 0.
    body = re.sub(r"opacity:\s*0(?![.\d])", "opacity:1", body)
    # the underline is rendered by Framer Motion's shared-layout span; tag it so
    # the script can move it between tabs
    body = body.replace(
        'class="absolute inset-x-3 -bottom-px h-[2px] bg-coral"',
        'class="tab-underline absolute inset-x-3 -bottom-px h-[2px] bg-coral"',
    )

    target.write_text(f"{HEAD}\n<style>\n{css}\n</style>\n\n{body}\n\n<script>\n{VANILLA}\n</script>\n")
    print(f"wrote {target} ({target.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
