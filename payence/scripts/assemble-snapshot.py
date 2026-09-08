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

  /* the card panel: allowlist, and the freeze switch */
  const panel = $('[data-card-panel]');
  if (panel) {
    const list = $('[data-allow-list]', panel);
    const count = $('[data-allow-count]', panel);
    const input = $('[data-allow-input]', panel);
    const addBtn = $('[data-allow-add]', panel);
    const freeze = $('[data-freeze]', panel);
    const state = $('[data-card-state]', panel);
    const copy = $('[data-freeze-copy]', panel);

    const sync = () => { if (count) count.textContent = $$('li', list).length + ' allowed'; };

    const wireChip = (li) => {
      const btn = $('button', li);
      if (btn) btn.addEventListener('click', () => { li.remove(); sync(); });
    };
    if (list) $$('li', list).forEach(wireChip);

    const add = () => {
      const name = (input?.value || '').trim();
      if (!name || !list) return;
      const taken = $$('li', list).some((li) => li.textContent.trim().replace(/\s*×$/, '').toLowerCase() === name.toLowerCase());
      if (taken) return;
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="inline-flex items-center gap-2 rounded-pill border border-hairDark bg-canvas/[0.04] py-1.5 pl-3.5 pr-2 font-mono text-[12px]">' +
        name.replace(/[<>&]/g, '') +
        '<button type="button" aria-label="Remove ' + name.replace(/["<>&]/g, '') + '" class="flex h-4 w-4 items-center justify-center rounded-full border border-canvas/25 text-[10px] leading-none text-canvas/60 transition-colors duration-200 hover:border-coral hover:text-coral">×</button></span>';
      list.appendChild(li);
      wireChip(li);
      input.value = '';
      sync();
    };
    addBtn?.addEventListener('click', add);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    freeze?.addEventListener('click', () => {
      const frozen = freeze.getAttribute('aria-pressed') !== 'true';
      freeze.setAttribute('aria-pressed', String(frozen));
      freeze.textContent = frozen ? 'Unfreeze card' : 'Freeze card';
      freeze.className =
        'h-9 shrink-0 rounded-pill px-4 text-[13px] font-medium transition-colors duration-200 ' +
        (frozen ? 'bg-coral text-canvas' : 'bg-canvas text-ink hover:bg-coral hover:text-canvas');
      if (state) {
        state.className =
          'inline-flex items-center gap-2 rounded-pill border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ' +
          (frozen ? 'border-hairDark text-canvas/50' : 'border-positive/40 text-positive');
        state.innerHTML =
          '<i class="h-1.5 w-1.5 rounded-full ' +
          (frozen ? 'bg-canvas/40' : 'bg-positive animate-pulseDot') + '"></i>' +
          (frozen ? 'Frozen' : 'Active');
      }
      if (copy) copy.textContent = frozen
        ? 'Frozen. Every agent payment on this card is declined.'
        : 'Freeze instantly to block every agent payment.';
    });
  }

  /* platform tabs */
  const tabs = $$('[role="tab"]');
  if (tabs.length) {
    const select = (key) => {
      tabs.forEach((t) => {
        const on = t.id === 'tab-' + key;
        t.setAttribute('aria-selected', String(on));
        t.className =
          'relative whitespace-nowrap px-5 py-3.5 text-[14px] transition-colors duration-200 ' +
          (on ? 'text-ink' : 'text-muted hover:text-ink');
        let ul = t.querySelector('.tab-underline');
        if (on && !ul) {
          ul = document.createElement('span');
          ul.className = 'tab-underline absolute inset-x-3 -bottom-px h-[2px] bg-coral';
          t.appendChild(ul);
        } else if (!on && ul) {
          ul.remove();
        }
      });
      $$('[role="tabpanel"]').forEach((p) => {
        const on = p.id === 'panel-' + key;
        p.hidden = !on;
        if (on && !still) {
          p.animate(
            [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
            { duration: 280, easing: 'cubic-bezier(.22,.65,.3,1)' }
          );
        }
      });
    };
    tabs.forEach((t) => t.addEventListener('click', () => select(t.id.replace('tab-', ''))));
  }

  /* faq */
  $$('button[aria-controls^="faq-"]').forEach((btn) => {
    const p = document.getElementById(btn.getAttribute('aria-controls'));
    const icon = btn.querySelector('span[aria-hidden]');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if (p) p.hidden = open;
      if (icon) icon.classList.toggle('rotate-45', !open);
    });
  });

  /* terms and privacy dialogs */
  let opener = null;
  const closeLegal = () => {
    $$('[data-legal-panel]').forEach((p) => { p.hidden = true; });
    document.body.style.overflow = '';
    if (opener) { opener.focus(); opener = null; }
  };
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-legal]');
    if (open) {
      e.preventDefault();
      opener = open;
      const panel = $('[data-legal-panel="' + open.dataset.legal + '"]');
      if (panel) {
        panel.hidden = false;
        document.body.style.overflow = 'hidden';
        $('[role="dialog"]', panel)?.focus();
      }
      return;
    }
    if (e.target.closest('[data-legal-close]')) closeLegal();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLegal(); });

  /* the freeze switch on the console further down */
  const consoleFreeze = $$('button').find((b) => !b.hasAttribute('data-freeze') && /^(Freeze|Unfreeze) card$/.test((b.textContent || '').trim()));
  if (consoleFreeze) {
    consoleFreeze.addEventListener('click', () => {
      consoleFreeze.textContent = /Unfreeze/.test(consoleFreeze.textContent || '') ? 'Freeze card' : 'Unfreeze card';
    });
  }

  /* the headline arrives a word at a time */
  const words = $$('[data-hero-word]');
  if (words.length && !still) {
    words.forEach((w, i) => {
      w.animate(
        [{ opacity: 0, transform: 'translateY(0.42em)' }, { opacity: 1, transform: 'none' }],
        { duration: 660, delay: 100 + i * 75, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'backwards' }
      );
    });
  }

  /* figures count to their value when they reach the viewport */
  $$('[data-countup]').forEach((el) => {
    const to = Number(el.dataset.countup);
    let opts = { decimals: 0, prefix: '', suffix: '' };
    try { opts = { ...opts, ...JSON.parse(el.dataset.countupFormat || '{}') }; } catch (_) {}
    const fmt = (n) => opts.prefix + n.toLocaleString('en-US', {
      minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals,
    }) + opts.suffix;
    if (still || !Number.isFinite(to)) return;
    el.textContent = fmt(0);
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1400);
        el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick); else el.textContent = fmt(to);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
  });

  /* the spend bars grow into place */
  const bars = $$('[data-spend-bar]');
  if (bars.length && !still) {
    bars.forEach((bar) => { bar.style.height = '0%'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        $$('[data-spend-bar]', entry.target).forEach((bar, i) => {
          bar.style.height = bar.dataset.spendBar + '%';
          bar.animate([{ height: '0%' }, { height: bar.dataset.spendBar + '%' }],
            { duration: 700, delay: i * 70, easing: 'cubic-bezier(.22,.65,.3,1)' });
        });
      });
    }, { threshold: 0.3 });
    bars.forEach((bar) => { if (bar.parentElement) io.observe(bar.parentElement); });
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
