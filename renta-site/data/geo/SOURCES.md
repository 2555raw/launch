# District boundaries

Real administrative boundaries, one GeoJSON per city, drawn by `scripts/cities.js`.
A city with no file here falls back to a schematic (real district centres, Voronoi
cells between them) and the city view says so.

| City | File | Level | Source | Licence |
|---|---|---|---|---|
| Lisbon | `lisbon.geojson` | 24 freguesias | Direção-Geral do Território (CAOP), via [Who's On First](https://whosonfirst.org) `whosonfirst-data-admin-pt` | CC BY 4.0 |
| Madrid | `madrid.geojson` | 128 barrios | Ayuntamiento de Madrid open data, via [click_that_hood](https://github.com/codeforgermany/click_that_hood) | CC BY 4.0 |
| Barcelona | `barcelona.geojson` | 73 barris | Ajuntament de Barcelona (CartoBCN), via [martgnz/bcn-geodata](https://github.com/martgnz/bcn-geodata) | CC BY 4.0 |
| Leipzig | `leipzig.geojson` | 63 Ortsteile | Stadt Leipzig open data, via click_that_hood | dl-de/by-2-0 |
| Rotterdam | `rotterdam.geojson` | gebieden (harbour areas and Hoogvliet dropped) | Gemeente Rotterdam open data, via click_that_hood | CC0 |

Schematic until a file lands here:

| City | Wanted | Why not yet | Where it is published |
|---|---|---|---|
| Turin | 8 circoscrizioni or 94 quartieri | Who's On First holds polygons for only 14 of the quartieri — a map with gaps misleads more than a schematic | Comune di Torino, AperTO (`aperto.comune.torino.it`) |
| Kraków | 18 dzielnice | Who's On First holds points, not polygons, for Kraków's districts | Urząd Miasta Krakowa, MSIP (`msip.krakow.pl`) |
| Terrassa | 6 districtes / barris | No mirror of the city's data reachable from the build environment | Ajuntament de Terrassa, Open Data (`opendata.terrassa.cat`) |

Drop the file in as `<city>.geojson` (WGS84, one feature per district, a `name`
property), add a line to `REAL` in `scripts/cities.js` if the name property differs,
and run `npm run data`. The script places each building by point-in-polygon and
reports the district it lands in.
