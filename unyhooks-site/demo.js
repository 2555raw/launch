/* UnyHooks — the demo window on the landing page.

   Plays back the builder: a request is typed, the reply says what was
   understood, the contract appears line by line, then compile, deploy and
   pool tick off. The request is read by the builder's own reader and the
   contract is the builder's real output for it; the addresses in the deploy
   and pool steps are illustrations. Runs only while the window is on screen;
   with reduced motion it shows the finished first scene and stays still. */

(() => {
  'use strict';

  const B = window.UnyBuilder;
  const win = document.getElementById('demo-window');
  if (!B || !win) return;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SAMPLE = '0x7a3f9C1e5D4b2A8f6E0c3B9d1A7e5F2c4D8b20C0';
  const SCENES = [
    { text: `Send 1% of every swap to my wallet ${SAMPLE.slice(0, 6)}…${SAMPLE.slice(-4)}`, extra: { recipient: SAMPLE }, key: /FEE_BPS =|poolManager\.take/, pair: 'TOKEN/ETH' },
    { text: 'Raise the fee when the market gets volatile. Floor 0.05%, ceiling 1%.', extra: {}, key: /MIN_FEE =|MAX_FEE =/, pair: 'TOKEN/USDG' },
    { text: 'For the first hour, cap every buy at 0.5 ETH, one buy per wallet every 30 seconds.', extra: { token: SAMPLE }, key: /MAX_BUY =|COOLDOWN =/, pair: 'TOKEN/ETH' }
  ];

  // The part of the contract worth watching: from the contract line, about 18 lines.
  const excerpt = (source, keyRe) => {
    const lines = source.split('\n');
    const start = lines.findIndex((l) => /^contract /.test(l));
    return lines.slice(start, start + 18).map((l) => ({ html: B.highlight(l) || ' ', key: keyRe.test(l) }));
  };

  const prepare = (scene) => {
    const got = B.understand(scene.text);
    const settings = { ...got.settings, ...scene.extra };
    const hook = B.generate(got.recipe, settings);
    const hex = '0123456789abcdef';
    let rand = '0x';
    for (let i = 0; i < 36; i++) rand += hex[Math.floor(Math.random() * 16)];
    const addr = rand + hook.flags.toString(16).padStart(4, '0');
    return {
      title: B.RECIPES[got.recipe].title.toLowerCase(),
      heard: got.heard.filter((h) => !/defaults/.test(h)),
      file: hook.file,
      lines: excerpt(hook.source, scene.key),
      addr: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
      pair: scene.pair
    };
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let visible = false;
  let run = 0;

  const reset = () => {
    $('dm-typed').textContent = '';
    $('dm-reply').classList.add('is-hidden');
    $('dm-reply').innerHTML = '&nbsp;';
    $('dm-code').innerHTML = '';
    $('dm-status').textContent = 'Writing…';
    $('dm-status').className = 'dm-status';
    win.querySelectorAll('[data-step]').forEach((li) => { li.className = ''; li.querySelector('em').textContent = ''; });
  };

  const step = (name, state, note = '') => {
    const li = win.querySelector(`[data-step="${name}"]`);
    li.className = state ? `is-${state}` : '';
    li.querySelector('em').textContent = note;
  };

  const showFinished = (s) => {
    $('dm-typed').textContent = SCENES[0].text;
    const r = $('dm-reply');
    r.classList.remove('is-hidden');
    r.innerHTML = `Got it: a <b>${esc(s.title)}</b> hook. ${s.heard.map(esc).join(', ')}.`;
    $('dm-file').textContent = s.file;
    $('dm-code').innerHTML = s.lines.map((l) => `<span class="ln${l.key ? ' is-key' : ''}">${l.html}</span>`).join('');
    $('dm-status').textContent = 'Ready to deploy';
    $('dm-status').className = 'dm-status is-ok';
    step('compile', 'done', '0.8.26');
    step('deploy', 'done', s.addr);
    step('pool', 'done', `${s.pair} live`);
  };

  // Each call starts a new run; an older run notices and stops at its next step.
  const play = async () => {
    const me = ++run;
    const alive = () => me === run && visible;
    let i = 0;
    while (alive()) {
      const scene = SCENES[i % SCENES.length];
      const s = prepare(scene);
      reset();
      $('dm-file').textContent = s.file;
      await sleep(500);
      for (const ch of scene.text) {
        if (!alive()) break;
        $('dm-typed').textContent += ch;
        await sleep(28 + Math.random() * 30);
      }
      await sleep(350);
      if (!alive()) break;
      const r = $('dm-reply');
      r.innerHTML = `Got it: a <b>${esc(s.title)}</b> hook. ${s.heard.map(esc).join(', ')}.`;
      r.classList.remove('is-hidden');
      await sleep(400);
      for (const l of s.lines) {
        if (!alive()) break;
        $('dm-code').insertAdjacentHTML('beforeend', `<span class="ln${l.key ? ' is-key' : ''}">${l.html}</span>`);
        await sleep(55);
      }
      $('dm-status').textContent = 'Ready to deploy';
      $('dm-status').className = 'dm-status is-ok';
      const steps = [['compile', '0.8.26', 900], ['deploy', s.addr, 1300], ['pool', `${s.pair} live`, 1000]];
      for (const [name, note, ms] of steps) {
        if (!alive()) break;
        step(name, 'busy');
        await sleep(ms);
        step(name, 'done', note);
        await sleep(200);
      }
      await sleep(2600);
      i++;
    }
  };

  if (still) { showFinished(prepare(SCENES[0])); return; }

  showFinished(prepare(SCENES[0]));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) play(); else run++;
    }, { threshold: 0.35 }).observe(win);
  }
})();
