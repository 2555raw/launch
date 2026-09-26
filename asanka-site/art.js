/* Asanka — dish illustrations.
   Every plate on the page is drawn here as a top-down (flat-lay) SVG, so the site
   ships without photos. Each call takes a unique id prefix for its gradients and a
   seed, so two plates of the same dish never share gradient ids and the rice grains
   land in the same place on every load. */

window.AsankaArt = (() => {
  'use strict';

  /* small deterministic RNG (mulberry32) */
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const f = (n) => Math.round(n * 10) / 10;

  /* a point inside a circle of radius r around (cx, cy) */
  const inCircle = (rand, cx, cy, r) => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
  };

  const svg = (body, defs, label) =>
    `<svg viewBox="0 0 200 200" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;

  const radial = (id, stops, cx = '.4', cy = '.36', r = '.7') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
      .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;

  const shadow = (r = 88) => `<circle cx="104" cy="108" r="${r}" fill="#2A1A12" opacity=".14"/>`;

  /* ---------- pieces ---------- */

  const fufuBall = (p, x, y, r) => `
    <ellipse cx="${x + 3}" cy="${y + 6}" rx="${r}" ry="${r * .9}" fill="#000" opacity=".18"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${p}-ball)"/>
    <ellipse cx="${f(x - r * .32)}" cy="${f(y - r * .38)}" rx="${f(r * .34)}" ry="${f(r * .2)}" fill="#fff" opacity=".7" transform="rotate(-28 ${f(x - r * .32)} ${f(y - r * .38)})"/>`;

  const meat = (x, y, w, h, rot, c = '#6E3A22') => `
    <g transform="rotate(${rot} ${x} ${y})">
      <rect x="${x - w / 2 + 1.5}" y="${y - h / 2 + 2.5}" width="${w}" height="${h}" rx="${h * .42}" fill="#000" opacity=".2"/>
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h * .42}" fill="${c}"/>
      <rect x="${x - w / 2 + 2}" y="${y - h / 2 + 1.6}" width="${w * .55}" height="${h * .28}" rx="${h * .14}" fill="#fff" opacity=".16"/>
    </g>`;

  const chili = (x, y, rot, c = '#C8261B') => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M0 0 C 6 -3 16 -2 22 3 C 16 4 7 5 0 3 Z" fill="${c}"/>
      <path d="M2 0.6 C 8 -1.4 14 -1 18 1.2" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M0 1.5 C -3 1 -5 -1 -6 -3" stroke="#3D6B2E" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`;

  const leaf = (x, y, rot, s = 1, c = '#3F7A3A') => `
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="M0 0 C 6 -8 18 -8 24 0 C 18 8 6 8 0 0 Z" fill="${c}"/>
      <path d="M1 0 H 21" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>
    </g>`;

  const plantain = (p, x, y, rot, rx = 13, ry = 8) => `
    <g transform="rotate(${rot} ${x} ${y})">
      <ellipse cx="${x + 1.5}" cy="${y + 2.5}" rx="${rx}" ry="${ry}" fill="#000" opacity=".18"/>
      <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#8A4A12"/>
      <ellipse cx="${x}" cy="${y}" rx="${rx - 1.8}" ry="${ry - 1.8}" fill="url(#${p}-plantain)"/>
      <ellipse cx="${x - rx * .25}" cy="${y - ry * .35}" rx="${rx * .4}" ry="${ry * .22}" fill="#fff" opacity=".3"/>
    </g>`;

  const tomatoSlice = (x, y, r) => `
    <circle cx="${x + 1}" cy="${y + 2}" r="${r}" fill="#000" opacity=".15"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#D2311F"/>
    <circle cx="${x}" cy="${y}" r="${r - 2}" fill="#E8503A"/>
    ${[0, 72, 144, 216, 288].map((a) => {
      const rad = (a * Math.PI) / 180;
      return `<ellipse cx="${f(x + Math.cos(rad) * r * .5)}" cy="${f(y + Math.sin(rad) * r * .5)}" rx="${f(r * .22)}" ry="${f(r * .14)}" fill="#F7C95A" opacity=".85" transform="rotate(${a} ${f(x + Math.cos(rad) * r * .5)} ${f(y + Math.sin(rad) * r * .5)})"/>`;
    }).join('')}`;

  const onionRing = (x, y, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#F4E6F0" stroke-width="2.4"/><circle cx="${x}" cy="${y}" r="${r - 3.5}" fill="none" stroke="#E9CFE2" stroke-width="1.6"/>`;

  const plantainDefs = (p) => radial(`${p}-plantain`, [[0, '#FAD27A'], [.6, '#EFA83A'], [1, '#C9731D']]);

  /* ---------- fufu bowl ---------- */

  const SOUPS = {
    light:     { a: '#F07A3E', b: '#C8401C', oil: '#FFC36B', label: 'light soup' },
    groundnut: { a: '#C9793A', b: '#8E4A1E', oil: '#F2B35E', label: 'sopa de cacahuete' },
    palmnut:   { a: '#B2361A', b: '#6E1A0C', oil: '#F08A3A', label: 'sopa de nuez de palma' },
    egusi:     { a: '#D9A441', b: '#A36F1E', oil: '#FFE08A', label: 'egusi' },
  };

  function fufu(p, seed, soupKey = 'light', { balls = 1, fish = false } = {}) {
    const rand = rng(seed);
    const s = SOUPS[soupKey];
    const defs =
      radial(`${p}-rim`, [[0, '#B8683F'], [.75, '#8C4526'], [1, '#6A3119']], '.35', '.3', '.8') +
      radial(`${p}-soup`, [[0, s.a], [1, s.b]], '.42', '.38', '.72') +
      radial(`${p}-ball`, [[0, '#FFFDF6'], [.55, '#F1E6CC'], [1, '#D6C29A']], '.36', '.3', '.75') +
      plantainDefs(p);

    let body = shadow();
    body += `<circle cx="100" cy="100" r="88" fill="url(#${p}-rim)"/>`;
    body += `<circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`;
    body += `<circle cx="100" cy="100" r="75" fill="#4C2213"/>`;
    body += `<circle cx="100" cy="101" r="72" fill="url(#${p}-soup)"/>`;

    // oil beads floating on the surface
    for (let i = 0; i < 26; i++) {
      const [x, y] = inCircle(rand, 100, 101, 64);
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + rand() * 3.2)}" fill="${s.oil}" opacity="${f(.35 + rand() * .35)}"/>`;
    }

    if (soupKey === 'egusi') {
      // ground melon seed curds and spinach
      for (let i = 0; i < 40; i++) {
        const [x, y] = inCircle(rand, 100, 101, 62);
        body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + rand() * 2.6)}" fill="#F6E3A6" opacity=".9"/>`;
      }
      for (let i = 0; i < 9; i++) {
        const [x, y] = inCircle(rand, 100, 101, 56);
        body += leaf(f(x), f(y), Math.round(rand() * 360), .7 + rand() * .3, i % 2 ? '#2F6B2F' : '#3E7F35');
      }
    }

    // meat and, for palm nut, smoked fish
    const pieces = soupKey === 'egusi' ? 3 : 4;
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * Math.PI * 2 + .6;
      const x = 100 + Math.cos(a) * 44, y = 104 + Math.sin(a) * 42;
      body += meat(f(x), f(y), 20 + rand() * 6, 13 + rand() * 3, Math.round(rand() * 180), i % 2 ? '#6E3A22' : '#7E4428');
    }
    if (fish) {
      body += `<g transform="rotate(-24 128 128)"><ellipse cx="130" cy="130" rx="20" ry="9" fill="#000" opacity=".2"/><ellipse cx="128" cy="127" rx="20" ry="9" fill="#9A5A2A"/><path d="M112 127 h32" stroke="#5C3014" stroke-width="1.2" stroke-dasharray="3 3"/><ellipse cx="124" cy="124" rx="9" ry="2.4" fill="#fff" opacity=".2"/></g>`;
    }

    body += chili(116, 52, 18);
    if (balls === 1) body += fufuBall(p, 90, 94, 33);
    else { body += fufuBall(p, 78, 96, 26); body += fufuBall(p, 116, 88, 22); }
    if (soupKey !== 'egusi') body += leaf(64, 132, -30, .7, '#3F7A3A');

    return svg(body, defs, `Fufu con ${s.label}`);
  }

  /* ---------- jollof plate ---------- */

  function jollof(p, seed, protein = 'chicken') {
    const rand = rng(seed);
    const defs =
      radial(`${p}-plate`, [[0, '#FFFFFF'], [.8, '#F6F0E6'], [1, '#E4D9C6']], '.4', '.35', '.75') +
      radial(`${p}-rice`, [[0, '#F3793F'], [.7, '#DA4F24'], [1, '#B8361A']], '.42', '.4', '.7') +
      radial(`${p}-meat`, [[0, '#B8612C'], [.6, '#8A3E17'], [1, '#5E260C']], '.35', '.3', '.8') +
      plantainDefs(p);

    let body = shadow();
    body += `<circle cx="100" cy="100" r="88" fill="url(#${p}-plate)"/>`;
    body += `<circle cx="100" cy="100" r="70" fill="none" stroke="#2A1A12" stroke-opacity=".06" stroke-width="1.5"/>`;

    // the rice mound: a soft blob, then a few hundred grains on top
    body += `<path d="M52 104 C 48 74 70 56 96 58 C 124 60 140 78 138 104 C 136 132 116 148 92 146 C 66 144 55 128 52 104 Z" fill="url(#${p}-rice)"/>`;
    const grain = ['#F59A5E', '#EE7440', '#D4491F', '#F8B27A', '#C23D1B'];
    for (let i = 0; i < 230; i++) {
      const [x, y] = inCircle(rand, 95, 102, 40);
      const c = grain[Math.floor(rand() * grain.length)];
      body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3.1" ry="1.25" fill="${c}" transform="rotate(${Math.round(rand() * 180)} ${f(x)} ${f(y)})"/>`;
    }
    // bay leaf, pepper flecks and a scatter of green onion
    for (let i = 0; i < 14; i++) {
      const [x, y] = inCircle(rand, 95, 102, 36);
      body += `<rect x="${f(x)}" y="${f(y)}" width="2.6" height="2.6" rx=".6" fill="${i % 3 ? '#4E8A3A' : '#8E1C12'}"/>`;
    }

    // protein
    if (protein === 'chicken') {
      body += `<g transform="rotate(-32 140 72)">
        <ellipse cx="142" cy="76" rx="26" ry="18" fill="#000" opacity=".2"/>
        <path d="M112 72 C 112 58 128 52 142 54 C 160 56 168 66 166 76 C 164 88 150 92 138 90 C 126 88 112 84 112 72 Z" fill="url(#${p}-meat)"/>
        <rect x="100" y="66" width="16" height="7" rx="3.5" fill="#F4E9D8"/>
        <circle cx="99" cy="66" r="4.2" fill="#F4E9D8"/><circle cx="99" cy="73" r="4.2" fill="#F4E9D8"/>
        <path d="M126 62 C 138 58 152 60 158 68" stroke="#FFD08A" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M130 80 l 6 -10 M 142 84 l 6 -12 M 154 82 l 4 -9" stroke="#3E1605" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
      </g>`;
    } else if (protein === 'beef') {
      // suya skewer: beef strips with ground peanut spice
      body += `<g transform="rotate(-38 140 70)">
        <rect x="104" y="68" width="74" height="3" rx="1.5" fill="#C9A06A"/>
        ${[116, 134, 152, 168].map((x, i) => `<rect x="${x - 8 + 1.5}" y="${60 + 3}" width="17" height="19" rx="5" fill="#000" opacity=".2"/><rect x="${x - 8}" y="60" width="17" height="19" rx="5" fill="${i % 2 ? '#7A2E12' : '#8E3A18'}"/>`).join('')}
      </g>`;
      for (let i = 0; i < 40; i++) {
        const [x, y] = inCircle(rand, 142, 70, 20);
        body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.7 + rand() * 1.1)}" fill="${i % 2 ? '#E0A45A' : '#B8321A'}" opacity=".85"/>`;
      }
    } else if (protein === 'fish') {
      body += `<g transform="rotate(-28 140 72)">
        <ellipse cx="144" cy="78" rx="32" ry="15" fill="#000" opacity=".2"/>
        <path d="M110 72 C 122 56 158 56 170 72 C 158 88 122 88 110 72 Z" fill="url(#${p}-meat)"/>
        <path d="M170 72 L 184 60 L 182 72 L 184 84 Z" fill="#7A3212"/>
        <circle cx="120" cy="69" r="2.6" fill="#F4E9D8"/><circle cx="120" cy="69" r="1.2" fill="#2A1A12"/>
        ${[132, 142, 152, 162].map((x) => `<path d="M${x} 62 l -5 20" stroke="#3E1605" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>`).join('')}
        <path d="M126 64 C 138 60 152 60 162 64" stroke="#FFD08A" stroke-opacity=".4" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      </g>`;
      body += `<circle cx="160" cy="104" r="8" fill="#C7D94A"/><circle cx="160" cy="104" r="6" fill="#E3EE8E"/><path d="M154 104 h12 M160 98 v12 M156 100 l8 8 M164 100 l-8 8" stroke="#C7D94A" stroke-width=".8"/>`;
    } else {
      // vegetable: black-eyed beans and peppers
      for (let i = 0; i < 18; i++) {
        const [x, y] = inCircle(rand, 142, 72, 16);
        body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="2.8" fill="#EFE3CC" transform="rotate(${Math.round(rand() * 180)} ${f(x)} ${f(y)})"/><circle cx="${f(x)}" cy="${f(y)}" r=".9" fill="#2A1A12"/>`;
      }
      body += `<path d="M126 54 q 10 -6 18 2 q -8 10 -18 -2 z" fill="#3E8A3A"/><path d="M150 88 q 10 -6 18 2 q -8 10 -18 -2 z" fill="#E8B52E"/>`;
    }

    // dodo (fried plantain)
    body += plantain(p, 142, 128, 20) + plantain(p, 126, 146, -10, 12, 7.5) + plantain(p, 152, 146, 40, 11, 7);

    // salad: lettuce, tomato, onion
    body += leaf(46, 64, -20, 1.2, '#5C9B45') + leaf(58, 50, 30, 1.1, '#4C8A3A') + leaf(38, 82, 60, 1, '#6DAA52');
    body += tomatoSlice(66, 72, 10);
    body += onionRing(50, 96, 8);

    const who = { chicken: 'pollo', beef: 'ternera suya', fish: 'tilapia', veg: 'verduras' }[protein];
    return svg(body, defs, `Arroz jollof con ${who}`);
  }

  /* ---------- sides ---------- */

  function kelewele(p, seed) {
    const rand = rng(seed);
    const defs = radial(`${p}-bowl`, [[0, '#FFFFFF'], [.85, '#F3ECE0'], [1, '#DCCFB9']]);
    let body = shadow(80) + `<circle cx="100" cy="100" r="80" fill="url(#${p}-bowl)"/><circle cx="100" cy="100" r="64" fill="#EFE5D3"/>`;
    const cols = ['#C8641E', '#B2521A', '#D9772A', '#A34414'];
    for (let i = 0; i < 34; i++) {
      const [x, y] = inCircle(rand, 100, 100, 50);
      const w = 12 + rand() * 6;
      body += `<g transform="rotate(${Math.round(rand() * 90)} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2 + 1)}" y="${f(y - w / 2 + 2)}" width="${f(w)}" height="${f(w)}" rx="3.5" fill="#000" opacity=".16"/><rect x="${f(x - w / 2)}" y="${f(y - w / 2)}" width="${f(w)}" height="${f(w)}" rx="3.5" fill="${cols[i % 4]}"/><rect x="${f(x - w / 2 + 2)}" y="${f(y - w / 2 + 2)}" width="${f(w * .5)}" height="${f(w * .22)}" rx="1.2" fill="#FFD08A" opacity=".45"/></g>`;
    }
    for (let i = 0; i < 12; i++) {
      const [x, y] = inCircle(rand, 100, 100, 58);
      body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.4" ry="3" fill="#E9C58C" stroke="#B48A4E" stroke-width=".8"/>`;
    }
    return svg(body, defs, 'Kelewele');
  }

  function dodo(p, seed) {
    const rand = rng(seed);
    const defs = radial(`${p}-plate`, [[0, '#FFFFFF'], [.85, '#F6F0E6'], [1, '#E4D9C6']]) + plantainDefs(p);
    let body = shadow(84) + `<circle cx="100" cy="100" r="84" fill="url(#${p}-plate)"/><circle cx="100" cy="100" r="66" fill="none" stroke="#2A1A12" stroke-opacity=".06" stroke-width="1.5"/>`;
    const spots = [[74, 72], [108, 64], [138, 84], [66, 106], [100, 100], [134, 118], [80, 136], [114, 138]];
    spots.forEach(([x, y]) => { body += plantain(p, x, y, Math.round(rand() * 180 - 90), 15, 9.5); });
    return svg(body, defs, 'Dodo, plátano macho frito');
  }

  function shito(p, seed) {
    const rand = rng(seed);
    const defs = radial(`${p}-jar`, [[0, '#FFFFFF'], [.8, '#EEE6D8'], [1, '#CFC0A6']]) +
      radial(`${p}-sauce`, [[0, '#7A2A12'], [.7, '#401108'], [1, '#2A0A04']]);
    let body = shadow(72) + `<circle cx="100" cy="100" r="72" fill="url(#${p}-jar)"/><circle cx="100" cy="100" r="58" fill="url(#${p}-sauce)"/>`;
    for (let i = 0; i < 40; i++) {
      const [x, y] = inCircle(rand, 100, 100, 50);
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8 + rand() * 2.2)}" fill="${i % 3 ? '#C24A1A' : '#E8912E'}" opacity=".7"/>`;
    }
    body += `<ellipse cx="84" cy="80" rx="18" ry="7" fill="#fff" opacity=".16" transform="rotate(-30 84 80)"/>`;
    body += chili(118, 146, -20) + chili(60, 150, -60, '#D23A1E');
    return svg(body, defs, 'Shito, salsa picante de la casa');
  }

  function fufuSide(p) {
    const defs = radial(`${p}-bowl`, [[0, '#B8683F'], [.75, '#8C4526'], [1, '#6A3119']], '.35', '.3', '.8') +
      radial(`${p}-ball`, [[0, '#FFFDF6'], [.55, '#F1E6CC'], [1, '#D6C29A']], '.36', '.3', '.75');
    let body = shadow(80) + `<circle cx="100" cy="100" r="80" fill="url(#${p}-bowl)"/><circle cx="100" cy="100" r="66" fill="#4C2213"/><circle cx="100" cy="101" r="63" fill="#E8DCC0"/>`;
    body += fufuBall(p, 100, 98, 40);
    return svg(body, defs, 'Porción extra de fufu');
  }

  /* ---------- drinks ---------- */

  function drink(p, seed, kind = 'sobolo') {
    const rand = rng(seed);
    const k = kind === 'sobolo'
      ? { a: '#A3183F', b: '#4E0A1E', label: 'Sobolo, bebida de hibisco' }
      : { a: '#F2B84B', b: '#B8741C', label: 'Ginger beer casera' };
    const defs = radial(`${p}-glass`, [[0, '#FFFFFF'], [.85, '#EEF2F2'], [1, '#C9D2D2']]) +
      radial(`${p}-liq`, [[0, k.a], [1, k.b]], '.4', '.36', '.75');
    let body = shadow(70) + `<circle cx="100" cy="100" r="70" fill="url(#${p}-glass)"/><circle cx="100" cy="100" r="60" fill="url(#${p}-liq)"/>`;
    [[82, 84, 16], [116, 90, -12], [96, 118, 30]].forEach(([x, y, r]) => {
      body += `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="#fff" opacity=".28" transform="rotate(${r} ${x} ${y})"/><rect x="${x - 8}" y="${y - 8}" width="9" height="4" rx="2" fill="#fff" opacity=".45" transform="rotate(${r} ${x} ${y})"/>`;
    });
    for (let i = 0; i < 16; i++) {
      const [x, y] = inCircle(rand, 100, 100, 54);
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8 + rand() * 1.4)}" fill="#fff" opacity=".45"/>`;
    }
    if (kind === 'sobolo') body += leaf(118, 118, -40, 1.1, '#3F8A45') + leaf(124, 128, 10, .9, '#4FA052');
    else body += `<circle cx="128" cy="124" r="13" fill="#E8D39A" stroke="#C9A55A" stroke-width="2"/><circle cx="128" cy="124" r="7" fill="none" stroke="#D8BC76" stroke-width="1"/>`;
    body += `<rect x="96" y="30" width="8" height="70" rx="4" fill="#fff" opacity=".85" transform="rotate(35 100 65)"/>`;
    return svg(body, defs, k.label);
  }

  /* ---------- party tray ---------- */

  function tray(p, seed) {
    const rand = rng(seed);
    const defs = radial(`${p}-rice`, [[0, '#F3793F'], [.7, '#DA4F24'], [1, '#B8361A']], '.42', '.4', '.7') + plantainDefs(p);
    let body = `<rect x="18" y="30" width="172" height="150" rx="16" fill="#2A1A12" opacity=".14"/>`;
    body += `<rect x="12" y="22" width="176" height="152" rx="16" fill="#D8D2C8"/><rect x="20" y="30" width="160" height="136" rx="10" fill="url(#${p}-rice)"/>`;
    const grain = ['#F59A5E', '#EE7440', '#D4491F', '#F8B27A', '#C23D1B'];
    for (let i = 0; i < 300; i++) {
      const x = 24 + rand() * 152, y = 34 + rand() * 128;
      body += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3" ry="1.2" fill="${grain[i % 5]}" transform="rotate(${Math.round(rand() * 180)} ${f(x)} ${f(y)})"/>`;
    }
    body += plantain(p, 56, 60, 10) + plantain(p, 150, 142, -20) + plantain(p, 140, 58, 40) + plantain(p, 58, 140, -40);
    body += leaf(92, 92, 20, 1.1, '#4C8A3A') + leaf(104, 104, 200, 1, '#5C9B45');
    return svg(body, defs, 'Bandeja de jollof para fiestas');
  }

  return { fufu, jollof, kelewele, dodo, shito, fufuSide, drink, tray };
})();
