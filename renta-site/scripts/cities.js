#!/usr/bin/env node
/* ===========================================================================
   cities.js — a schematic district map for every city the vault owns in.

   Districts are real, named and placed at their real centres; the boundaries
   between them are NOT real — they are Voronoi cells around those centres,
   clipped to a convex city limit. That is a map of "which district is
   where", not a cadastral one, and the page says so. Buildings are placed at
   their real coordinates, so each one lands in its true district.

   Writes data/cities.js (window.RENTA_CITIES) and data/cities.json.
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(root, 'data', 'buildings.json'), 'utf8'));

/* district centres, [name, lon, lat] — the ones people actually name */
const CITIES = {
  Lisbon: { country: 'Portugal', lon: -9.148, lat: 38.728, region: null, districts: [
    ['Baixa', -9.138, 38.711], ['Chiado', -9.142, 38.7105], ['Bica', -9.1465, 38.7095], ['Bairro Alto', -9.146, 38.7145],
    ['Alfama', -9.130, 38.712], ['Graça', -9.130, 38.7185], ['Príncipe Real', -9.150, 38.7175], ['Estrela', -9.160, 38.712],
    ['Campo de Ourique', -9.166, 38.7185], ['Alcântara', -9.176, 38.705], ['Belém', -9.204, 38.698], ['Ajuda', -9.196, 38.710],
    ['Campolide', -9.163, 38.730], ['Avenidas Novas', -9.150, 38.735], ['Arroios', -9.135, 38.727], ['Areeiro', -9.134, 38.742],
    ['Alvalade', -9.145, 38.752], ['Benfica', -9.200, 38.750], ['Marvila', -9.105, 38.740], ['Parque das Nações', -9.093, 38.768],
    ['Beato', -9.112, 38.728], ['Penha de França', -9.125, 38.725]
  ]},
  Madrid: { country: 'Spain', lon: -3.700, lat: 40.425, region: null, districts: [
    ['Lavapiés', -3.702, 40.409], ['Sol', -3.703, 40.417], ['La Latina', -3.712, 40.412], ['Malasaña', -3.704, 40.426],
    ['Chueca', -3.697, 40.423], ['Salamanca', -3.680, 40.428], ['Retiro', -3.678, 40.412], ['Chamberí', -3.703, 40.436],
    ['Arganzuela', -3.700, 40.398], ['Tetuán', -3.700, 40.460], ['Chamartín', -3.677, 40.460], ['Moncloa', -3.725, 40.438],
    ['Latina', -3.745, 40.395], ['Carabanchel', -3.730, 40.380], ['Usera', -3.705, 40.383], ['Puente de Vallecas', -3.665, 40.392],
    ['Ciudad Lineal', -3.650, 40.440], ['Hortaleza', -3.640, 40.470], ['Fuencarral', -3.700, 40.490], ['Moratalaz', -3.645, 40.408],
    ['Argüelles', -3.717, 40.430], ['Delicias', -3.692, 40.400]
  ]},
  Barcelona: { country: 'Spain', lon: 2.165, lat: 41.400, region: 'Catalonia', districts: [
    ['Gràcia', 2.156, 41.404], ['Eixample', 2.162, 41.392], ['Ciutat Vella', 2.176, 41.382], ['Sants', 2.140, 41.375],
    ['Poble-sec', 2.163, 41.373], ['Les Corts', 2.130, 41.386], ['Sarrià', 2.125, 41.400], ['Sant Gervasi', 2.145, 41.405],
    ['Horta', 2.160, 41.430], ['Guinardó', 2.170, 41.420], ['Nou Barris', 2.175, 41.443], ['Sant Andreu', 2.190, 41.435],
    ['Sant Martí', 2.205, 41.410], ['Poblenou', 2.200, 41.398], ['Barceloneta', 2.190, 41.380], ['El Born', 2.183, 41.386],
    ['Sant Antoni', 2.160, 41.378], ['El Clot', 2.188, 41.408], ['Vallcarca', 2.148, 41.412], ['Montjuïc', 2.150, 41.365]
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
  Leipzig: { country: 'Germany', lon: 12.375, lat: 51.340, region: null, districts: [
    ['Zentrum', 12.375, 51.340], ['Südvorstadt', 12.372, 51.325], ['Gohlis', 12.369, 51.358], ['Plagwitz', 12.335, 51.330],
    ['Lindenau', 12.330, 51.340], ['Connewitz', 12.375, 51.310], ['Reudnitz', 12.410, 51.335], ['Schleußig', 12.340, 51.320],
    ['Eutritzsch', 12.375, 51.370], ['Stötteritz', 12.420, 51.320], ['Möckern', 12.340, 51.370], ['Grünau', 12.290, 51.315],
    ['Paunsdorf', 12.470, 51.345], ['Zentrum-Süd', 12.370, 51.333], ['Zentrum-Ost', 12.395, 51.340], ['Schönefeld', 12.415, 51.360],
    ['Marienbrunn', 12.390, 51.310], ['Zentrum-West', 12.355, 51.340], ['Zentrum-Nord', 12.375, 51.352], ['Anger-Crottendorf', 12.420, 51.335],
    ['Neustadt-Neuschönefeld', 12.400, 51.348]
  ]},
  Rotterdam: { country: 'Netherlands', lon: 4.485, lat: 51.918, region: null, districts: [
    ['Centrum', 4.478, 51.922], ['Oude Noorden', 4.478, 51.933], ['Feijenoord', 4.500, 51.905], ['Hillesluis', 4.517, 51.898],
    ['Kralingen', 4.520, 51.925], ['Crooswijk', 4.500, 51.930], ['Delfshaven', 4.440, 51.912], ['Charlois', 4.480, 51.880],
    ['IJsselmonde', 4.540, 51.885], ['Prins Alexander', 4.560, 51.950], ['Overschie', 4.430, 51.945], ['Hillegersberg', 4.485, 51.955],
    ['Schiebroek', 4.470, 51.960], ['Blijdorp', 4.460, 51.932], ['Katendrecht', 4.480, 51.900], ['Kop van Zuid', 4.490, 51.906],
    ['Afrikaanderwijk', 4.505, 51.898], ['Bloemhof', 4.505, 51.891], ['Noordereiland', 4.490, 51.912], ['Bergpolder', 4.470, 51.935],
    ['Cool', 4.475, 51.918], ['Middelland', 4.455, 51.918]
  ]},
  'Kraków': { country: 'Poland', lon: 19.950, lat: 50.058, region: null, districts: [
    ['Stare Miasto', 19.938, 50.062], ['Kazimierz', 19.945, 50.050], ['Podgórze', 19.950, 50.040], ['Krowodrza', 19.915, 50.070],
    ['Grzegórzki', 19.960, 50.062], ['Nowa Huta', 20.040, 50.075], ['Prądnik Biały', 19.930, 50.095], ['Prądnik Czerwony', 19.965, 50.085],
    ['Zwierzyniec', 19.895, 50.055], ['Dębniki', 19.915, 50.040], ['Bieżanów-Prokocim', 20.010, 50.025], ['Łagiewniki', 19.940, 50.020],
    ['Bronowice', 19.890, 50.080], ['Czyżyny', 19.995, 50.070], ['Mistrzejowice', 20.000, 50.100], ['Swoszowice', 19.930, 49.990],
    ['Podgórze Duchackie', 19.960, 50.020], ['Wzgórza Krzesławickie', 20.060, 50.100], ['Kleparz', 19.940, 50.068], ['Zabłocie', 19.958, 50.047]
  ]}
};

/* ------------------------------------------------------- geometry ------- */
/* Sutherland–Hodgman: clip a polygon against the half-plane on the near
   side of the perpendicular bisector between p (kept) and q */
function clipHalfPlane(poly, p, q) {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = q[0] - p[0], ny = q[1] - p[1];
  const side = pt => (pt[0] - mx) * nx + (pt[1] - my) * ny;      /* <= 0 is p's side */
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
function voronoi(sites, boundary) {
  return sites.map((p, i) => { let cell = boundary; sites.forEach((q, j) => { if (i !== j && cell.length) cell = clipHalfPlane(cell, p, q); }); return cell; });
}
const area = poly => Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function centroid(poly) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; const c = p[0] * q[1] - q[0] * p[1]; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; a += c; }
  return a === 0 ? poly[0] : [x / (3 * a), y / (3 * a)];
}

/* ------------------------------------------------------- draw ----------- */
const W = 640, H = 520, PAD = 36;
const out = {};
for (const [city, c] of Object.entries(CITIES)) {
  const k = Math.cos(c.lat * Math.PI / 180);
  const proj = (lon, lat) => [(lon - c.lon) * k, -(lat - c.lat)];
  const sites = c.districts.map(([, lon, lat]) => proj(lon, lat));
  const bl = B.filter(b => b.city === city).map(b => ({ ...b, p: proj(b.lon, b.lat) }));
  /* the city limit: a convex, slightly irregular ring a little beyond the outermost centre */
  const rmax = Math.max(...sites.map(s => Math.hypot(s[0], s[1])));
  let seed = city.length * 977;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ring = [];
  const N = 40;
  const wob = Array.from({ length: N }, () => 0.86 + rnd() * 0.28);
  for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; const r = rmax * 1.32 * ((wob[i] + wob[(i + 1) % N] + wob[(i + N - 1) % N]) / 3); ring.push([Math.cos(t) * r * 1.12, Math.sin(t) * r]); }
  /* convex hull of the ring keeps Sutherland–Hodgman valid */
  const hull = (() => { const pts = [...ring].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); })();
  const cells = voronoi(sites, hull);
  /* fit to the frame */
  const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min((W - 2 * PAD) / (maxx - minx), (H - 2 * PAD) / (maxy - miny));
  const ox = (W - (maxx - minx) * s) / 2 - minx * s, oy = (H - (maxy - miny) * s) / 2 - miny * s;
  const T = p => [+(p[0] * s + ox).toFixed(1), +(p[1] * s + oy).toFixed(1)];
  const districts = c.districts.map(([name], i) => {
    const poly = cells[i].map(T);
    const ctr = T(centroid(cells[i]));
    const own = bl.some(b => b.district === name);
    return { name, d: 'M' + poly.map(p => p.join(',')).join('L') + 'Z', cx: ctr[0], cy: ctr[1], area: Math.round(area(poly)), own };
  });
  const kmPerPx = 111 / s;   /* one degree of latitude is 111 km, and y is degrees */
  out[city] = {
    country: c.country, region: c.region, viewBox: `0 0 ${W} ${H}`,
    limit: 'M' + hull.map(T).map(p => p.join(',')).join('L') + 'Z',
    scaleKm: kmPerPx * 100 >= 4 ? 5 : kmPerPx * 100 >= 1.5 ? 2 : 1, scalePx: Math.round((kmPerPx * 100 >= 4 ? 5 : kmPerPx * 100 >= 1.5 ? 2 : 1) / kmPerPx),
    districts,
    buildings: bl.map(b => { const p = T(b.p); return { id: b.id, name: b.name, district: b.district, x: p[0], y: p[1] }; })
  };
  const missing = bl.filter(b => !c.districts.some(d => d[0] === b.district));
  if (missing.length) throw new Error(city + ': no district named ' + missing.map(b => b.district).join(', '));
  /* check every building sits inside its named district's cell */
  for (const b of out[city].buildings) {
    const d = districts.find(d => d.name === b.district);
    const inside = (() => { const pts = d.d.slice(1, -1).split('L').map(s => s.split(',').map(Number)); let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > b.y) !== (yj > b.y)) && (b.x < (xj - xi) * (b.y - yi) / (yj - yi) + xi)) c = !c; } return c; })();
    console.error((inside ? '  ✓ ' : '  ✗ ') + city + ': ' + b.name + ' in ' + b.district + (inside ? '' : ' — NOT inside its cell, move the centre'));
  }
}
fs.writeFileSync(path.join(root, 'data', 'cities.js'), '/* generated by scripts/cities.js — do not edit */\nwindow.RENTA_CITIES = ' + JSON.stringify(out) + ';\n');
fs.writeFileSync(path.join(root, 'data', 'cities.json'), JSON.stringify(out, null, 1) + '\n');
console.error('wrote', Object.keys(out).length, 'cities,', fs.statSync(path.join(root, 'data', 'cities.js')).size, 'bytes');
