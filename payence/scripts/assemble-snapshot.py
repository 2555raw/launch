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
/* Payence — behaviour for the flat snapshot.
   The export carries the markup and the stylesheet; React does not come with
   it, so everything interactive is restored here. Keep this list in sync with
   the components: nav, terminal, card panel, card face, network picker, tabs,
   FAQ, legal dialogs, terms gate, hero motion, counters, bars, budget. */
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the floating bar ---------- */
  const bar = $('header > div');
  if (bar) {
    const SHADOW = 'shadow-[0_18px_44px_-30px_rgba(21,21,21,0.6)]';
    const onScroll = () => bar.classList.toggle(SHADOW, window.scrollY > 12);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile menu ---------- */
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

  /* ---------- the authorization log writes itself out ---------- */
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

  /* ---------- the card panel: allowlist rules, and the freeze switch ---------- */
  const panel = $('[data-card-panel]');
  if (panel) {
    const list = $('[data-allow-list]', panel);
    const suggest = $('[data-allow-suggest]', panel);
    const count = $('[data-allow-count]', panel);
    const input = $('[data-allow-input]', panel);
    const addBtn = $('[data-allow-add]', panel);
    const hint = $('[data-allow-hint]', panel);
    const freeze = $('[data-freeze]', panel);
    const state = $('[data-card-state]', panel);
    const light = $('[data-freeze-light]', panel);
    const copy = $('[data-freeze-copy]', panel);

    const TAG =
      '<svg viewBox="0 0 16 16" class="h-3 w-3 shrink-0 text-violet" aria-hidden><path d="M2.5 7.2V2.5h4.7l6.3 6.3-4.7 4.7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path><circle cx="5.4" cy="5.4" r="1" fill="currentColor"></circle></svg>';

    const clean = (v) => v.replace(/[<>&"]/g, '');
    const named = (el) =>
      (el.dataset.suggest || el.textContent || '').replace(/^\+\s*/, '').replace(/\s*×$/, '').trim();
    const listed = (name) =>
      $$('li', list).some((li) => named(li).toLowerCase() === name.toLowerCase());

    /* which kind of rule the input is writing */
    let kind = 'merchant';
    const toggles = $$('[data-kind-toggle]', panel);
    const paintToggles = () => {
      toggles.forEach((t) => {
        const k = t.dataset.kindToggle;
        const on = k === kind;
        t.setAttribute('aria-pressed', String(on));
        t.className =
          'px-2.5 py-1 font-mono text-[11px] capitalize transition-colors duration-200 ' +
          (on
            ? k === 'category' ? 'bg-violet/25 text-canvas' : 'bg-canvas/15 text-canvas'
            : 'text-canvas/45 hover:text-canvas/80');
      });
      if (input) input.placeholder = kind === 'merchant' ? 'e.g. stripe.com' : 'e.g. observability';
      if (hint) hint.textContent = kind === 'merchant'
        ? 'Merchant — the card clears at this payee and nowhere else.'
        : 'Category — the card clears at every payee in this class of spend.';
    };
    toggles.forEach((t) => t.addEventListener('click', () => { kind = t.dataset.kindToggle; paintToggles(); }));
    paintToggles();

    const sync = () => {
      if (count) count.textContent = $$('li', list).length + ' allowed';
      if (suggest) suggest.hidden = $$('[data-suggest]', suggest).length === 0;
    };

    const addSuggestion = (name, k) => {
      if (!suggest || $('[data-suggest="' + name + '"]', suggest)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.suggest = name;
      b.dataset.kind = k;
      b.className =
        'inline-flex items-center gap-1.5 rounded-pill border border-dashed border-canvas/25 py-1.5 pl-3 pr-3 font-mono text-[12px] text-canvas/55 transition-colors duration-200 hover:border-positive hover:text-positive';
      b.innerHTML = '<span aria-hidden>+</span>' + (k === 'category' ? TAG : '') + clean(name);
      suggest.appendChild(b);
      wireSuggestion(b);
      sync();
    };

    const addChip = (name, k) => {
      if (!list || !name || listed(name)) return;
      const li = document.createElement('li');
      li.dataset.kind = k;
      const shell = k === 'category'
        ? 'border-violet/45 bg-violet/10 text-canvas'
        : 'border-hairDark bg-canvas/[0.04]';
      li.innerHTML =
        '<span class="inline-flex items-center gap-2 rounded-pill border ' + shell +
        ' py-1.5 pl-3 pr-2 font-mono text-[12px]">' +
        (k === 'category' ? TAG : '') + clean(name) +
        '<button type="button" aria-label="Remove ' + clean(name) +
        '" class="flex h-4 w-4 items-center justify-center rounded-full border border-canvas/25 text-[10px] leading-none text-canvas/60 transition-colors duration-200 hover:border-coral hover:text-coral">×</button></span>';
      list.appendChild(li);
      wireChip(li);
      sync();
    };

    function wireChip(li) {
      const btn = $('button', li);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const name = named(li);
        const k = li.dataset.kind || 'merchant';
        li.remove();
        addSuggestion(name, k);
        sync();
      });
    }

    function wireSuggestion(b) {
      b.addEventListener('click', () => {
        const name = named(b);
        const k = b.dataset.kind || 'merchant';
        b.remove();
        addChip(name, k);
        sync();
      });
    }

    if (list) $$('li', list).forEach(wireChip);
    if (suggest) $$('[data-suggest]', suggest).forEach(wireSuggestion);

    const submit = () => {
      const name = (input?.value || '').trim();
      if (!name) return;
      const pending = suggest && $('[data-suggest="' + name + '"]', suggest);
      if (pending) pending.remove();
      addChip(name, kind);
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
          (frozen ? 'bg-danger' : 'bg-positive') + '"></i>' + (frozen ? 'Frozen' : 'Active');
      }
      if (copy) copy.textContent = frozen
        ? 'Frozen. Every agent payment on this card is declined.'
        : 'Freeze instantly to block every agent payment.';
    });
  }

  /* ---------- the card face takes its colour from two custom properties ---------- */
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

  /* ---------- the network picker ---------- */
  const picker = $('[data-network-picker]');
  if (picker) {
    const toggle = $('[data-network-toggle]', picker);
    const netMenu = $('[data-network-menu]', picker);
    const current = $('[data-network-current]', picker);
    const onCard = $('[data-card-network]');
    const tick = $('[data-network-tick]', picker);

    const setOpen = (open) => {
      netMenu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      const chev = toggle.querySelector('svg:last-of-type');
      if (chev) chev.classList.toggle('rotate-180', open);
    };
    setOpen(false);

    toggle?.addEventListener('click', () => setOpen(netMenu.hidden));
    document.addEventListener('mousedown', (e) => {
      if (!picker.contains(e.target)) setOpen(false);
    });

    $$('[data-network-option]', netMenu).forEach((opt) => {
      opt.addEventListener('click', () => {
        const name = opt.dataset.networkName || '';
        const mark = opt.querySelector('svg');
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
        $$('[data-network-option]', netMenu).forEach((other) => {
          const on = other === opt;
          other.setAttribute('aria-checked', String(on));
          other.classList.toggle('bg-canvas/[0.04]', on);
        });
        if (tick) opt.appendChild(tick);
        setOpen(false);
      });
    });
  }

  /* ---------- platform tabs ---------- */
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

  /* ---------- faq ---------- */
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

  /* ---------- terms and privacy dialogs ---------- */
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
      const p = $('[data-legal-panel="' + open.dataset.legal + '"]');
      if (p) {
        p.hidden = false;
        document.body.style.overflow = 'hidden';
        $('[role="dialog"]', p)?.focus();
      }
      return;
    }
    if (e.target.closest('[data-legal-close]')) closeLegal();
  });

  /* ---------- the terms gate ---------- */
  const gate = $('[data-terms-gate]');
  const blocked = $('[data-terms-blocked]');
  if (gate && blocked) {
    const KEY = 'payence-terms';
    let accepted = false;
    try { accepted = sessionStorage.getItem(KEY) === 'accepted'; } catch (_) {}

    const show = (which) => {
      gate.hidden = which !== 'gate';
      blocked.hidden = which !== 'blocked';
      document.body.style.overflow = which === 'none' ? '' : 'hidden';
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
      try { sessionStorage.setItem(KEY, 'accepted'); } catch (_) {}
      show('none');
    });
    $('[data-terms-decline]', gate)?.addEventListener('click', () => show('blocked'));
    $('[data-terms-print]', gate)?.addEventListener('click', () => window.print());
    $('[data-terms-review]', blocked)?.addEventListener('click', () => show('gate'));

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeLegal(); return; }
      if (e.key !== 'Tab' || gate.hidden) return;
      const f = $$('button, [href], input, [tabindex]:not([tabindex="-1"])', gate);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- the freeze switch on the console further down ---------- */
  const consoleFreeze = $$('button').find(
    (b) => !b.hasAttribute('data-freeze') && /^(Freeze|Unfreeze) card$/.test((b.textContent || '').trim())
  );
  if (consoleFreeze) {
    consoleFreeze.addEventListener('click', () => {
      consoleFreeze.textContent = /Unfreeze/.test(consoleFreeze.textContent || '')
        ? 'Freeze card' : 'Unfreeze card';
    });
  }

  /* ---------- the headline arrives a word at a time ---------- */
  const words = $$('[data-hero-word]');
  if (words.length && !still) {
    words.forEach((w, i) => {
      w.animate(
        [{ opacity: 0, transform: 'translateY(0.42em)' }, { opacity: 1, transform: 'none' }],
        { duration: 660, delay: 100 + i * 75, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'backwards' }
      );
    });
  }

  /* ---------- figures count to their value ---------- */
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

  /* ---------- the spend bars grow into place ---------- */
  const bars = $$('[data-spend-bar]');
  if (bars.length && !still) {
    bars.forEach((b) => { b.style.height = '0%'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        $$('[data-spend-bar]', entry.target).forEach((b, i) => {
          b.style.height = b.dataset.spendBar + '%';
          b.animate([{ height: '0%' }, { height: b.dataset.spendBar + '%' }],
            { duration: 700, delay: i * 70, easing: 'cubic-bezier(.22,.65,.3,1)' });
        });
      });
    }, { threshold: 0.3 });
    bars.forEach((b) => { if (b.parentElement) io.observe(b.parentElement); });
  }

  /* ---------- the cookie notice, and the card it remembers ---------- */
  const notice = $('[data-cookie-notice]');
  const CONSENT_KEY = 'payence-consent';
  const DESIGN_KEY = 'payence-card';

  const consent = () => {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  };
  const saveDesign = () => {
    if (consent() !== 'allowed') return;
    const name = $('[data-card-name]')?.value || '';
    const swatch = $$('[data-card-theme]').find((s) => s.getAttribute('aria-pressed') === 'true');
    const opt = $$('[data-network-option]').find((o) => o.getAttribute('aria-checked') === 'true');
    try {
      localStorage.setItem(DESIGN_KEY, JSON.stringify({
        holder: name,
        theme: swatch?.dataset.cardTheme,
        network: opt?.dataset.networkOption,
      }));
    } catch (_) {}
  };

  if (notice) {
    notice.hidden = consent() !== null;
    const answer = (v) => {
      try {
        localStorage.setItem(CONSENT_KEY, v);
        if (v === 'declined') localStorage.removeItem(DESIGN_KEY);
      } catch (_) {}
      notice.hidden = true;
      if (v === 'allowed') saveDesign();
    };
    $('[data-cookie-allow]', notice)?.addEventListener('click', () => answer('allowed'));
    $('[data-cookie-decline]', notice)?.addEventListener('click', () => answer('declined'));
  }

  /* the design is restored by replaying the clicks the visitor made */
  if (consent() === 'allowed') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null'); } catch (_) {}
    if (saved) {
      const nameInput = $('[data-card-name]');
      if (nameInput && typeof saved.holder === 'string') nameInput.value = saved.holder;
      if (saved.theme) $('[data-card-theme="' + saved.theme + '"]')?.click();
      if (saved.network) {
        const opt = $('[data-network-option="' + saved.network + '"]');
        if (opt) { opt.click(); $('[data-network-menu]').hidden = true; }
      }
    }
  }

  ['[data-card-name]', '[data-card-theme]', '[data-network-option]'].forEach((sel) => {
    $$(sel).forEach((el) => {
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'click', () => setTimeout(saveDesign, 0));
    });
  });

  /* ---------- the remaining budget ticks the way a live figure would ---------- */
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

HEAD = """<meta charset="utf-8">
<title>Payence Payment Rail</title>
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

    # The charset meta is first on purpose: a host that serves the file without
    # one (python -m http.server, or a file:// open) otherwise reads it as
    # Latin-1 and every dash and non-breaking space turns to mojibake.
    target.write_text(f"{HEAD}\n<style>\n{css}\n</style>\n\n{body}\n\n<script>\n{VANILLA}\n</script>\n")
    print(f"wrote {target} ({target.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
