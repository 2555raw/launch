/* The playground's opening cast: original coins, each paired with a currency.
 * [name, ticker, currency, description, how full the crowd gets the curve] */
export const DEMO_COINS: Array<[string, string, string, string, number]> = [
  ['Tokyo Comet', 'COMET', 'JPY', 'A bright tail over Shibuya, priced in yen.', 0.55],
  ['Samba Nebula', 'NEBULA', 'BRL', 'A carnival of gas and dust that only moves in reais.', 0.82],
  ['Masala Moon', 'MOON', 'INR', 'Full every night, very spicy, paid in rupees.', 0.64],
  ['Paris Pulsar', 'PULSAR', 'EUR', 'Blinks once a second from the top of a bakery.', 0.9],
  ['Lagos Orbit', 'ORBIT', 'NGN', 'Round and round, denominated in naira.', 0.71],
  ['Seoul Satellite', 'SAT', 'KRW', 'Always overhead on the way to the subway.', 0.46],
  ['Mariachi Meteor', 'METEOR', 'MXN', 'Full band, bright streak, paid in pesos.', 0.77],
  ['Teatime Telescope', 'SCOPE', 'GBP', 'Looking up since four o’clock.', 0.38],
  ['Alpine Aurora', 'AURORA', 'CHF', 'Green curtains, very precise. Swiss francs only.', 0.52],
  ['Bosphorus Quasar', 'QUASAR', 'TRY', 'The brightest thing for a billion lira.', 0.31],
  ['Pho Photon', 'PHOTON', 'VND', 'Light from a bowl that never cools.', 0.6],
  ['Braai Blackhole', 'BHOLE', 'ZAR', 'Everything goes in, nothing comes back.', 0.43],
  ['Golden Galaxy', 'GALAXY', 'XAU', 'A hundred billion stars, measured in ounces.', 0.5],
  ['Buck Supernova', 'NOVA', 'USD', 'Burned so bright it collapsed into its own pool.', 1],
  ['Outback Stardust', 'DUST', 'AUD', 'Settles on everything, once a decade.', 0.68],
  ['Maple Moonbeam', 'BEAM', 'CAD', 'Half light, half syrup.', 0.27],
];

/** Coins the playground's crowd launches later, one every few minutes. */
export const LATE_COINS: Array<[string, string, string, string]> = [
  ['Cairo Constellation', 'PHARAOH', 'EGP', 'Stars lined up over the pyramids.'],
  ['Nairobi Nova', 'KNOVA', 'KES', 'A new light over the savanna.'],
  ['Manila Milkyway', 'MILKY', 'PHP', 'The whole band, in pesos.'],
  ['Jakarta Jupiter', 'JOVE', 'IDR', 'Big, slow, paid in rupiah.'],
  ['Bangkok Big Bang', 'BANG', 'THB', 'It all started on a tuk-tuk roof.'],
  ['Warsaw Wormhole', 'WORM', 'PLN', 'A shortcut to the złoty.'],
  ['Andes Asteroid', 'ROCA', 'COP', 'A mountain from space, in pesos colombianos.'],
  ['Silver Saturn', 'RINGS', 'XAG', 'Shiny rings, sold by the ounce.'],
];
