/* The register of water sources a token can be paired with. Where a source is
 * a named place, g is its position, so anyone can go and look at it.
 * Spot prices are reference figures that drift on a seeded random walk, so the
 * demo looks live without depending on any API.
 */

const CLASSES = ["Reservoir", "Aquifer", "Glacier", "Desalination"];

const WATER = [
  { t: "H2O",  n: "Raw water",              c: "Reservoir",    v: "NWX",    a: "untreated",        u: "per 1,000 m³",  p: 148.20, l: "Interstate, US"},
  { t: "CLR",  n: "Colorado River",         c: "Reservoir",    v: "LCRA",   a: "class A right",    u: "per acre-foot", p: 1240.00, l: "Colorado Basin, US", g: [36.8649, -111.5875]},
  { t: "MEAD", n: "Lake Mead",              c: "Reservoir",    v: "USBR",   a: "elev. 1,045 ft",   u: "per acre-foot", p: 1385.50, l: "Nevada / Arizona, US", g: [36.0161, -114.7377]},
  { t: "ORO",  n: "Oroville",               c: "Reservoir",    v: "CA-DWR", a: "elev. 823 ft",     u: "per acre-foot", p: 980.00, l: "California, US", g: [39.5386, -121.4858]},
  { t: "CNT",  n: "Cantareira",             c: "Reservoir",    v: "SABESP", a: "integrated system",u: "per 1,000 m³",  p: 96.40, l: "São Paulo, Brazil", g: [-22.9861, -46.4139]},
  { t: "SAU",  n: "Sau Reservoir",          c: "Reservoir",    v: "ACA",    a: "Ter basin",        u: "per 1,000 m³",  p: 212.80, l: "Catalonia, Spain", g: [41.9631, 2.39]},
  { t: "KRB",  n: "Kariba",                 c: "Reservoir",    v: "ZRA",    a: "elev. 481 m",      u: "per 1,000 m³",  p: 64.10, l: "Zambia / Zimbabwe", g: [-16.522, 28.7617]},
  { t: "NSR",  n: "Nasser",                 c: "Reservoir",    v: "MWRI",   a: "elev. 178 m",      u: "per 1,000 m³",  p: 58.30, l: "Aswan, Egypt", g: [23.9707, 32.877]},
  { t: "TGR",  n: "Three Gorges",           c: "Reservoir",    v: "CTG",    a: "elev. 175 m",      u: "per 1,000 m³",  p: 41.90, l: "Hubei, China", g: [30.8235, 111.0033]},
  { t: "SHT",  n: "Shasta",                 c: "Reservoir",    v: "USBR",   a: "elev. 1,067 ft",   u: "per acre-foot", p: 1104.00, l: "California, US", g: [40.7182, -122.4189]},
  { t: "POW",  n: "Lake Powell",            c: "Reservoir",    v: "USBR",   a: "elev. 3,572 ft",   u: "per acre-foot", p: 1318.00, l: "Utah / Arizona, US", g: [36.937, -111.4838]},
  { t: "GUR",  n: "Guri",                   c: "Reservoir",    v: "EDELCA", a: "elev. 271 m",      u: "per 1,000 m³",  p: 37.25, l: "Bolívar, Venezuela", g: [7.7626, -62.9989]},

  { t: "OGL",  n: "Ogallala",               c: "Aquifer",      v: "HPWD",   a: "static level",     u: "per acre-foot", p: 620.00, l: "High Plains, US", g: [37.0, -101.0]},
  { t: "CAM",  n: "Cambrian-Ordovician",    c: "Aquifer",      v: "MDE",    a: "potable, 99.4%",   u: "per 1,000 m³",  p: 384.00, l: "Midwest, US", g: [41.8781, -87.6298]},
  { t: "GAB",  n: "Guarani",                c: "Aquifer",      v: "OAS",    a: "thermal, 99.1%",   u: "per 1,000 m³",  p: 172.60, l: "Paraná Basin, South America", g: [-21.1767, -47.8208]},
  { t: "NSAS", n: "Nubian Sandstone",       c: "Aquifer",      v: "CEDARE", a: "fossil",           u: "per 1,000 m³",  p: 205.40, l: "Sahara, North Africa", g: [24.2, 23.3]},
  { t: "CVA",  n: "Central Valley",         c: "Aquifer",      v: "SGMA",   a: "managed pumping",  u: "per acre-foot", p: 890.00, l: "California, US", g: [36.7378, -119.7871]},
  { t: "IND",  n: "Indo-Gangetic",          c: "Aquifer",      v: "CGWB",   a: "potable, 98.2%",   u: "per 1,000 m³",  p: 143.00, l: "Indo-Gangetic Plain", g: [30.901, 75.8573]},
  { t: "MRB",  n: "Great Artesian Basin",   c: "Aquifer",      v: "MDBA",   a: "artesian",         u: "per 1,000 m³",  p: 118.70, l: "Queensland, Australia", g: [-23.44, 144.25]},
  { t: "KRS",  n: "Dinaric Karst",          c: "Aquifer",      v: "EEA",    a: "mineral, 99.7%",   u: "per 1,000 m³",  p: 466.00, l: "Dinaric Alps, Balkans", g: [45.78, 14.2]},

  { t: "GLC",  n: "Perito Moreno",          c: "Glacier",      v: "APN",    a: "millennial ice",   u: "per tonne",     p: 312.00, l: "Santa Cruz, Argentina", g: [-50.4967, -73.1377]},
  { t: "GRN",  n: "Greenland Core",         c: "Glacier",      v: "GEUS",   a: "99.99% pure",      u: "per tonne",     p: 1980.00, l: "Greenland Ice Sheet", g: [72.5796, -38.4592]},
  { t: "ALP",  n: "Aletsch",                c: "Glacier",      v: "GLAMOS", a: "mass balance",     u: "per tonne",     p: 742.00, l: "Valais, Switzerland", g: [46.5, 8.05]},
  { t: "HKH",  n: "Hindu Kush",             c: "Glacier",      v: "ICIMOD", a: "seasonal melt",    u: "per tonne",     p: 268.00, l: "Hindu Kush Himalaya", g: [35.7333, 76.3667]},
  { t: "PTG",  n: "Southern Icefield",      c: "Glacier",      v: "DGA",    a: "blue ice",         u: "per tonne",     p: 524.00, l: "Patagonia, Chile", g: [-49.5, -73.3]},
  { t: "ICE",  n: "Vatnajökull",            c: "Glacier",      v: "IMO",    a: "99.9% pure",       u: "per tonne",     p: 1130.00, l: "Vatnajökull, Iceland", g: [64.4167, -16.8]},

  { t: "DSL",  n: "Reverse osmosis",        c: "Desalination", v: "IDA",    a: "permeate, 99.8%",  u: "per 1,000 m³",  p: 560.00, l: "Gulf coast, worldwide"},
  { t: "RAS",  n: "Ras Al Khair",           c: "Desalination", v: "SWCC",   a: "permeate, 99.9%",  u: "per 1,000 m³",  p: 498.00, l: "Ras Al Khair, Saudi Arabia", g: [27.517, 49.2]},
  { t: "SOR",  n: "Sorek B",                c: "Desalination", v: "IWA",    a: "permeate, 99.9%",  u: "per 1,000 m³",  p: 402.00, l: "Sorek, Israel", g: [31.933, 34.706]},
  { t: "CRL",  n: "Carlsbad",               c: "Desalination", v: "SDCWA",  a: "permeate, 99.8%",  u: "per acre-foot", p: 2380.00, l: "Carlsbad, California", g: [33.14, -117.34]},
  { t: "TRR",  n: "Torrevieja",             c: "Desalination", v: "ACUAES", a: "permeate, 99.6%",  u: "per 1,000 m³",  p: 612.00, l: "Torrevieja, Spain", g: [37.98, -0.7]},
  { t: "PRT",  n: "Reclaimed water",        c: "Desalination", v: "REUT",   a: "tertiary, 98.5%",  u: "per 1,000 m³",  p: 188.00, l: "Municipal, worldwide"},
];

