/* Copies the four web font files the site uses into public/fonts, self-hosted so
 * no visitor request goes to a third party. Latin subset only: it covers every
 * Spanish character (á é í ó ú ü ñ ¿ ¡). */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'fonts');
const FILES = [
  ['@fontsource/montserrat/files/montserrat-latin-500-normal.woff2', 'montserrat-500.woff2'],
  ['@fontsource/montserrat/files/montserrat-latin-600-normal.woff2', 'montserrat-600.woff2'],
  ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['@fontsource/inter/files/inter-latin-500-normal.woff2', 'inter-500.woff2']
];

fs.mkdirSync(OUT, { recursive: true });
for (const [from, to] of FILES) {
  fs.copyFileSync(require.resolve(from), path.join(OUT, to));
  console.log('fonts/' + to);
}
