#!/usr/bin/env node
/* ===========================================================================
   cities.js — a district map for every city the vault owns in.

   Where a city's real district boundaries are on disk (data/geo/<city>.geojson,
   see data/geo/SOURCES.md) they are drawn as they are: projected, simplified
   to a pixel, and the building placed by point-in-polygon, so its district is
   the one the boundary file says. Where no file exists the city falls back to
   a schematic: real district centres, Voronoi cells between them, and the
   panel says so.

   Writes data/cities.js (window.RENTA_CITIES) and data/cities.json.
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(root, 'data', 'buildings.json'), 'utf8'));

/* per city: the file, which property is the name, and which features to keep */
const REAL = {
  Madrid:    { file: 'madrid.geojson',    name: f => f.properties.name },
  Barcelona: { file: 'barcelona.geojson', name: f => f.properties.NOM || f.properties.NDESCR_CA || f.properties.name },
  Leipzig:   { file: 'leipzig.geojson',   name: f => f.properties.name },
  Rotterdam: { file: 'rotterdam.geojson', name: f => f.properties.name,
               keep: f => !/Botlek|Waalhaven|Hoek van Holland|Europoort|Maasvlakte|Vondelingenplaat|Rozenburg|Pernis|Spaanse Polder|Eemhaven|Nieuw-Mathenesse|Hoogvliet/i.test(f.properties.name) },
  Lisbon:    { file: 'lisbon.geojson',    name: f => f.properties.name || f.properties.NOME || f.properties.Freguesia },
  Turin:     { file: 'turin.geojson',     name: f => f.properties.name || f.properties.DENOM },
  'Kraków':  { file: 'krakow.geojson',    name: f => f.properties.name || f.properties.NAZWA },
  Terrassa:  { file: 'terrassa.geojson',  name: f => f.properties.name || f.properties.NOM }
};

/* the schematic fallback: district centres, [name, lon, lat] */
const SCHEMATIC = {
  Lisbon: { country: 'Portugal', lon: -9.148, lat: 38.728, region: null, districts: [
    ['Baixa', -9.138, 38.711], ['Chiado', -9.142, 38.7105], ['Bica', -9.1465, 38.7095], ['Bairro Alto', -9.146, 38.7145],
    ['Alfama', -9.130, 38.712], ['Graça', -9.130, 38.7185], ['Príncipe Real', -9.150, 38.7175], ['Estrela', -9.160, 38.712],
    ['Campo de Ourique', -9.166, 38.7185], ['Alcântara', -9.176, 38.705], ['Belém', -9.204, 38.698], ['Ajuda', -9.196, 38.710],
    ['Campolide', -9.163, 38.730], ['Avenidas Novas', -9.150, 38.735], ['Arroios', -9.135, 38.727], ['Areeiro', -9.134, 38.742],
    ['Alvalade', -9.145, 38.752], ['Benfica', -9.200, 38.750], ['Marvila', -9.105, 38.740], ['Parque das Nações', -9.093, 38.768],
    ['Beato', -9.112, 38.728], ['Penha de França', -9.125, 38.725]
  ]},
  Terrassa: { country: 'Spain', lon: 2.014, lat: 41.562, region: 'Catalonia', districts: [
    ['Centre', 2.011, 41.563], ["Ca n'Aurell", 2.002, 41.560], ['Sant Pere', 2.020, 41.566], ['Ègara', 2.018, 41.556],
    ['Can Palet', 2.010, 41.550], ['Sant Pere Nord', 2.020, 41.575], ['Can Boada', 1.995, 41.570], ['La Maurina', 1.996, 41.552],
    ['Torre-sana', 2.030, 41.560], ['Can Parellada', 2.040, 41.550], ['Les Fonts', 2.050, 41.540], ['Sant Llorenç', 2.005, 41.580],
    ['Vallparadís', 2.016, 41.5605], ['Roc Blanc', 2.000, 41.555], ['Segle XX', 2.023, 41.552], ['Can Jofresa', 2.020, 41.545],
    ['Montserrat', 2.028, 41.571], ['Xúquer', 2.010, 41.574]
  ]},
  Turin: { country: 'Italy', lon: 7.680, lat: 45.068, region: null, districts: [
    ['Centro', 7.685, 45.070], ['Vanchiglia', 7.700, 45.070], ['San Salvario', 7.680, 45.055], ['Crocetta', 7.665, 45.060],
    ['Aurora', 7.690, 45.085], ['Cit Turin', 7.665, 45.075], ['San Donato', 7.660, 45.085], ['Cenisia', 7.650, 45.070],
    ['Santa Rita', 7.645, 45.048], ['Lingotto', 7.665, 45.030], ['Mirafiori', 7.635, 45.030], ['Borgo Po', 7.705, 45.060],
    ['Barriera di Milano', 7.700, 45.100], ['Vallette', 7.630, 45.100], ['Nizza Millefonti', 7.675, 45.040],
    ['Madonna del Pilone', 7.720, 45.070], ['Regio Parco', 7.710, 45.090], ['Borgo San Paolo', 7.645, 45.060], ['Parella', 7.635, 45.085]
  ]},
  'Kraków': { country: 'Poland', lon: 19.950, lat: 50.058, region: null, districts: [
    ['Stare Miasto', 19.938, 50.062], ['Kazimierz', 19.945, 50.050], ['Podgórze', 19.950, 50.040], ['Krowodrza', 19.915, 50.070],
    ['Grzegórzki', 19.960, 50.062], ['Nowa Huta', 20.040, 50.075], ['Prądnik Biały', 19.930, 50.095], ['Prądnik Czerwony', 19.965, 50.085],
    ['Zwierzyniec', 19.895, 50.055], ['Dębniki', 19.915, 50.040], ['Bieżanów-Prokocim', 20.010, 50.025], ['Łagiewniki', 19.940, 50.020],
    ['Bronowice', 19.890, 50.080], ['Czyżyny', 19.995, 50.070], ['Mistrzejowice', 20.000, 50.100], ['Swoszowice', 19.930, 49.990],
    ['Podgórze Duchackie', 19.960, 50.020], ['Wzgórza Krzesławickie', 20.060, 50.100], ['Kleparz', 19.940, 50.068], ['Zabłocie', 19.958, 50.047]
  ]},
  Madrid:    { country: 'Spain',       lon: -3.700, lat: 40.425, region: null },
  Barcelona: { country: 'Spain',       lon:  2.165, lat: 41.400, region: 'Catalonia' },
  Leipzig:   { country: 'Germany',     lon: 12.375, lat: 51.340, region: null },
  Rotterdam: { country: 'Netherlands', lon:  4.485, lat: 51.918, region: null }
};