/* Fill level / availability of each source, 0–1. This is what moves the peg. */
const BASE_LEVEL = {
  MEAD: .31, POW: .29, ORO: .71, SHT: .58, CNT: .62, SAU: .24, KRB: .44, NSR: .58,
  TGR: .79, GUR: .52, CLR: .38, H2O: .55, OGL: .41, CAM: .66, GAB: .74, NSAS: .82,
  CVA: .36, IND: .47, MRB: .69, KRS: .77, GLC: .61, GRN: .88, ALP: .43, HKH: .49,
  PTG: .64, ICE: .57, DSL: .93, RAS: .95, SOR: .91, CRL: .9, TRR: .87, PRT: .84,
};

/* A line on the featured sites, for the gallery on the front page. Figures are
 * the published ones; the drawings in media/plates are built from them. */
const SITE_NOTES = {
  MEAD: "The Colorado's largest store, held behind Hoover Dam. Two decades of drawdown left a white band of mineral on the canyon walls that marks where the surface used to be.",
  TGR: "The largest impoundment by installed power. Its level is run to a schedule: low through the flood season, high through the winter so the turbines keep their head.",
  OGL: "Not a lake but the pore space of the High Plains, saturated over millennia. What is pumped out in a year takes centuries to come back, so the static level only moves one way.",
  NSAS: "Fossil water under four countries, recharged when the Sahara was green. There is no inflow to speak of, which makes any figure for it a measurement of a stock, not a flow.",
  GRN: "Ice laid down season by season and read back as a core. Mass balance is the difference between what falls on top and what leaves at the margins.",
  SOR: "Seawater pushed through membranes at pressure. Availability here is an engineering figure, not a hydrological one: it depends on the plant running, not on the rain.",
};

/* The order they appear in as you scroll the front page. */
const FEATURED = ["MEAD", "TGR", "OGL", "NSAS", "GRN", "SOR"];
