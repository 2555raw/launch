/* Builds the preview page.

   One file, no requests beyond the two Google fonts, with the race engine and
   the renderer taken verbatim from the app above it - which is the point: what
   the preview shows on the track is exactly what the real site runs. Only the
   page around them is written for this build.

   node preview/build.js  ->  preview/dist/marble-royale-preview.html */

const fs = require('fs');
const path = require('path');

const here = __dirname;
const app = path.join(here, '..');
const read = (p) => fs.readFileSync(p, 'utf8').trimEnd();

let out = read(path.join(here, 'page.html'));
const put = (mark, body) => {
  const token = '/*{{' + mark + '}}*/';
  if (!out.includes(token)) throw new Error('page.html has no ' + token);
  out = out.replace(token, body);
};

put('CSS', read(path.join(here, 'preview.css')));
put('ENGINE', read(path.join(app, 'public', 'shared', 'race.js')));
put('RENDER', read(path.join(app, 'public', 'render.js')));
put('APP', read(path.join(here, 'preview.js')));

fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
const file = path.join(here, 'dist', 'marble-royale-preview.html');
fs.writeFileSync(file, out);
console.log('wrote ' + path.relative(process.cwd(), file) + '  (' + Math.round(out.length / 1024) + ' KB)');
