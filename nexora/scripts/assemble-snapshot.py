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

  /* the bar reads the section behind it and inverts over the ink ones */
  const header = $('header');
  if (header) {
    const inks = $$('[data-nav-ink]');
    const links = $$('header nav ul a');
    const cta = $$('header a[href="#get-started"]');
    let raf = 0;
    const paint = () => {
      raf = 0;
      const mid = 38;
      const dark = inks.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      const lifted = window.scrollY > 12;
      header.className =
        'sticky top-0 z-50 transition-colors duration-500 ' +
        (dark
          ? 'text-canvas ' + (lifted ? 'border-b border-hairDark bg-ink/90 backdrop-blur-md' : 'border-b border-transparent')
          : 'text-ink ' + (lifted ? 'border-b border-hair bg-canvas/85 backdrop-blur-md' : 'border-b border-transparent'));
      links.forEach((a) => {
        a.className = 'text-[14px] transition-colors duration-300 ' +
          (dark ? 'text-canvas/60 hover:text-canvas' : 'text-muted hover:text-ink');
      });
      cta.forEach((a) => {
        a.classList.toggle('bg-canvas', dark);
        a.classList.toggle('text-ink', dark);
        a.classList.toggle('bg-ink', !dark);
        a.classList.toggle('text-canvas', !dark);
      });
      $$('.burger-bar').forEach((i) => {
        i.classList.toggle('bg-canvas', dark);
        i.classList.toggle('bg-ink', !dark);
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
  }

  /* mobile menu */
  const burger = $('button[aria-controls="mobile-menu"]');
  const menu = $('#mobile-menu');
  if (burger && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    setOpen(false);
    burger.addEventListener('click', () => setOpen(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
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
        let bar = t.querySelector('.tab-underline');
        if (on && !bar) {
          bar = document.createElement('span');
          bar.className = 'tab-underline absolute inset-x-3 -bottom-px h-[2px] bg-coral';
          t.appendChild(bar);
        } else if (!on && bar) {
          bar.remove();
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
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const icon = btn.querySelector('span[aria-hidden]');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if (panel) panel.hidden = open;
      if (icon) icon.classList.toggle('rotate-45', !open);
    });
  });

  /* freeze switch on the console */
  const freeze = $$('button').find((b) => /Freeze card|Unfreeze card/.test(b.textContent || ''));
  if (freeze) {
    freeze.addEventListener('click', () => {
      freeze.textContent = /Unfreeze/.test(freeze.textContent || '') ? 'Freeze card' : 'Unfreeze card';
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

HEAD = """<title>Nexora Payment Rail</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap">"""


def main() -> int:
    target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "nexora-snapshot.html")

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
    # give the burger bars a hook the script can recolour
    body = body.replace(
        'class="absolute left-0 block h-[1.5px] w-4 transition-all duration-200 bg-ink',
        'class="burger-bar absolute left-0 block h-[1.5px] w-4 transition-all duration-200 bg-ink',
    )

    target.write_text(f"{HEAD}\n<style>\n{css}\n</style>\n\n{body}\n\n<script>\n{VANILLA}\n</script>\n")
    print(f"wrote {target} ({target.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
