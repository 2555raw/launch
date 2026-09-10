/* The identity layer.
   One row per asset, and it is the only place identity is defined: symbol,
   name, class, brand colour and the official domain the logo is resolved from.
   Every screen reads from here, so an asset cannot end up with two different
   logos or two different names in two different places.

   There is no market data here. A price never lives in this file: the feed
   produces it at runtime.

   The rules of the visual identity, and none of them is skipped:
   - `domain` is the entity's official site. Its logo is resolved from there at
     runtime, never drawn, never approximated, and never copied into the repo.
   - `color` is the entity's real brand colour, the one it uses itself.
   - A metal has no company logo because it is not a company. Its mark is its
     official chemical symbol in the real colour of the metal, and `venue` names
     the market that prices it, which does have a logo of its own. */

export const CLASSES = {
  stock:  { id:'stock',  label:'Stock',  plural:'Stocks' },
  metal:  { id:'metal',  label:'Metal',  plural:'Metals' },
  crypto: { id:'crypto', label:'Crypto', plural:'Crypto' },
  etf:    { id:'etf',    label:'ETF',    plural:'ETFs' },
};

export const ASSETS = [
  // ---------- Stocks: technology and semiconductors ----------
  { id:'NVDA', symbol:'NVDA', name:'NVIDIA Corporation', short:'NVIDIA', class:'stock', domain:'nvidia.com', color:'#76B900', venue:'NASDAQ', sector:'Semiconductors', aliases:['nvidia','gpu','graphics'] },
  { id:'AAPL', symbol:'AAPL', name:'Apple Inc.', short:'Apple', class:'stock', domain:'apple.com', color:'#1D1D1F', venue:'NASDAQ', sector:'Consumer electronics', aliases:['apple','iphone','mac'] },
  { id:'MSFT', symbol:'MSFT', name:'Microsoft Corporation', short:'Microsoft', class:'stock', domain:'microsoft.com', color:'#00A4EF', venue:'NASDAQ', sector:'Software', aliases:['microsoft','windows','azure','copilot'] },
  { id:'GOOGL', symbol:'GOOGL', name:'Alphabet Inc.', short:'Alphabet', class:'stock', domain:'abc.xyz', color:'#4285F4', venue:'NASDAQ', sector:'Internet', aliases:['alphabet','google','goog','youtube'] },
  { id:'AMZN', symbol:'AMZN', name:'Amazon.com, Inc.', short:'Amazon', class:'stock', domain:'amazon.com', color:'#FF9900', venue:'NASDAQ', sector:'E-commerce', aliases:['amazon','aws'] },
  { id:'META', symbol:'META', name:'Meta Platforms, Inc.', short:'Meta', class:'stock', domain:'meta.com', color:'#0064E0', venue:'NASDAQ', sector:'Social networks', aliases:['meta','facebook','instagram','whatsapp'] },
  { id:'TSLA', symbol:'TSLA', name:'Tesla, Inc.', short:'Tesla', class:'stock', domain:'tesla.com', color:'#E82127', venue:'NASDAQ', sector:'Automotive', aliases:['tesla','musk'] },
  { id:'AMD', symbol:'AMD', name:'Advanced Micro Devices, Inc.', short:'AMD', class:'stock', domain:'amd.com', color:'#ED1C24', venue:'NASDAQ', sector:'Semiconductors', aliases:['amd','ryzen','radeon'] },
  { id:'INTC', symbol:'INTC', name:'Intel Corporation', short:'Intel', class:'stock', domain:'intel.com', color:'#0068B5', venue:'NASDAQ', sector:'Semiconductors', aliases:['intel'] },
  { id:'AVGO', symbol:'AVGO', name:'Broadcom Inc.', short:'Broadcom', class:'stock', domain:'broadcom.com', color:'#CC092F', venue:'NASDAQ', sector:'Semiconductors', aliases:['broadcom'] },
  { id:'TSM', symbol:'TSM', name:'Taiwan Semiconductor Manufacturing Company', short:'TSMC', class:'stock', domain:'tsmc.com', color:'#C8102E', venue:'NYSE', sector:'Semiconductors', aliases:['tsmc','taiwan semiconductor'] },
  { id:'ASML', symbol:'ASML', name:'ASML Holding N.V.', short:'ASML', class:'stock', domain:'asml.com', color:'#0B5FA5', venue:'NASDAQ', sector:'Semiconductor equipment', aliases:['asml','lithography'] },
  { id:'ORCL', symbol:'ORCL', name:'Oracle Corporation', short:'Oracle', class:'stock', domain:'oracle.com', color:'#C74634', venue:'NYSE', sector:'Software', aliases:['oracle'] },
  { id:'CRM', symbol:'CRM', name:'Salesforce, Inc.', short:'Salesforce', class:'stock', domain:'salesforce.com', color:'#00A1E0', venue:'NYSE', sector:'Software', aliases:['salesforce'] },
  { id:'ADBE', symbol:'ADBE', name:'Adobe Inc.', short:'Adobe', class:'stock', domain:'adobe.com', color:'#EB1000', venue:'NASDAQ', sector:'Software', aliases:['adobe','photoshop'] },
  { id:'PLTR', symbol:'PLTR', name:'Palantir Technologies Inc.', short:'Palantir', class:'stock', domain:'palantir.com', color:'#0F1114', venue:'NASDAQ', sector:'Software', aliases:['palantir'] },
  { id:'NFLX', symbol:'NFLX', name:'Netflix, Inc.', short:'Netflix', class:'stock', domain:'netflix.com', color:'#E50914', venue:'NASDAQ', sector:'Streaming', aliases:['netflix'] },
  { id:'SPOT', symbol:'SPOT', name:'Spotify Technology S.A.', short:'Spotify', class:'stock', domain:'spotify.com', color:'#1DB954', venue:'NYSE', sector:'Streaming', aliases:['spotify'] },
  { id:'UBER', symbol:'UBER', name:'Uber Technologies, Inc.', short:'Uber', class:'stock', domain:'uber.com', color:'#0C0C0C', venue:'NYSE', sector:'Mobility', aliases:['uber'] },
  { id:'ABNB', symbol:'ABNB', name:'Airbnb, Inc.', short:'Airbnb', class:'stock', domain:'airbnb.com', color:'#FF5A5F', venue:'NASDAQ', sector:'Travel', aliases:['airbnb'] },
  { id:'SHOP', symbol:'SHOP', name:'Shopify Inc.', short:'Shopify', class:'stock', domain:'shopify.com', color:'#95BF47', venue:'NASDAQ', sector:'E-commerce', aliases:['shopify'] },

  // ---------- Stocks: consumer, health, industry ----------
  { id:'DIS', symbol:'DIS', name:'The Walt Disney Company', short:'Disney', class:'stock', domain:'disney.com', color:'#113CCF', venue:'NYSE', sector:'Entertainment', aliases:['disney','pixar','marvel'] },
  { id:'KO', symbol:'KO', name:'The Coca-Cola Company', short:'Coca-Cola', class:'stock', domain:'coca-colacompany.com', color:'#F40009', venue:'NYSE', sector:'Beverages', aliases:['coca cola','cocacola','coke'] },
  { id:'PEP', symbol:'PEP', name:'PepsiCo, Inc.', short:'PepsiCo', class:'stock', domain:'pepsico.com', color:'#004B93', venue:'NASDAQ', sector:'Beverages', aliases:['pepsi','pepsico'] },
  { id:'MCD', symbol:'MCD', name:"McDonald's Corporation", short:"McDonald's", class:'stock', domain:'mcdonalds.com', color:'#FFC72C', venue:'NYSE', sector:'Restaurants', aliases:['mcdonalds','mcdonald','burgers'] },
  { id:'SBUX', symbol:'SBUX', name:'Starbucks Corporation', short:'Starbucks', class:'stock', domain:'starbucks.com', color:'#00704A', venue:'NASDAQ', sector:'Restaurants', aliases:['starbucks'] },
  { id:'NKE', symbol:'NKE', name:'NIKE, Inc.', short:'Nike', class:'stock', domain:'nike.com', color:'#111111', venue:'NYSE', sector:'Apparel', aliases:['nike'] },
  { id:'WMT', symbol:'WMT', name:'Walmart Inc.', short:'Walmart', class:'stock', domain:'walmart.com', color:'#0071CE', venue:'NYSE', sector:'Retail', aliases:['walmart'] },
  { id:'LLY', symbol:'LLY', name:'Eli Lilly and Company', short:'Eli Lilly', class:'stock', domain:'lilly.com', color:'#E1261C', venue:'NYSE', sector:'Pharmaceuticals', aliases:['eli lilly','lilly'] },
  { id:'JNJ', symbol:'JNJ', name:'Johnson & Johnson', short:'Johnson & Johnson', class:'stock', domain:'jnj.com', color:'#EB1700', venue:'NYSE', sector:'Pharmaceuticals', aliases:['johnson','jnj'] },
  { id:'BA', symbol:'BA', name:'The Boeing Company', short:'Boeing', class:'stock', domain:'boeing.com', color:'#0039A6', venue:'NYSE', sector:'Aerospace', aliases:['boeing'] },
  { id:'CAT', symbol:'CAT', name:'Caterpillar Inc.', short:'Caterpillar', class:'stock', domain:'caterpillar.com', color:'#FFCD11', venue:'NYSE', sector:'Machinery', aliases:['caterpillar','cat'] },

  // ---------- Stocks: finance and energy ----------
  { id:'V', symbol:'V', name:'Visa Inc.', short:'Visa', class:'stock', domain:'visa.com', color:'#1A1F71', venue:'NYSE', sector:'Payments', aliases:['visa'] },
  { id:'MA', symbol:'MA', name:'Mastercard Incorporated', short:'Mastercard', class:'stock', domain:'mastercard.com', color:'#EB001B', venue:'NYSE', sector:'Payments', aliases:['mastercard'] },
  { id:'JPM', symbol:'JPM', name:'JPMorgan Chase & Co.', short:'JPMorgan', class:'stock', domain:'jpmorganchase.com', color:'#005EB8', venue:'NYSE', sector:'Banking', aliases:['jpmorgan','jp morgan','chase'] },
  { id:'GS', symbol:'GS', name:'The Goldman Sachs Group, Inc.', short:'Goldman Sachs', class:'stock', domain:'goldmansachs.com', color:'#6BA4D8', venue:'NYSE', sector:'Investment banking', aliases:['goldman','goldman sachs'] },
  { id:'COIN', symbol:'COIN', name:'Coinbase Global, Inc.', short:'Coinbase', class:'stock', domain:'coinbase.com', color:'#0052FF', venue:'NASDAQ', sector:'Crypto exchange', aliases:['coinbase'] },
  { id:'HOOD', symbol:'HOOD', name:'Robinhood Markets, Inc.', short:'Robinhood', class:'stock', domain:'robinhood.com', color:'#00C805', venue:'NASDAQ', sector:'Brokerage', aliases:['robinhood','hood'] },
  { id:'MSTR', symbol:'MSTR', name:'Strategy Inc.', short:'Strategy', class:'stock', domain:'strategy.com', color:'#F5811F', venue:'NASDAQ', sector:'Bitcoin treasury', aliases:['microstrategy','strategy','saylor'] },
  { id:'XOM', symbol:'XOM', name:'Exxon Mobil Corporation', short:'ExxonMobil', class:'stock', domain:'exxonmobil.com', color:'#D62B1F', venue:'NYSE', sector:'Oil and gas', aliases:['exxon','exxonmobil'] },

  // ---------- Stocks: Europe ----------
  { id:'SAN', symbol:'SAN', name:'Banco Santander, S.A.', short:'Santander', class:'stock', domain:'santander.com', color:'#EC0000', venue:'BME', sector:'Banking', aliases:['santander'] },
  { id:'BBVA', symbol:'BBVA', name:'Banco Bilbao Vizcaya Argentaria, S.A.', short:'BBVA', class:'stock', domain:'bbva.com', color:'#1464A5', venue:'BME', sector:'Banking', aliases:['bbva'] },
  { id:'ITX', symbol:'ITX', name:'Industria de Diseno Textil, S.A. (Inditex)', short:'Inditex', class:'stock', domain:'inditex.com', color:'#1C1C1C', venue:'BME', sector:'Apparel', aliases:['inditex','zara'] },
  { id:'IBE', symbol:'IBE', name:'Iberdrola, S.A.', short:'Iberdrola', class:'stock', domain:'iberdrola.com', color:'#8CC63E', venue:'BME', sector:'Utilities', aliases:['iberdrola'] },
  { id:'MC', symbol:'MC', name:'LVMH Moet Hennessy Louis Vuitton SE', short:'LVMH', class:'stock', domain:'lvmh.com', color:'#3A3226', venue:'Euronext Paris', sector:'Luxury', aliases:['lvmh','louis vuitton','vuitton'] },
  { id:'SAP', symbol:'SAP', name:'SAP SE', short:'SAP', class:'stock', domain:'sap.com', color:'#0AA8E1', venue:'XETRA', sector:'Software', aliases:['sap'] },
  { id:'NOVO', symbol:'NOVO', name:'Novo Nordisk A/S', short:'Novo Nordisk', class:'stock', domain:'novonordisk.com', color:'#001965', venue:'Nasdaq Copenhague', sector:'Pharmaceuticals', aliases:['novo nordisk','novo','ozempic'] },
  { id:'FER', symbol:'FER', name:'Ferrari N.V.', short:'Ferrari', class:'stock', domain:'ferrari.com', color:'#FF2800', venue:'Borsa Italiana', sector:'Automotive', aliases:['ferrari','race'] },

  // ---------- Metals ----------
  // No company logo, because these are not companies. The mark is the official
  // chemical symbol in the real colour of the metal, and `venue` is the market
  // that sets the price.
  { id:'XAU', symbol:'XAU', element:'Au', name:'Gold', short:'Gold', class:'metal', color:'#D4AF37', venue:'LBMA', venueDomain:'lbma.org.uk', unit:'troy ounce', sector:'Precious metal', aliases:['gold','xau','au','bullion'] },
  { id:'XAG', symbol:'XAG', element:'Ag', name:'Silver', short:'Silver', class:'metal', color:'#A7ADB5', venue:'LBMA', venueDomain:'lbma.org.uk', unit:'troy ounce', sector:'Precious metal', aliases:['silver','xag','ag'] },
  { id:'XPT', symbol:'XPT', element:'Pt', name:'Platinum', short:'Platinum', class:'metal', color:'#7F94A0', venue:'LPPM', venueDomain:'lppm.com', unit:'troy ounce', sector:'Precious metal', aliases:['platinum','xpt','pt'] },
  { id:'XPD', symbol:'XPD', element:'Pd', name:'Palladium', short:'Palladium', class:'metal', color:'#63727C', venue:'LPPM', venueDomain:'lppm.com', unit:'troy ounce', sector:'Precious metal', aliases:['palladium','xpd','pd'] },
  { id:'XCU', symbol:'XCU', element:'Cu', name:'Copper', short:'Copper', class:'metal', color:'#B87333', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['copper','xcu','cu'] },
  { id:'XAL', symbol:'XAL', element:'Al', name:'Aluminium', short:'Aluminium', class:'metal', color:'#8E9AA3', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['aluminium','aluminum','xal','al'] },
  { id:'XNI', symbol:'XNI', element:'Ni', name:'Nickel', short:'Nickel', class:'metal', color:'#6E7B6B', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['nickel','xni','ni'] },
  { id:'XZN', symbol:'XZN', element:'Zn', name:'Zinc', short:'Zinc', class:'metal', color:'#5F6B72', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['zinc','xzn','zn'] },
  { id:'XSN', symbol:'XSN', element:'Sn', name:'Tin', short:'Tin', class:'metal', color:'#8A8D91', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['tin','xsn','sn'] },
  { id:'XPB', symbol:'XPB', element:'Pb', name:'Lead', short:'Lead', class:'metal', color:'#4E5459', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Industrial metal', aliases:['lead','xpb','pb'] },
  { id:'XLI', symbol:'XLI', element:'Li', name:'Lithium', short:'Lithium', class:'metal', color:'#C9CDD2', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Battery metal', aliases:['lithium','xli','li'] },
  { id:'XCO', symbol:'XCO', element:'Co', name:'Cobalt', short:'Cobalt', class:'metal', color:'#3D6EA5', venue:'LME', venueDomain:'lme.com', unit:'tonne', sector:'Battery metal', aliases:['cobalt','xco','co'] },

  // ---------- Crypto ----------
  { id:'BTC', symbol:'BTC', name:'Bitcoin', short:'Bitcoin', class:'crypto', domain:'bitcoin.org', color:'#F7931A', venue:'Cripto', sector:'Currency', aliases:['bitcoin','btc'] },
  { id:'ETH', symbol:'ETH', name:'Ethereum', short:'Ethereum', class:'crypto', domain:'ethereum.org', color:'#627EEA', venue:'Cripto', sector:'Smart contracts', aliases:['ethereum','eth','ether'] },
  { id:'SOL', symbol:'SOL', name:'Solana', short:'Solana', class:'crypto', domain:'solana.com', color:'#14B892', venue:'Cripto', sector:'Smart contracts', aliases:['solana','sol'] },
  { id:'XRP', symbol:'XRP', name:'XRP', short:'XRP', class:'crypto', domain:'ripple.com', color:'#23292F', venue:'Cripto', sector:'Payments', aliases:['xrp','ripple'] },
  { id:'DOGE', symbol:'DOGE', name:'Dogecoin', short:'Dogecoin', class:'crypto', domain:'dogecoin.com', color:'#C2A633', venue:'Cripto', sector:'Currency', aliases:['dogecoin','doge'] },
  { id:'AVAX', symbol:'AVAX', name:'Avalanche', short:'Avalanche', class:'crypto', domain:'avax.network', color:'#E84142', venue:'Cripto', sector:'Smart contracts', aliases:['avalanche','avax'] },
  { id:'LINK', symbol:'LINK', name:'Chainlink', short:'Chainlink', class:'crypto', domain:'chain.link', color:'#2A5ADA', venue:'Cripto', sector:'Oracles', aliases:['chainlink','link'] },
  { id:'ADA', symbol:'ADA', name:'Cardano', short:'Cardano', class:'crypto', domain:'cardano.org', color:'#0033AD', venue:'Cripto', sector:'Smart contracts', aliases:['cardano','ada'] },

  // ---------- ETFs ----------
  { id:'SPY', symbol:'SPY', name:'SPDR S&P 500 ETF Trust', short:'SPY', class:'etf', domain:'ssga.com', color:'#0074C8', venue:'NYSE Arca', sector:'US equity', aliases:['spy','sp500','s&p 500'] },
  { id:'QQQ', symbol:'QQQ', name:'Invesco QQQ Trust', short:'QQQ', class:'etf', domain:'invesco.com', color:'#003C71', venue:'NASDAQ', sector:'US equity', aliases:['qqq','nasdaq 100'] },
  { id:'VOO', symbol:'VOO', name:'Vanguard S&P 500 ETF', short:'VOO', class:'etf', domain:'vanguard.com', color:'#96151D', venue:'NYSE Arca', sector:'US equity', aliases:['voo','vanguard'] },
  { id:'GLD', symbol:'GLD', name:'SPDR Gold Shares', short:'GLD', class:'etf', domain:'ssga.com', color:'#C9A227', venue:'NYSE Arca', sector:'Physical gold', aliases:['gld','gold etf'] },
  { id:'SLV', symbol:'SLV', name:'iShares Silver Trust', short:'SLV', class:'etf', domain:'ishares.com', color:'#9AA1A8', venue:'NYSE Arca', sector:'Physical silver', aliases:['slv','silver etf'] },

  // ---------- Settlement unit ----------
  { id:'USDG', symbol:'USDG', name:'Global Dollar', short:'USDG', class:'settle', domain:'paxos.com', color:'#2159F5', venue:'Stablecoin', sector:'Settlement', aliases:['usdg','global dollar','dollar'] },
];

const BY_ID = new Map(ASSETS.map(a => [a.id.toUpperCase(), a]));

export function getAsset(id) {
  if (!id) return null;
  return BY_ID.get(String(id).toUpperCase()) || null;
}
/** Everything that can be a leg of an index. USDG cannot: it is the unit the
 *  market settles in, not a leg of a basket. */
export function tradableAssets() { return ASSETS.filter(a => a.class !== 'settle'); }
export function byClass(cls) { return ASSETS.filter(a => a.class === cls); }
export const USDG = getAsset('USDG');
