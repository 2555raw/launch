# District boundaries

Real administrative boundaries, one GeoJSON per city, drawn by `scripts/cities.js`.
A city with no file here falls back to a schematic (real district centres, Voronoi
cells between them) and the city view says so.

| City | File | Level | Source | Licence |
|---|---|---|---|---|
| Madrid | `madrid.geojson` | 128 barrios | Ayuntamiento de Madrid open data, via [click_that_hood](https://github.com/codeforgermany/click_that_hood) | CC BY 4.0 |
| Barcelona | `barcelona.geojson` | 73 barris | Ajuntament de Barcelona (CartoBCN), via [martgnz/bcn-geodata](https://github.com/martgnz/bcn-geodata) | CC BY 4.0 |
| Leipzig | `leipzig.geojson` | 63 Ortsteile | Stadt Leipzig open data, via click_that_hood | dl-de/by-2-0 |
| Rotterdam | `rotterdam.geojson` | 22 gebieden (harbour areas dropped) | Gemeente Rotterdam open data, via click_that_hood | CC0 |

Not yet on disk — schematic until a file lands here:

| City | Wanted | Where it is published |
|---|---|---|
| Lisbon | 24 freguesias | Câmara Municipal de Lisboa, Lisboa Aberta (`geodados.cm-lisboa.pt`) |
| Turin | 8 circoscrizioni or 94 quartieri | Comune di Torino, AperTO (`aperto.comune.torino.it`) |
| Kraków | 18 dzielnice | Urząd Miasta Krakowa, MSIP (`msip.krakow.pl`) |
| Terrassa | 6 districtes / barris | Ajuntament de Terrassa, Open Data (`opendata.terrassa.cat`) |

Drop the file in as `<city>.geojson` (WGS84, one feature per district, a `name`
property), add a line to `REAL` in `scripts/cities.js` if the name property differs,
and run `npm run data`.
