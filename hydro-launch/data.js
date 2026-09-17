/* Catálogo de fuentes de agua contra las que se puede parear un token.
 * Los precios spot son de referencia y se mueven con un paseo aleatorio sembrado,
 * para que la demo se vea viva sin depender de ninguna API.
 */

const CLASSES = ["Embalse", "Acuífero", "Glaciar", "Desalación"];

const WATER = [
  { t: "H2O",    n: "Agua cruda",            c: "Embalse",    v: "NWX",   a: "sin tratar",            u: "por 1.000 m³",   p: 148.20 },
  { t: "CLR",    n: "Colorado River",        c: "Embalse",    v: "LCRA",  a: "derecho clase A",       u: "por acre-pie",   p: 1240.00 },
  { t: "MEAD",   n: "Lake Mead",             c: "Embalse",    v: "USBR",  a: "cota 1.045 ft",         u: "por acre-pie",   p: 1385.50 },
  { t: "ORO",    n: "Oroville",              c: "Embalse",    v: "CA-DWR",a: "cota 823 ft",           u: "por acre-pie",   p: 980.00 },
  { t: "CNT",    n: "Cantareira",            c: "Embalse",    v: "SABESP",a: "sistema integrado",     u: "por 1.000 m³",   p: 96.40 },
  { t: "SAU",    n: "Pantano de Sau",        c: "Embalse",    v: "ACA",   a: "cuenca Ter",            u: "por 1.000 m³",   p: 212.80 },
  { t: "KRB",    n: "Kariba",                c: "Embalse",    v: "ZRA",   a: "cota 481 m",            u: "por 1.000 m³",   p: 64.10 },
  { t: "NSR",    n: "Nasser",                c: "Embalse",    v: "MWRI",  a: "cota 178 m",            u: "por 1.000 m³",   p: 58.30 },
  { t: "TGR",    n: "Tres Gargantas",        c: "Embalse",    v: "CTG",   a: "cota 175 m",            u: "por 1.000 m³",   p: 41.90 },
  { t: "SHT",    n: "Shasta",                c: "Embalse",    v: "USBR",  a: "cota 1.067 ft",         u: "por acre-pie",   p: 1104.00 },
  { t: "POW",    n: "Lake Powell",           c: "Embalse",    v: "USBR",  a: "cota 3.572 ft",         u: "por acre-pie",   p: 1318.00 },
  { t: "GUR",    n: "Guri",                  c: "Embalse",    v: "EDELCA",a: "cota 271 m",            u: "por 1.000 m³",   p: 37.25 },

  { t: "OGL",    n: "Ogallala",              c: "Acuífero",   v: "HPWD",  a: "nivel estático",        u: "por acre-pie",   p: 620.00 },
  { t: "CAM",    n: "Cambro-Ordovícico",     c: "Acuífero",   v: "MDE",   a: "potable, 99,4%",        u: "por 1.000 m³",   p: 384.00 },
  { t: "GAB",    n: "Guaraní",               c: "Acuífero",   v: "OEA",   a: "termal, 99,1%",         u: "por 1.000 m³",   p: 172.60 },
  { t: "NSAS",   n: "Nubio",                 c: "Acuífero",   v: "CEDARE",a: "fósil",                 u: "por 1.000 m³",   p: 205.40 },
  { t: "CVA",    n: "Central Valley",        c: "Acuífero",   v: "SGMA",  a: "bombeo regulado",       u: "por acre-pie",   p: 890.00 },
  { t: "IND",    n: "Indo-Gangético",        c: "Acuífero",   v: "CGWB",  a: "potable, 98,2%",        u: "por 1.000 m³",   p: 143.00 },
  { t: "MRB",    n: "Gran Cuenca Artesiana", c: "Acuífero",   v: "MDBA",  a: "artesiano",             u: "por 1.000 m³",   p: 118.70 },
  { t: "KRS",    n: "Karst dinárico",        c: "Acuífero",   v: "EEA",   a: "mineral, 99,7%",        u: "por 1.000 m³",   p: 466.00 },

  { t: "GLC",    n: "Glaciar Perito Moreno", c: "Glaciar",    v: "APN",   a: "hielo milenario",       u: "por tonelada",   p: 312.00 },
  { t: "GRN",    n: "Núcleo de Groenlandia", c: "Glaciar",    v: "GEUS",  a: "pureza 99,99%",         u: "por tonelada",   p: 1980.00 },
  { t: "ALP",    n: "Aletsch",               c: "Glaciar",    v: "GLAMOS",a: "balance de masa",       u: "por tonelada",   p: 742.00 },
  { t: "HKH",    n: "Hindu Kush",            c: "Glaciar",    v: "ICIMOD",a: "deshielo estacional",   u: "por tonelada",   p: 268.00 },
  { t: "PTG",    n: "Campo de Hielo Sur",    c: "Glaciar",    v: "DGA",   a: "hielo azul",            u: "por tonelada",   p: 524.00 },
  { t: "ICE",    n: "Vatnajökull",           c: "Glaciar",    v: "IMO",   a: "pureza 99,9%",          u: "por tonelada",   p: 1130.00 },

  { t: "DSL",    n: "Ósmosis inversa",       c: "Desalación", v: "IDA",   a: "permeado, 99,8%",       u: "por 1.000 m³",   p: 560.00 },
  { t: "RAS",    n: "Ras Al Khair",          c: "Desalación", v: "SWCC",  a: "permeado, 99,9%",       u: "por 1.000 m³",   p: 498.00 },
  { t: "SOR",    n: "Sorek B",               c: "Desalación", v: "IWA",   a: "permeado, 99,9%",       u: "por 1.000 m³",   p: 402.00 },
  { t: "CRL",    n: "Carlsbad",              c: "Desalación", v: "SDCWA", a: "permeado, 99,8%",       u: "por acre-pie",   p: 2380.00 },
  { t: "TRR",    n: "Torrevieja",            c: "Desalación", v: "ACUAES",a: "permeado, 99,6%",       u: "por 1.000 m³",   p: 612.00 },
  { t: "PRT",    n: "Agua regenerada",       c: "Desalación", v: "REUT",  a: "terciario, 98,5%",      u: "por 1.000 m³",   p: 188.00 },
];

/* Nivel de llenado / disponibilidad de cada fuente, 0–1. Es lo que mueve el peg. */
const BASE_LEVEL = {
  MEAD: .31, POW: .29, ORO: .71, SHT: .58, CNT: .62, SAU: .24, KRB: .44, NSR: .58,
  TGR: .79, GUR: .52, CLR: .38, H2O: .55, OGL: .41, CAM: .66, GAB: .74, NSAS: .82,
  CVA: .36, IND: .47, MRB: .69, KRS: .77, GLC: .61, GRN: .88, ALP: .43, HKH: .49,
  PTG: .64, ICE: .57, DSL: .93, RAS: .95, SOR: .91, CRL: .9, TRR: .87, PRT: .84,
};
