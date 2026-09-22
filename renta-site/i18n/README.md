# i18n

The site ships in English. A second language is two dictionaries here —
`<lang>.index.json` and `<lang>.docs.json`, exact English source string → translation —
plus a strings table in `app.js` (`STRINGS.<lang>`) and `scripts/render-static.js`
(`LANGS.<lang>`). Then:

```
node scripts/translate.js --lang zh && node scripts/render-static.js
```

`translate.js --lang zh --check` reports any text node on the built pages that still
reads as English.
