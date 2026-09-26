/* The playground's opening cast: original coins, each paired with a currency.
 * [name, ticker, currency, description, how full the crowd gets the curve] */
export const DEMO_COINS: Array<[string, string, string, string, number]> = [
  ['Tokyo Drizzle', 'DRIZZLE', 'JPY', 'Light rain over Shibuya, priced in yen.', 0.55],
  ['Samba Squall', 'SQUALL', 'BRL', 'A carnival gust that only moves in reais.', 0.82],
  ['Monsoon Masala', 'MASALA', 'INR', 'Four months of rain, one very spicy coin.', 0.64],
  ['Baguette Bolt', 'BOLT', 'EUR', 'Struck by lightning outside a Paris bakery.', 0.9],
  ['Lagos Thunder', 'THUNDA', 'NGN', 'Loud, bright and denominated in naira.', 0.71],
  ['Seoul Shower', 'SHOWER', 'KRW', 'A quick one on the way to the subway.', 0.46],
  ['Mariachi Mist', 'MIST', 'MXN', 'Fine mist, full band, paid in pesos.', 0.77],
  ['Teatime Tempest', 'TEMPEST', 'GBP', 'Brewing since four o’clock.', 0.38],
  ['Alpine Hail', 'HAIL', 'CHF', 'Small, cold, very precise. Swiss francs only.', 0.52],
  ['Bosphorus Puddle', 'PUDDLE', 'TRY', 'Every step splashes lira.', 0.31],
  ['Pho Flood', 'FLOOD', 'VND', 'A bowl that overflowed into the street.', 0.6],
  ['Braai Rain', 'BRAAI', 'ZAR', 'Never cancels the barbecue.', 0.43],
  ['Nugget Rain', 'NUGGET', 'XAU', 'It rains gold, measured in ounces.', 0.5],
  ['Buck Storm', 'BUCK', 'USD', 'Rained so hard it flooded into its own pool.', 1],
  ['Outback Downpour', 'OUTBACK', 'AUD', 'Once a decade, all at once.', 0.68],
  ['Maple Sleet', 'SLEET', 'CAD', 'Half snow, half syrup.', 0.27],
];

/** Coins the playground's crowd launches later, one every few minutes. */
export const LATE_COINS: Array<[string, string, string, string]> = [
  ['Cairo Cloudburst', 'BURST', 'EGP', 'Rare, sudden, unforgettable.'],
  ['Nairobi Nimbus', 'NIMBUS', 'KES', 'A tall cloud over the savanna.'],
  ['Manila Monsoon', 'HABAGAT', 'PHP', 'The southwest wind, in pesos.'],
  ['Jakarta Jet', 'JETSTRM', 'IDR', 'Fast air, slow rupiah.'],
  ['Bangkok Breeze', 'BREEZE', 'THB', 'Warm rain on a tuk-tuk roof.'],
  ['Warsaw Wet', 'WET', 'PLN', 'Grey sky, green złoty.'],
  ['Andes Aguacero', 'AGUACERO', 'COP', 'A mountain downpour in pesos colombianos.'],
  ['Silver Sleet', 'SILVER', 'XAG', 'Cold, shiny, sold by the ounce.'],
];
