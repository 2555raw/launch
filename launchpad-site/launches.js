/* El catálogo de lanzamientos: uno por marca, y cada uno pareado a un ticker
   que cotiza de verdad. Sólo entran cadenas (o sitios donde pedir comida) cuya
   matriz está en bolsa: así el par del lanzamiento es TOKEN/ACCIÓN y la
   cotización de la derecha es real. Subway, Chick-fil-A, Dunkin' o Five Guys
   no están porque son privadas y no hay nada con lo que parearlas.

   `parent` es el ticker de la matriz (de ahí sale la cotización). `domain` es
   el dominio oficial de la marca, y de él se resuelve el logo oficial en
   tiempo de ejecución, con la misma regla que el Terminal: nunca un logo
   dibujado o aproximado.

   openIn / closeIn son horas relativas al primer arranque: así la mesa tiene
   lanzamientos en vivo, próximos y cerrados desde el primer día. Una vez
   sembradas, las fechas quedan fijas en el fichero de datos.

   Lo que cambia (recaudado, aportaciones, cierre anticipado) vive en el
   fichero de datos del servidor, no aquí. */

const L = (id, tick, name, domain, parent, parentName, cat, chain, price, supply, goal, min, walletCap, openIn, closeIn, blurb) =>
  ({ id, tick, name, domain, parent, parentName, cat, chain, pair: `${tick}/${parent}`, price, supply, goal, min, walletCap, openIn, closeIn, blurb });

