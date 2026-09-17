/* The register of water sources a token can be paired with.
 * Spot prices are reference figures that drift on a seeded random walk, so the
 * demo looks live without depending on any API.
 */

const CLASSES = ["Reservoir", "Aquifer", "Glacier", "Desalination"];

const WATER = [
  { t: "H2O",  n: "Raw water",              c: "Reservoir",    v: "NWX",    a: "untreated",        u: "per 1,000 m³",  p: 148.20 },
  { t: "CLR",  n: "Colorado River",         c: "Reservoir",    v: "LCRA",   a: "class A right",    u: "per acre-foot", p: 1240.00 },
  { t: "MEAD", n: "Lake Mead",              c: "Reservoir",    v: "USBR",   a: "elev. 1,045 ft",   u: "per acre-foot", p: 1385.50 },
  { t: "ORO",  n: "Oroville",               c: "Reservoir",    v: "CA-DWR", a: "elev. 823 ft",     u: "per acre-foot", p: 980.00 },
  { t: "CNT",  n: "Cantareira",             c: "Reservoir",    v: "SABESP", a: "integrated system",u: "per 1,000 m³",  p: 96.40 },
  { t: "SAU",  n: "Sau Reservoir",          c: "Reservoir",    v: "ACA",    a: "Ter basin",        u: "per 1,000 m³",  p: 212.80 },
  { t: "KRB",  n: "Kariba",                 c: "Reservoir",    v: "ZRA",    a: "elev. 481 m",      u: "per 1,000 m³",  p: 64.10 },
  { t: "NSR",  n: "Nasser",                 c: "Reservoir",    v: "MWRI",   a: "elev. 178 m",      u: "per 1,000 m³",  p: 58.30 },
  { t: "TGR",  n: "Three Gorges",           c: "Reservoir",    v: "CTG",    a: "elev. 175 m",      u: "per 1,000 m³",  p: 41.90 },
  { t: "SHT",  n: "Shasta",                 c: "Reservoir",    v: "USBR",   a: "elev. 1,067 ft",   u: "per acre-foot", p: 1104.00 },
  { t: "POW",  n: "Lake Powell",            c: "Reservoir",    v: "USBR",   a: "elev. 3,572 ft",   u: "per acre-foot", p: 1318.00 },
  { t: "GUR",  n: "Guri",                   c: "Reservoir",    v: "EDELCA", a: "elev. 271 m",      u: "per 1,000 m³",  p: 37.25 },

  { t: "OGL",  n: "Ogallala",               c: "Aquifer",      v: "HPWD",   a: "static level",     u: "per acre-foot", p: 620.00 },
  { t: "CAM",  n: "Cambrian-Ordovician",    c: "Aquifer",      v: "MDE",    a: "potable, 99.4%",   u: "per 1,000 m³",  p: 384.00 },
  { t: "GAB",  n: "Guarani",                c: "Aquifer",      v: "OAS",    a: "thermal, 99.1%",   u: "per 1,000 m³",  p: 172.60 },
  { t: "NSAS", n: "Nubian Sandstone",       c: "Aquifer",      v: "CEDARE", a: "fossil",           u: "per 1,000 m³",  p: 205.40 },
  { t: "CVA",  n: "Central Valley",         c: "Aquifer",      v: "SGMA",   a: "managed pumping",  u: "per acre-foot", p: 890.00 },
  { t: "IND",  n: "Indo-Gangetic",          c: "Aquifer",      v: "CGWB",   a: "potable, 98.2%",   u: "per 1,000 m³",  p: 143.00 },
  { t: "MRB",  n: "Great Artesian Basin",   c: "Aquifer",      v: "MDBA",   a: "artesian",         u: "per 1,000 m³",  p: 118.70 },
  { t: "KRS",  n: "Dinaric Karst",          c: "Aquifer",      v: "EEA",    a: "mineral, 99.7%",   u: "per 1,000 m³",  p: 466.00 },

  { t: "GLC",  n: "Perito Moreno",          c: "Glacier",      v: "APN",    a: "millennial ice",   u: "per tonne",     p: 312.00 },
  { t: "GRN",  n: "Greenland Core",         c: "Glacier",      v: "GEUS",   a: "99.99% pure",      u: "per tonne",     p: 1980.00 },
  { t: "ALP",  n: "Aletsch",                c: "Glacier",      v: "GLAMOS", a: "mass balance",     u: "per tonne",     p: 742.00 },
  { t: "HKH",  n: "Hindu Kush",             c: "Glacier",      v: "ICIMOD", a: "seasonal melt",    u: "per tonne",     p: 268.00 },
  { t: "PTG",  n: "Southern Icefield",      c: "Glacier",      v: "DGA",    a: "blue ice",         u: "per tonne",     p: 524.00 },
  { t: "ICE",  n: "Vatnajökull",            c: "Glacier",      v: "IMO",    a: "99.9% pure",       u: "per tonne",     p: 1130.00 },

  { t: "DSL",  n: "Reverse osmosis",        c: "Desalination", v: "IDA",    a: "permeate, 99.8%",  u: "per 1,000 m³",  p: 560.00 },
  { t: "RAS",  n: "Ras Al Khair",           c: "Desalination", v: "SWCC",   a: "permeate, 99.9%",  u: "per 1,000 m³",  p: 498.00 },
  { t: "SOR",  n: "Sorek B",                c: "Desalination", v: "IWA",    a: "permeate, 99.9%",  u: "per 1,000 m³",  p: 402.00 },
  { t: "CRL",  n: "Carlsbad",               c: "Desalination", v: "SDCWA",  a: "permeate, 99.8%",  u: "per acre-foot", p: 2380.00 },
  { t: "TRR",  n: "Torrevieja",             c: "Desalination", v: "ACUAES", a: "permeate, 99.6%",  u: "per 1,000 m³",  p: 612.00 },
  { t: "PRT",  n: "Reclaimed water",        c: "Desalination", v: "REUT",   a: "tertiary, 98.5%",  u: "per 1,000 m³",  p: 188.00 },
];

/* Fill level / availability of each source, 0–1. This is what moves the peg. */
const BASE_LEVEL = {
  MEAD: .31, POW: .29, ORO: .71, SHT: .58, CNT: .62, SAU: .24, KRB: .44, NSR: .58,
  TGR: .79, GUR: .52, CLR: .38, H2O: .55, OGL: .41, CAM: .66, GAB: .74, NSAS: .82,
  CVA: .36, IND: .47, MRB: .69, KRS: .77, GLC: .61, GRN: .88, ALP: .43, HKH: .49,
  PTG: .64, ICE: .57, DSL: .93, RAS: .95, SOR: .91, CRL: .9, TRR: .87, PRT: .84,
};
