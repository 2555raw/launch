/* The identity layer.
   One row per entity, and it is the only place identity is defined: name, ticker,
   exchange, sector, country and the official domain the logo is resolved from.
   Every screen reads from here, so an asset cannot end up with two different logos
   or two different names in two different places.

   Nothing in this file is market data. Prices, fundamentals and news never live
   here: they come from the data provider at runtime, or they are shown as
   unavailable. What lives here is what does not change day to day. */

export const TYPES = {
  stock: 'Acción', etf: 'ETF', index: 'Índice',
  crypto: 'Cripto', commodity: 'Materia prima', fx: 'Divisa',
};

/** Listed, tradeable entities. `domain` is the company's official site, used to
 *  resolve its official logo. `aliases` widen the search, never the identity. */
export const ASSETS = [
  // ---- US mega and large cap ----
  { id:'NVDA', ticker:'NVDA', name:'NVIDIA Corporation', short:'NVIDIA', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Semiconductores', domain:'nvidia.com', aliases:['nvidia','nvda','graficas','gpu'] },
  { id:'AAPL', ticker:'AAPL', name:'Apple Inc.', short:'Apple', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Electrónica de consumo', domain:'apple.com', aliases:['apple','manzana','iphone','mac'] },
  { id:'MSFT', ticker:'MSFT', name:'Microsoft Corporation', short:'Microsoft', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'microsoft.com', aliases:['microsoft','windows','azure','office'] },
  { id:'GOOGL', ticker:'GOOGL', name:'Alphabet Inc.', short:'Alphabet', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Comunicación', industry:'Internet', domain:'abc.xyz', aliases:['alphabet','google','googl','goog'] },
  { id:'AMZN', ticker:'AMZN', name:'Amazon.com, Inc.', short:'Amazon', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Consumo discrecional', industry:'Comercio electrónico', domain:'amazon.com', aliases:['amazon','amzn','aws'] },
  { id:'META', ticker:'META', name:'Meta Platforms, Inc.', short:'Meta', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Comunicación', industry:'Redes sociales', domain:'meta.com', aliases:['meta','facebook','fb'] },
  { id:'TSLA', ticker:'TSLA', name:'Tesla, Inc.', short:'Tesla', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Consumo discrecional', industry:'Automoción', domain:'tesla.com', aliases:['tesla','tsla','musk'] },
  { id:'NFLX', ticker:'NFLX', name:'Netflix, Inc.', short:'Netflix', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Comunicación', industry:'Streaming', domain:'netflix.com', aliases:['netflix','nflx'] },
  { id:'AMD', ticker:'AMD', name:'Advanced Micro Devices, Inc.', short:'AMD', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Semiconductores', domain:'amd.com', aliases:['amd','ryzen'] },
  { id:'INTC', ticker:'INTC', name:'Intel Corporation', short:'Intel', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Semiconductores', domain:'intel.com', aliases:['intel','intc'] },
  { id:'AVGO', ticker:'AVGO', name:'Broadcom Inc.', short:'Broadcom', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Semiconductores', domain:'broadcom.com', aliases:['broadcom','avgo'] },
  { id:'TSM', ticker:'TSM', name:'Taiwan Semiconductor Manufacturing Company', short:'TSMC', type:'stock', exchange:'NYSE', country:'Taiwán', currency:'USD', sector:'Tecnología', industry:'Semiconductores', domain:'tsmc.com', aliases:['tsmc','taiwan semiconductor','tsm'] },
  { id:'ASML', ticker:'ASML', name:'ASML Holding N.V.', short:'ASML', type:'stock', exchange:'NASDAQ', country:'Países Bajos', currency:'USD', sector:'Tecnología', industry:'Equipamiento semiconductores', domain:'asml.com', aliases:['asml','litografia'] },
  { id:'ORCL', ticker:'ORCL', name:'Oracle Corporation', short:'Oracle', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'oracle.com', aliases:['oracle','orcl'] },
  { id:'CRM', ticker:'CRM', name:'Salesforce, Inc.', short:'Salesforce', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'salesforce.com', aliases:['salesforce','crm'] },
  { id:'ADBE', ticker:'ADBE', name:'Adobe Inc.', short:'Adobe', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'adobe.com', aliases:['adobe','photoshop'] },
  { id:'PLTR', ticker:'PLTR', name:'Palantir Technologies Inc.', short:'Palantir', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'palantir.com', aliases:['palantir','pltr'] },
  { id:'UBER', ticker:'UBER', name:'Uber Technologies, Inc.', short:'Uber', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Industrial', industry:'Movilidad', domain:'uber.com', aliases:['uber'] },
  { id:'ABNB', ticker:'ABNB', name:'Airbnb, Inc.', short:'Airbnb', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Consumo discrecional', industry:'Viajes', domain:'airbnb.com', aliases:['airbnb'] },
  { id:'SPOT', ticker:'SPOT', name:'Spotify Technology S.A.', short:'Spotify', type:'stock', exchange:'NYSE', country:'Suecia', currency:'USD', sector:'Comunicación', industry:'Streaming', domain:'spotify.com', aliases:['spotify'] },
  { id:'DIS', ticker:'DIS', name:'The Walt Disney Company', short:'Disney', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Comunicación', industry:'Entretenimiento', domain:'disney.com', aliases:['disney','dis'] },
  { id:'KO', ticker:'KO', name:'The Coca-Cola Company', short:'Coca-Cola', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Consumo básico', industry:'Bebidas', domain:'coca-colacompany.com', aliases:['coca cola','cocacola','coke','ko'] },
  { id:'PEP', ticker:'PEP', name:'PepsiCo, Inc.', short:'PepsiCo', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Consumo básico', industry:'Bebidas', domain:'pepsico.com', aliases:['pepsi','pepsico'] },
  { id:'MCD', ticker:'MCD', name:"McDonald's Corporation", short:"McDonald's", type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Consumo discrecional', industry:'Restauración', domain:'mcdonalds.com', aliases:['mcdonalds','mac','mcd'] },
  { id:'NKE', ticker:'NKE', name:'NIKE, Inc.', short:'Nike', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Consumo discrecional', industry:'Textil', domain:'nike.com', aliases:['nike'] },
  { id:'V', ticker:'V', name:'Visa Inc.', short:'Visa', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Pagos', domain:'visa.com', aliases:['visa'] },
  { id:'MA', ticker:'MA', name:'Mastercard Incorporated', short:'Mastercard', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Pagos', domain:'mastercard.com', aliases:['mastercard'] },
  { id:'JPM', ticker:'JPM', name:'JPMorgan Chase & Co.', short:'JPMorgan', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Banca', domain:'jpmorganchase.com', aliases:['jpmorgan','jp morgan','chase'] },
  { id:'BRK.B', ticker:'BRK.B', name:'Berkshire Hathaway Inc.', short:'Berkshire', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Conglomerado', domain:'berkshirehathaway.com', aliases:['berkshire','buffett'] },
  { id:'XOM', ticker:'XOM', name:'Exxon Mobil Corporation', short:'ExxonMobil', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Energía', industry:'Petróleo y gas', domain:'exxonmobil.com', aliases:['exxon','xom'] },
  { id:'LLY', ticker:'LLY', name:'Eli Lilly and Company', short:'Eli Lilly', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Salud', industry:'Farmacéutica', domain:'lilly.com', aliases:['eli lilly','lilly'] },
  { id:'JNJ', ticker:'JNJ', name:'Johnson & Johnson', short:'J&J', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Salud', industry:'Farmacéutica', domain:'jnj.com', aliases:['johnson','jnj'] },
  { id:'WMT', ticker:'WMT', name:'Walmart Inc.', short:'Walmart', type:'stock', exchange:'NYSE', country:'Estados Unidos', currency:'USD', sector:'Consumo básico', industry:'Distribución', domain:'walmart.com', aliases:['walmart'] },
  { id:'COIN', ticker:'COIN', name:'Coinbase Global, Inc.', short:'Coinbase', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Exchange cripto', domain:'coinbase.com', aliases:['coinbase','coin'] },
  { id:'HOOD', ticker:'HOOD', name:'Robinhood Markets, Inc.', short:'Robinhood', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Financiero', industry:'Bróker', domain:'robinhood.com', aliases:['robinhood','hood'] },
  { id:'MSTR', ticker:'MSTR', name:'Strategy Inc.', short:'Strategy', type:'stock', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Tecnología', industry:'Software', domain:'strategy.com', aliases:['microstrategy','strategy','mstr'] },

  // ---- Europa ----
  { id:'SAN.MC', ticker:'SAN.MC', name:'Banco Santander, S.A.', short:'Santander', type:'stock', exchange:'BME', country:'España', currency:'EUR', sector:'Financiero', industry:'Banca', domain:'santander.com', aliases:['santander','san'] },
  { id:'ITX.MC', ticker:'ITX.MC', name:'Industria de Diseño Textil, S.A.', short:'Inditex', type:'stock', exchange:'BME', country:'España', currency:'EUR', sector:'Consumo discrecional', industry:'Textil', domain:'inditex.com', aliases:['inditex','zara','itx'] },
  { id:'IBE.MC', ticker:'IBE.MC', name:'Iberdrola, S.A.', short:'Iberdrola', type:'stock', exchange:'BME', country:'España', currency:'EUR', sector:'Utilities', industry:'Eléctrica', domain:'iberdrola.com', aliases:['iberdrola','ibe'] },
  { id:'BBVA.MC', ticker:'BBVA.MC', name:'Banco Bilbao Vizcaya Argentaria, S.A.', short:'BBVA', type:'stock', exchange:'BME', country:'España', currency:'EUR', sector:'Financiero', industry:'Banca', domain:'bbva.com', aliases:['bbva'] },
  { id:'MC.PA', ticker:'MC.PA', name:'LVMH Moët Hennessy Louis Vuitton', short:'LVMH', type:'stock', exchange:'Euronext París', country:'Francia', currency:'EUR', sector:'Consumo discrecional', industry:'Lujo', domain:'lvmh.com', aliases:['lvmh','louis vuitton'] },
  { id:'SAP.DE', ticker:'SAP.DE', name:'SAP SE', short:'SAP', type:'stock', exchange:'XETRA', country:'Alemania', currency:'EUR', sector:'Tecnología', industry:'Software', domain:'sap.com', aliases:['sap'] },

  // ---- ETFs ----
  { id:'SPY', ticker:'SPY', name:'SPDR S&P 500 ETF Trust', short:'SPY', type:'etf', exchange:'NYSE Arca', country:'Estados Unidos', currency:'USD', sector:'Renta variable EEUU', industry:'ETF índice', domain:'ssga.com', aliases:['spy','sp500 etf'] },
  { id:'VOO', ticker:'VOO', name:'Vanguard S&P 500 ETF', short:'VOO', type:'etf', exchange:'NYSE Arca', country:'Estados Unidos', currency:'USD', sector:'Renta variable EEUU', industry:'ETF índice', domain:'vanguard.com', aliases:['voo','vanguard sp500'] },
  { id:'QQQ', ticker:'QQQ', name:'Invesco QQQ Trust', short:'QQQ', type:'etf', exchange:'NASDAQ', country:'Estados Unidos', currency:'USD', sector:'Renta variable EEUU', industry:'ETF índice', domain:'invesco.com', aliases:['qqq','nasdaq etf'] },
  { id:'VWCE.DE', ticker:'VWCE.DE', name:'Vanguard FTSE All-World UCITS ETF', short:'VWCE', type:'etf', exchange:'XETRA', country:'Irlanda', currency:'EUR', sector:'Renta variable global', industry:'ETF índice', domain:'vanguard.com', aliases:['vwce','all world'] },
  { id:'IWDA.AS', ticker:'IWDA.AS', name:'iShares Core MSCI World UCITS ETF', short:'IWDA', type:'etf', exchange:'Euronext Ámsterdam', country:'Irlanda', currency:'EUR', sector:'Renta variable global', industry:'ETF índice', domain:'ishares.com', aliases:['iwda','msci world'] },

  // ---- Índices ----
  { id:'^GSPC', ticker:'^GSPC', name:'S&P 500', short:'S&P 500', type:'index', exchange:'Índice', country:'Estados Unidos', currency:'USD', sector:'Índice', industry:'Amplio', domain:'spglobal.com', aliases:['sp500','s&p 500','spx'] },
  { id:'^IXIC', ticker:'^IXIC', name:'NASDAQ Composite', short:'NASDAQ', type:'index', exchange:'Índice', country:'Estados Unidos', currency:'USD', sector:'Índice', industry:'Amplio', domain:'nasdaq.com', aliases:['nasdaq','ixic'] },
  { id:'^DJI', ticker:'^DJI', name:'Dow Jones Industrial Average', short:'Dow Jones', type:'index', exchange:'Índice', country:'Estados Unidos', currency:'USD', sector:'Índice', industry:'Amplio', domain:'spglobal.com', aliases:['dow','dow jones','dji'] },
  { id:'^IBEX', ticker:'^IBEX', name:'IBEX 35', short:'IBEX 35', type:'index', exchange:'Índice', country:'España', currency:'EUR', sector:'Índice', industry:'Amplio', domain:'bolsasymercados.es', aliases:['ibex','ibex35'] },
  { id:'^GDAXI', ticker:'^GDAXI', name:'DAX', short:'DAX', type:'index', exchange:'Índice', country:'Alemania', currency:'EUR', sector:'Índice', industry:'Amplio', domain:'deutsche-boerse.com', aliases:['dax'] },

  // ---- Cripto ----
  { id:'BTC', ticker:'BTC-USD', name:'Bitcoin', short:'Bitcoin', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Moneda', domain:'bitcoin.org', coingecko:'bitcoin', aliases:['bitcoin','btc'] },
  { id:'ETH', ticker:'ETH-USD', name:'Ethereum', short:'Ethereum', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Contratos inteligentes', domain:'ethereum.org', coingecko:'ethereum', aliases:['ethereum','eth','ether'] },
  { id:'SOL', ticker:'SOL-USD', name:'Solana', short:'Solana', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Contratos inteligentes', domain:'solana.com', coingecko:'solana', aliases:['solana','sol'] },
  { id:'XRP', ticker:'XRP-USD', name:'XRP', short:'XRP', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Pagos', domain:'ripple.com', coingecko:'ripple', aliases:['xrp','ripple'] },
  { id:'DOGE', ticker:'DOGE-USD', name:'Dogecoin', short:'Dogecoin', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Moneda', domain:'dogecoin.com', coingecko:'dogecoin', aliases:['dogecoin','doge'] },
  { id:'ADA', ticker:'ADA-USD', name:'Cardano', short:'Cardano', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Contratos inteligentes', domain:'cardano.org', coingecko:'cardano', aliases:['cardano','ada'] },
  { id:'LINK', ticker:'LINK-USD', name:'Chainlink', short:'Chainlink', type:'crypto', exchange:'Cripto', country:'Global', currency:'USD', sector:'Cripto', industry:'Oráculos', domain:'chain.link', coingecko:'chainlink', aliases:['chainlink','link'] },

  // ---- Materias primas ----
  { id:'GC=F', ticker:'GC=F', name:'Oro', short:'Oro', type:'commodity', exchange:'COMEX', country:'Global', currency:'USD', sector:'Metales preciosos', industry:'Futuro', domain:'cmegroup.com', aliases:['oro','gold','xau'] },
  { id:'SI=F', ticker:'SI=F', name:'Plata', short:'Plata', type:'commodity', exchange:'COMEX', country:'Global', currency:'USD', sector:'Metales preciosos', industry:'Futuro', domain:'cmegroup.com', aliases:['plata','silver','xag'] },
  { id:'CL=F', ticker:'CL=F', name:'Petróleo WTI', short:'WTI', type:'commodity', exchange:'NYMEX', country:'Global', currency:'USD', sector:'Energía', industry:'Futuro', domain:'cmegroup.com', aliases:['petroleo','wti','crudo','oil'] },
  { id:'NG=F', ticker:'NG=F', name:'Gas natural', short:'Gas natural', type:'commodity', exchange:'NYMEX', country:'Global', currency:'USD', sector:'Energía', industry:'Futuro', domain:'cmegroup.com', aliases:['gas','natural gas'] },

  // ---- Divisas ----
  { id:'EURUSD', ticker:'EURUSD', name:'Euro / Dólar estadounidense', short:'EUR/USD', type:'fx', exchange:'Forex', country:'Global', currency:'USD', sector:'Divisas', industry:'Par mayor', domain:'ecb.europa.eu', aliases:['eurusd','euro dolar','eur usd'] },
  { id:'GBPUSD', ticker:'GBPUSD', name:'Libra esterlina / Dólar estadounidense', short:'GBP/USD', type:'fx', exchange:'Forex', country:'Global', currency:'USD', sector:'Divisas', industry:'Par mayor', domain:'bankofengland.co.uk', aliases:['gbpusd','libra'] },
  { id:'USDJPY', ticker:'USDJPY', name:'Dólar estadounidense / Yen japonés', short:'USD/JPY', type:'fx', exchange:'Forex', country:'Global', currency:'JPY', sector:'Divisas', industry:'Par mayor', domain:'boj.or.jp', aliases:['usdjpy','yen'] },
];

/** Brands that are not listed on their own: searching them has to work and has to
 *  show the brand's own official logo, while the tradeable entity is the parent. */
export const BRANDS = [
  { name:'YouTube', domain:'youtube.com', parent:'GOOGL', note:'Marca de Alphabet', aliases:['youtube','yt'] },
  { name:'Google', domain:'google.com', parent:'GOOGL', note:'Marca de Alphabet', aliases:['google'] },
  { name:'Android', domain:'android.com', parent:'GOOGL', note:'Marca de Alphabet', aliases:['android'] },
  { name:'Instagram', domain:'instagram.com', parent:'META', note:'Marca de Meta Platforms', aliases:['instagram','ig'] },
  { name:'WhatsApp', domain:'whatsapp.com', parent:'META', note:'Marca de Meta Platforms', aliases:['whatsapp'] },
  { name:'Facebook', domain:'facebook.com', parent:'META', note:'Marca de Meta Platforms', aliases:['facebook','fb'] },
  { name:'AWS', domain:'aws.amazon.com', parent:'AMZN', note:'División de Amazon', aliases:['aws','amazon web services'] },
  { name:'Twitch', domain:'twitch.tv', parent:'AMZN', note:'Marca de Amazon', aliases:['twitch'] },
  { name:'Xbox', domain:'xbox.com', parent:'MSFT', note:'Marca de Microsoft', aliases:['xbox'] },
  { name:'LinkedIn', domain:'linkedin.com', parent:'MSFT', note:'Marca de Microsoft', aliases:['linkedin'] },
  { name:'GitHub', domain:'github.com', parent:'MSFT', note:'Marca de Microsoft', aliases:['github'] },
  { name:'Zara', domain:'zara.com', parent:'ITX.MC', note:'Marca de Inditex', aliases:['zara'] },
  { name:'Louis Vuitton', domain:'louisvuitton.com', parent:'MC.PA', note:'Marca de LVMH', aliases:['louis vuitton','lv'] },
  { name:'Pixar', domain:'pixar.com', parent:'DIS', note:'Estudio de Disney', aliases:['pixar'] },
  { name:'Marvel', domain:'marvel.com', parent:'DIS', note:'Marca de Disney', aliases:['marvel'] },
];

const BY_ID = new Map(ASSETS.map(a => [a.id.toUpperCase(), a]));
const BY_TICKER = new Map(ASSETS.map(a => [a.ticker.toUpperCase(), a]));

export function getAsset(id) {
  if (!id) return null;
  const k = String(id).toUpperCase();
  return BY_ID.get(k) || BY_TICKER.get(k) || null;
}
export function byType(type) { return ASSETS.filter(a => a.type === type); }
export function allAssets() { return ASSETS.slice(); }
