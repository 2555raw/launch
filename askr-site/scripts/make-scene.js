/* Draws public/art/scene.svg: a blue sky with clouds over a green field with
 * flowers. Deterministic (seeded), so the file is reproducible. Run with
 * `npm run art` after changing anything here. */
const fs = require('fs');
const path = require('path');

const W = 1600, H = 1000;
let seed = 20260924;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const f1 = (n) => n.toFixed(1);

const parts = [];
/* sky */
parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
/* sun */
parts.push(`<circle cx="1240" cy="190" r="150" fill="url(#sunGlow)"/><circle cx="1240" cy="190" r="62" fill="#FFF4B8"/>`);
/* clouds: puffs of ellipses */
function cloud(x, y, s, o) {
  const puffs = [];
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const px = (i - n / 2) * 42 + rnd() * 20;
    const py = -Math.sin((i / (n - 1)) * Math.PI) * 30 + rnd() * 8;
    const r = 34 + rnd() * 26;
    puffs.push(`<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(r * 1.25)}" ry="${f1(r)}"/>`);
  }
  puffs.push(`<rect x="${f1(-n * 21)}" y="-4" width="${f1(n * 42)}" height="34" rx="17"/>`);
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}">${puffs.join('')}</g>`;
}
const clouds = [[230, 170, 1.15, .95], [560, 110, .8, .9], [820, 250, 1, .93], [1080, 120, .7, .88], [1420, 330, .9, .9], [400, 330, .65, .8], [1250, 420, .55, .75], [700, 420, .5, .7]];
for (const [x, y, s, o] of clouds) parts.push(cloud(x, y, s, o));
/* far haze at the horizon */
parts.push(`<rect y="520" width="${W}" height="140" fill="url(#haze)"/>`);
/* hills, back to front */
parts.push(`<path d="M0 640 C 300 560, 600 700, 900 620 S 1400 560, 1600 630 L1600 1000 L0 1000Z" fill="#8FD46A"/>`);
parts.push(`<path d="M0 720 C 250 660, 550 780, 850 700 S 1350 660, 1600 740 L1600 1000 L0 1000Z" fill="#6CC152"/>`);
parts.push(`<path d="M0 810 C 300 760, 600 860, 950 790 S 1400 760, 1600 830 L1600 1000 L0 1000Z" fill="url(#grass)"/>`);
/* grass blades on the front hill */
for (let i = 0; i < 260; i++) {
  const x = rnd() * W, y = 800 + rnd() * 200, h = 8 + rnd() * 16;
  parts.push(`<path d="M${f1(x)} ${f1(y)} q ${f1(rnd() * 8 - 4)} ${f1(-h / 2)} ${f1(rnd() * 6 - 3)} ${f1(-h)}" stroke="#3E8F35" stroke-width="1.6" fill="none" opacity=".7"/>`);
}
/* flowers: small far, big near */
const colors = ['#FFFFFF', '#FFD84A', '#FF8FB1', '#C7A6FF', '#FFB46B', '#FF6B6B', '#FFF1A8'];
function flower(x, y, r, c) {
  const petals = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    petals.push(`<circle cx="${f1(Math.cos(a) * r * .9)}" cy="${f1(Math.sin(a) * r * .9)}" r="${f1(r * .62)}"/>`);
  }
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M0 0 v ${f1(r * 3.2)}" stroke="#2F7A2F" stroke-width="${f1(Math.max(1, r / 4))}"/><path d="M0 ${f1(r * 1.8)} q ${f1(r * 1.4)} ${f1(-r * .4)} ${f1(r * 1.6)} ${f1(-r * 1.2)} q ${f1(-r * 1.2)} 0 ${f1(-r * 1.6)} ${f1(r * 1.2)}z" fill="#3E9A36"/><g fill="${c}">${petals.join('')}</g><circle r="${f1(r * .45)}" fill="#F6C700"/></g>`;
}
const flowers = [];
for (let i = 0; i < 70; i++) flowers.push([rnd() * W, 640 + rnd() * 70, 3 + rnd() * 2.5]);
for (let i = 0; i < 90; i++) flowers.push([rnd() * W, 720 + rnd() * 80, 4.5 + rnd() * 3]);
for (let i = 0; i < 110; i++) flowers.push([rnd() * W, 815 + rnd() * 185, 6 + rnd() * 6]);
flowers.sort((a, b) => a[1] - b[1]);
for (const [x, y, r] of flowers) parts.push(flower(x, y, r, colors[Math.floor(rnd() * colors.length)]));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D7BEA"/><stop offset=".45" stop-color="#5FB0F5"/><stop offset=".68" stop-color="#BDE6FF"/></linearGradient>
<radialGradient id="sunGlow"><stop offset="0" stop-color="#FFF6C4" stop-opacity=".95"/><stop offset=".5" stop-color="#FFF0A0" stop-opacity=".35"/><stop offset="1" stop-color="#FFF0A0" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8F6FF" stop-opacity="0"/><stop offset="1" stop-color="#E8F6FF" stop-opacity=".9"/></linearGradient>
<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5DB747"/><stop offset="1" stop-color="#2F8A31"/></linearGradient>
</defs>
${parts.join('\n')}
</svg>
`;
const out = path.join(__dirname, '..', 'public', 'art', 'scene.svg');
fs.writeFileSync(out, svg);
console.log(`wrote ${out} (${(svg.length / 1024).toFixed(0)} KB, ${flowers.length} flowers)`);
