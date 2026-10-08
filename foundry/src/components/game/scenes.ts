/**
 * Scene backdrops for the world rows, one per generator category. Inline SVG
 * data URIs so they ship with the bundle and scale to any width.
 */
import type { GeneratorCategory } from "@/lib/content/generators";

const svg = (body: string, w = 600, h = 120) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMax slice'>${body}</svg>`)}")`;

const sky = (top: string, bottom: string) =>
  `<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/></linearGradient></defs><rect width='600' height='120' fill='url(#s)'/>`;

export const SCENES: Record<GeneratorCategory, string> = {
  // control room: grid floor and monitors
  cursor: svg(
    sky("#0e1a2b", "#0a1119") +
      `<g stroke='#2a3d57' stroke-width='1' opacity='0.6'>${Array.from({ length: 13 }, (_, i) => `<line x1='${i * 50}' y1='70' x2='${300 + (i - 6) * 90}' y2='120'/>`).join("")}<line x1='0' y1='80' x2='600' y2='80'/><line x1='0' y1='95' x2='600' y2='95'/><line x1='0' y1='112' x2='600' y2='112'/></g>` +
      `<g fill='#13223a' stroke='#3b5a86' stroke-width='1'>${[40, 140, 240, 340, 440, 540].map((x) => `<rect x='${x}' y='22' width='60' height='36' rx='2'/><rect x='${x + 6}' y='28' width='48' height='22' fill='#1c3c63' stroke='none'/>`).join("")}</g>` +
      `<g fill='#5fe0bd' opacity='0.8'>${[52, 152, 252, 352, 452, 552].map((x, i) => `<rect x='${x}' y='${40 - (i % 3) * 4}' width='4' height='${6 + (i % 3) * 4}'/><rect x='${x + 8}' y='${36 + (i % 2) * 5}' width='4' height='${10 - (i % 2) * 5}'/><rect x='${x + 16}' y='34' width='4' height='12'/>`).join("")}</g>`,
  ),
  // open pit with headframes and a pump jack silhouette
  extraction: svg(
    sky("#2b1d12", "#120b06") +
      `<path d='M0 70 L60 48 L120 66 L200 40 L270 62 L340 44 L420 68 L500 46 L560 60 L600 50 L600 120 L0 120Z' fill='#3a2714'/>` +
      `<path d='M0 86 L80 76 L160 90 L260 74 L360 92 L460 78 L540 90 L600 82 L600 120 L0 120Z' fill='#24170c'/>` +
      `<g fill='none' stroke='#8a6a44' stroke-width='2'><path d='M90 100 L104 54 L118 100 M94 86 H114 M98 72 H110 M104 54 L126 50'/><path d='M400 100 L414 50 L428 100 M404 86 H424 M408 72 H420'/></g>` +
      `<g stroke='#a07a4a' stroke-width='2' fill='none'><path d='M240 100 L252 66 L264 100 M232 66 L278 60 M278 60 L286 70'/><circle cx='232' cy='66' r='6'/></g>` +
      `<g fill='#f6c445' opacity='0.9'><circle cx='150' cy='94' r='1.5'/><circle cx='320' cy='96' r='1.5'/><circle cx='480' cy='92' r='1.5'/></g>`,
  ),
  // refinery skyline: stacks, spheres, pipe racks, flare
  industry: svg(
    sky("#1c1410", "#0c0806") +
      `<path d='M0 120 V78 H30 V60 H42 V78 H70 V50 H84 V78 H120 V70 H150 V78 H180 V40 H190 V78 H230 V64 H270 V78 H300 V56 H314 V78 H360 V72 H400 V78 H430 V46 H442 V78 H480 V66 H520 V78 H560 V60 H574 V78 H600 V120Z' fill='#2a2119'/>` +
      `<g fill='#3a2e24'><circle cx='250' cy='72' r='16'/><circle cx='500' cy='72' r='16'/></g>` +
      `<g stroke='#4d3f33' stroke-width='3' fill='none'><path d='M0 92 H600 M0 100 H600'/>${Array.from({ length: 12 }, (_, i) => `<line x1='${i * 50 + 25}' y1='84' x2='${i * 50 + 25}' y2='120'/>`).join("")}</g>` +
      `<path d='M184 40 c-4 -10 2 -16 4 -22 c2 6 8 12 2 22z' fill='#ff8a3d' opacity='0.9'/><circle cx='186' cy='26' r='7' fill='#ffb347' opacity='0.35'/>` +
      `<g fill='#ffd27a' opacity='0.8'>${[36, 76, 182, 306, 436, 566].map((x) => `<rect x='${x}' y='84' width='2' height='2'/>`).join("")}</g>`,
  ),
  // financial district at night
  finance: svg(
    sky("#0b1326", "#070b14") +
      `<path d='M0 120 V70 H24 V44 H48 V70 H70 V30 H96 V70 H120 V52 H150 V70 H176 V22 H206 V70 H236 V58 H262 V70 H290 V36 H318 V70 H346 V48 H372 V70 H400 V26 H430 V70 H456 V56 H484 V70 H512 V40 H540 V70 H566 V60 H600 V120Z' fill='#141f38'/>` +
      `<g fill='#ffd27a' opacity='0.7'>${Array.from({ length: 70 }, (_, i) => { const x = 26 + ((i * 37) % 560); const y = 34 + ((i * 53) % 60); return `<rect x='${x}' y='${y}' width='3' height='3'/>`; }).join("")}</g>` +
      `<path d='M0 118 H600' stroke='#2b3c66' stroke-width='2'/>` +
      `<polyline points='20,108 80,100 140,104 200,92 260,96 320,84 380,90 440,76 500,80 560,66' fill='none' stroke='#5fe0bd' stroke-width='2' opacity='0.8'/>`,
  ),
  // orbital: planet limb and stations
  mega: svg(
    sky("#120a26", "#06040f") +
      `<g fill='#fff' opacity='0.7'>${Array.from({ length: 60 }, (_, i) => `<circle cx='${(i * 97) % 600}' cy='${(i * 41) % 90}' r='${0.6 + (i % 3) * 0.4}'/>`).join("")}</g>` +
      `<ellipse cx='300' cy='230' rx='420' ry='140' fill='#2a1d55'/><ellipse cx='300' cy="236" rx='420' ry='140' fill='#1a1140'/>` +
      `<path d='M0 118 Q300 60 600 118' fill='none' stroke='#9d86ff' stroke-width='2' opacity='0.6'/>` +
      `<g stroke='#c8bcff' stroke-width='2' fill='none'><path d='M120 60 h40 M140 50 v20 M128 50 h24 v20 h-24z'/><path d='M460 44 h50 M485 34 v20 M470 34 h30 v20 h-30z'/></g>` +
      `<circle cx='300' cy='40' r='10' fill='none' stroke='#ffb347' stroke-width='2'/><circle cx='300' cy='40' r='3' fill='#ffb347'/>`,
  ),
};