/* ------------------------------------------------------- geometry ------- */
function clipHalfPlane(poly, p, q) {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = q[0] - p[0], ny = q[1] - p[1];
  const side = pt => (pt[0] - mx) * nx + (pt[1] - my) * ny;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
const voronoi = (sites, boundary) => sites.map((p, i) => { let cell = boundary; sites.forEach((q, j) => { if (i !== j && cell.length) cell = clipHalfPlane(cell, p, q); }); return cell; });
const area = poly => Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function centroid(poly) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; const c = p[0] * q[1] - q[0] * p[1]; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; a += c; }
  return a === 0 ? poly[0] : [x / (3 * a), y / (3 * a)];
}
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
/* Douglas–Peucker in projected pixels */
function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop(); if (hi - lo < 2) continue;
    const [ax, ay] = pts[lo], [bx, by] = pts[hi], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let far = -1, fd = tol;
    for (let i = lo + 1; i < hi; i++) {
      const [cx, cy] = pts[i]; let d;
      if (len2 === 0) d = Math.hypot(cx - ax, cy - ay);
      else { let t = ((cx - ax) * dx + (cy - ay) * dy) / len2; t = t < 0 ? 0 : t > 1 ? 1 : t; d = Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy)); }
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([lo, far], [far, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const pathOf = rings => rings.map(r => 'M' + r.map(p => p.join(',')).join('L') + 'Z').join('');

/* ------------------------------------------------------- draw ----------- */
const W = 640, H = 520, PAD = 70;
const out = {};
for (const [city, c] of Object.entries(SCHEMATIC)) {
  const k = Math.cos(c.lat * Math.PI / 180);
  const proj = (lon, lat) => [(lon - c.lon) * k, -(lat - c.lat)];
  const bl = B.filter(b => b.city === city).map(b => ({ ...b, p: proj(b.lon, b.lat) }));
  const real = REAL[city] && fs.existsSync(path.join(root, 'data', 'geo', REAL[city].file));
  let districts, limitPts;

  if (real) {
    const spec = REAL[city];
    const gj = JSON.parse(fs.readFileSync(path.join(root, 'data', 'geo', spec.file), 'utf8'));
    let feats = gj.features.filter(f => f.geometry && (!spec.keep || spec.keep(f)));
    /* keep the city itself: drop anything whose centre is far from the centre */
    const rings = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(poly => poly[0]);
    feats = feats.filter(f => rings(f).some(r => { const [x, y] = proj(...r[0]); return Math.hypot(x, y) < 0.16; }));
    districts = feats.map(f => {
      const outer = rings(f).map(r => r.map(([lon, lat]) => proj(lon, lat)));
      const biggest = outer.reduce((a, b) => area(a) >= area(b) ? a : b);
      return { name: spec.name(f), rings: outer, biggest };
    });
    limitPts = districts.flatMap(d => d.rings.flat());
  } else {
    const sites = c.districts.map(([, lon, lat]) => proj(lon, lat));
    const rmax = Math.max(...sites.map(s => Math.hypot(s[0], s[1])));
    let seed = city.length * 977;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const N = 40, wob = Array.from({ length: N }, () => 0.86 + rnd() * 0.28), ring = [];
    for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; const r = rmax * 1.32 * ((wob[i] + wob[(i + 1) % N] + wob[(i + N - 1) % N]) / 3); ring.push([Math.cos(t) * r * 1.12, Math.sin(t) * r]); }
    const limit = hull(ring);
    const cells = voronoi(sites, limit);
    districts = c.districts.map(([name], i) => ({ name, rings: [cells[i]], biggest: cells[i] }));
    limitPts = limit;
  }

  /* fit the frame */
  const xs = limitPts.map(p => p[0]), ys = limitPts.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min((W - 2 * PAD) / (maxx - minx), (H - 2 * PAD) / (maxy - miny));
  const ox = (W - (maxx - minx) * s) / 2 - minx * s, oy = (H - (maxy - miny) * s) / 2 - miny * s;
  const T = p => [+(p[0] * s + ox).toFixed(1), +(p[1] * s + oy).toFixed(1)];

  const drawn = districts.map(d => {
    const rings = d.rings.map(r => simplify(r.map(T), real ? 0.9 : 0)).filter(r => r.length >= 3);
    const big = simplify(d.biggest.map(T), real ? 0.9 : 0);
    const ctr = T(centroid(d.biggest));
    return { name: d.name, d: pathOf(rings), cx: ctr[0], cy: ctr[1], area: Math.round(area(big)), own: false, _big: big };
  });
  /* place each building by the polygon it is actually in */
  const buildings = bl.map(b => {
    const p = T(b.p);
    const hit = drawn.find(d => d.rings === undefined && inside(p, d._big)) || drawn.find(d => inside(p, d._big));
    let district = b.district;
    if (hit) { hit.own = true; district = hit.name; if (hit.name !== b.district) console.error('  · ' + city + ': ' + b.name + ' is in "' + hit.name + '" (buildings.json says "' + b.district + '")'); }
    else console.error('  ✗ ' + city + ': ' + b.name + ' lands in no district');
    return { id: b.id, name: b.name, district, x: p[0], y: p[1] };
  });
  const kmPerPx = 111 / s;
  const km = kmPerPx * 100 >= 4 ? 5 : kmPerPx * 100 >= 1.5 ? 2 : 1;
  out[city] = {
    country: c.country, region: c.region, real: !!real, viewBox: `0 0 ${W} ${H}`,
    limit: real ? '' : pathOf([hull(limitPts).map(T)]),
    scaleKm: km, scalePx: Math.round(km / kmPerPx),
    districts: drawn.map(({ _big, ...d }) => d),
    buildings
  };
  console.error((real ? '  ✓ real  ' : '  ~ schema') + ' ' + city + ': ' + drawn.length + ' districts, ' + buildings.map(b => b.district).join(' / '));
}
fs.writeFileSync(path.join(root, 'data', 'cities.js'), '/* generated by scripts/cities.js — do not edit */\nwindow.RENTA_CITIES = ' + JSON.stringify(out) + ';\n');
fs.writeFileSync(path.join(root, 'data', 'cities.json'), JSON.stringify(out, null, 1) + '\n');
console.error('wrote', Object.keys(out).length, 'cities,', Math.round(fs.statSync(path.join(root, 'data', 'cities.js')).size / 1024), 'KB');