module.exports = [
  // burger
  L('mcdonalds',   'MCD',   "McDonald's",       'mcdonalds.com',    'MCD',  "McDonald's Corporation",            'burger',   'Ethereum',  0.25,  40_000_000, 2_000_000, 600_000, 25_000, -72,  6,   'El más grande de la mesa. Pareado directo a MCD, sale en Ethereum y cierra en horas.'),
  L('burgerking',  'BK',    'Burger King',      'bk.com',           'QSR',  'Restaurant Brands International',   'burger',   'Base',      0.035, 60_000_000,   420_000, 150_000,  5_000,  -6, 78,   'Pareado a QSR, la matriz de Burger King, Popeyes y Tim Hortons.'),
  L('wendys',      'WENDY', "Wendy's",          'wendys.com',       'WEN',  "The Wendy's Company",               'burger',   'Base',      0.042, 50_000_000,   420_000, 120_000,  5_000, -30, 42,   'Hamburguesa cuadrada y Frosty. Pareado a WEN con el 20 % de la emisión en la ventana.'),
  L('shakeshack',  'SHAK',  'Shake Shack',      'shakeshack.com',   'SHAK', 'Shake Shack Inc.',                  'burger',   'Base',      0.08,  30_000_000,   480_000, 150_000,  8_000, -260, -188, 'Pareado a SHAK. Ventana ya cerrada.'),
  L('jackinthebox','JACK',  'Jack in the Box',  'jackinthebox.com', 'JACK', 'Jack in the Box Inc.',              'burger',   'Solana',    0.015, 60_000_000,   240_000,  80_000,  3_000, 204, 276,  'Pareado a JACK. Abre dentro de una semana y media.'),
  // mexicana
  L('tacobell',    'TACO',  'Taco Bell',        'tacobell.com',     'YUM',  'Yum! Brands, Inc.',                 'mex',      'Solana',    0.018, 100_000_000,  360_000,  90_000,  4_000, -12, 60,   'Pareado a YUM, la matriz de Taco Bell, KFC y Pizza Hut. Ventana larga y tope bajo: pensado para muchas manos.'),
  L('chipotle',    'CHIP',  'Chipotle',         'chipotle.com',     'CMG',  'Chipotle Mexican Grill, Inc.',      'mex',      'Base',      0.09,  50_000_000,   900_000, 300_000, 10_000,  36, 108,  'Pareado a CMG. Abre en día y medio.'),
  L('cava',        'CAVA',  'CAVA',             'cava.com',         'CAVA', 'CAVA Group, Inc.',                  'casual',   'Base',      0.05,  40_000_000,   400_000, 120_000,  5_000,  84, 156,  'Mediterránea rápida. Pareado a CAVA.'),
  L('sweetgreen',  'SG',    'Sweetgreen',       'sweetgreen.com',   'SG',   'Sweetgreen, Inc.',                  'casual',   'Solana',    0.012, 80_000_000,   240_000,  80_000,  3_000, 132, 204,  'Ensaladas. Pareado a SG.'),
  // café
  L('starbucks',   'SBUX',  'Starbucks',        'starbucks.com',    'SBUX', 'Starbucks Corporation',             'cafe',     'Ethereum',  0.12,  80_000_000, 1_920_000, 500_000, 15_000, -48, 24,   'Café, no comida rápida. Pareado directo a SBUX.'),
  L('timhortons',  'TIMS',  'Tim Hortons',      'timhortons.com',   'QSR',  'Restaurant Brands International',   'cafe',     'Base',      0.02,  70_000_000,   280_000,  90_000,  4_000,  60, 132,  'Café canadiense. Pareado a QSR, como Burger King y Popeyes.'),
  L('dutchbros',   'BROS',  'Dutch Bros',       'dutchbros.com',    'BROS', 'Dutch Bros Inc.',                   'cafe',     'Solana',    0.025, 50_000_000,   250_000,  80_000,  3_000, 108, 180,  'Café con ventanilla. Pareado a BROS.'),
  L('krispykreme', 'DNUT',  'Krispy Kreme',     'krispykreme.com',  'DNUT', 'Krispy Kreme, Inc.',                'cafe',     'Base',      0.01,  90_000_000,   180_000,  60_000,  2_500, 156, 228,  'Dónuts. Pareado a DNUT.'),
  // pizza
  L('dominos',     'DOM',   "Domino's",         'dominos.com',      'DPZ',  "Domino's Pizza, Inc.",              'pizza',    'Base',      0.05,  60_000_000,   600_000, 180_000,  6_000,  60, 132,  'Pizza a domicilio. Pareado a DPZ, abre en dos días y medio.'),
  L('pizzahut',    'HUT',   'Pizza Hut',        'pizzahut.com',     'YUM',  'Yum! Brands, Inc.',                 'pizza',    'Ethereum',  0.04,  50_000_000,   400_000, 150_000,  5_000, -200, -128, 'Pareado a YUM. Ventana ya cerrada.'),
  L('papajohns',   'PAPA',  "Papa John's",      'papajohns.com',    'PZZA', "Papa John's International, Inc.",   'pizza',    'Solana',    0.03,  50_000_000,   300_000, 100_000,  4_000, 180, 252,  'Pareado a PZZA. Abre en una semana.'),
  // pollo
  L('kfc',         'KFC',   'KFC',              'kfc.com',          'YUM',  'Yum! Brands, Inc.',                 'chicken',  'Solana',    0.02,  90_000_000,   360_000, 100_000,  4_000,  18, 90,   'Pollo de Yum! Brands. Pareado a YUM, abre pronto.'),
  L('popeyes',     'POP',   'Popeyes',          'popeyes.com',      'QSR',  'Restaurant Brands International',   'chicken',  'Solana',    0.025, 60_000_000,   300_000,  90_000,  3_000, -140, -92,  'Pollo de Luisiana. Pareado a QSR. Ventana ya cerrada.'),
  L('wingstop',    'WING',  'Wingstop',         'wingstop.com',     'WING', 'Wingstop Inc.',                     'chicken',  'Base',      0.06,  40_000_000,   480_000, 150_000,  6_000,  48, 120,  'Alitas. Pareado a WING.'),
  // delivery: sitios donde pedir comida
  L('doordash',    'DASH',  'DoorDash',         'doordash.com',     'DASH', 'DoorDash, Inc.',                    'delivery', 'Ethereum',  0.2,   50_000_000, 2_000_000, 600_000, 25_000, -96, -24,  'La app de pedir comida. Pareado directo a DASH. Ventana ya cerrada.'),
  L('ubereats',    'EATS',  'Uber Eats',        'ubereats.com',     'UBER', 'Uber Technologies, Inc.',           'delivery', 'Ethereum',  0.15,  60_000_000, 1_800_000, 500_000, 20_000, -24, 48,   'Pareado a UBER, la matriz de Uber Eats.'),
  // casual: de mesa y mantel
  L('olivegarden', 'OLIVE', 'Olive Garden',     'olivegarden.com',  'DRI',  'Darden Restaurants, Inc.',          'casual',   'Base',      0.04,  50_000_000,   400_000, 120_000,  5_000,  24, 96,   'Pareado a DRI, la matriz de Olive Garden y LongHorn.'),
  L('texasroadhouse','TXRH','Texas Roadhouse',  'texasroadhouse.com','TXRH','Texas Roadhouse, Inc.',             'casual',   'Base',      0.05,  40_000_000,   400_000, 120_000,  5_000,  72, 144,  'Carne. Pareado a TXRH.'),
  L('applebees',   'BEES',  "Applebee's",       'applebees.com',    'DIN',  'Dine Brands Global, Inc.',          'casual',   'Solana',    0.015, 60_000_000,   180_000,  60_000,  2_500,  96, 168,  "Pareado a DIN, la matriz de Applebee's e IHOP."),
  L('chilis',      'CHILI', "Chili's",          'chilis.com',       'EAT',  'Brinker International, Inc.',       'casual',   'Base',      0.04,  40_000_000,   320_000, 100_000,  4_000, 120, 192,  "Pareado a EAT, la matriz de Chili's."),
  L('cheesecake',  'CAKE',  'Cheesecake Factory','thecheesecakefactory.com','CAKE','The Cheesecake Factory Inc.','casual',   'Ethereum',  0.03,  50_000_000,   300_000, 100_000,  4_000, 144, 216,  'Pareado a CAKE.'),
  L('outback',     'OUT',   'Outback Steakhouse','outback.com',     'BLMN', "Bloomin' Brands, Inc.",             'casual',   'Solana',    0.01,  80_000_000,   160_000,  50_000,  2_000, -330, -258, "Pareado a BLMN, la matriz de Outback. Ventana ya cerrada.")
];
