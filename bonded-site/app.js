/* Bonded — page behaviour.
   No dependencies. Everything the pages show comes through one adapter
   (`Bonded.adapter`), so wiring the real protocol means replacing that
   object, not touching the pages. See README → "Wiring the chain".
   Sections: config · sample data · adapter · helpers · chrome · the frogs
   (hero scene) · home · pairs board · pair page · live · stocks · launch ·
   my playground · docs. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* =====================================================================
     CONFIG — the protocol facts the pages print. Fill these in.
     ===================================================================== */
  const CONFIG = {
    chain: 'Base',
    explorer: 'https://basescan.org',
    fee: '0.002 ETH',
    swapFee: '1.0%',
    swapFeeRate: 0.01,
    creatorShare: '50%',
    creatorShareRate: 0.5,
    factory: '0x0000000000000000000000000000000000000000',
    token: '0x0000000000000000000000000000000000000000',
    lockUrl: '#',
    factoryUrl: '#',
    docsUrl: 'docs.html',
    xUrl: '#',
    supply: 1_000_000_000,
  };

  /* =====================================================================
     SAMPLE DATA — replaced by the adapter once it talks to the chain.
     `color` is the fish; tickers, never logos.
     ===================================================================== */
  const STOCKS = [
    { sym: 'NVDA',  name: 'NVIDIA',      price: 178.20, z: 1,  color: '#76B900' },
    { sym: 'TSLA',  name: 'Tesla',       price: 412.85, z: 2,  color: '#CC0000' },
    { sym: 'AAPL',  name: 'Apple',       price: 236.10, z: 3,  color: '#8C959E' },
    { sym: 'MSFT',  name: 'Microsoft',   price: 512.40, z: 4,  color: '#E6EAEE' },
    { sym: 'AMZN',  name: 'Amazon',      price: 231.60, z: 5,  color: '#FF9900' },
    { sym: 'GOOGL', name: 'Alphabet',    price: 244.30, z: 6,  color: '#EEF1F4' },
    { sym: 'META',  name: 'Meta',        price: 744.90, z: 7,  color: '#0467DF' },
    { sym: 'SPY',   name: 'S&P 500 ETF', price: 661.20, z: 8,  color: '#1F3A5F' },
    { sym: 'COIN',  name: 'Coinbase',    price: 318.70, z: 9,  color: '#0052FF' },
    { sym: 'HOOD',  name: 'Robinhood',   price: 118.40, z: 10, color: '#CCFF00' },
    { sym: 'MSTR',  name: 'Strategy',    price: 341.20, z: 11, color: '#D9232E' },
    { sym: 'PLTR',  name: 'Palantir',    price: 172.30, z: 12, color: '#2B2F36' },
    { sym: 'RDDT',  name: 'Reddit',      price: 146.20, z: 13, color: '#FF4500' },
    { sym: 'SPACEX',name: 'SpaceX',      price: 212.00, z: 14, color: '#005288' },
    { sym: 'SHOP',  name: 'Shopify',     price: 148.30, z: 15, color: '#96BF48' },
  ];

  // name, ticker, stock, market cap USD, 24h volume USD, 24h change %, holders, age hours, one line
  const SEED_PAIRS = [
    ['Robotaxi Season',    'ROBO',  'TSLA',  1_840_000, 612_000,   38.4,  2140, 6,   'For everyone who thinks the robotaxi is the whole thesis.'],
    ['Blackwell Bros',     'BWELL', 'NVDA',  4_210_000, 1_380_000, 12.1,  5120, 31,  'Every chip has a family. This is the loud one.'],
    ['Jensen Jacket',      'JACKET','NVDA',  920_000,   284_000,   -8.6,  1430, 52,  'Leather, never cotton.'],
    ['Vision Pro Max',     'VISION','AAPL',  610_000,   141_000,   4.2,   880,  9,   'Spatial computing, priced in AAPL.'],
    ['Copilot Cult',       'CPLT',  'MSFT',  1_120_000, 310_000,   22.7,  1760, 18,  'The assistant that never sleeps, bonded to the company that never sells.'],
    ['Prime Day Every Day','PRIME', 'AMZN',  380_000,   92_000,    -3.1,  540,  3,   'Two-day shipping for your portfolio.'],
    ['Gemini Twins',       'TWINS', 'GOOGL', 2_060_000, 744_000,   15.9,  2980, 40,  'Two models, one ticker.'],
    ['Zuck Chain',         'ZUCK',  'META',  1_470_000, 402_000,   -12.4, 2210, 77,  'Metaverse survivors club.'],
    ['Index Enjoyer',      'INDEX', 'SPY',   3_320_000, 866_000,   2.8,   6100, 120, 'Boring on purpose. Bonded to the S&P.'],
    ['Base Camp',          'CAMP',  'COIN',  760_000,   198_000,   47.3,  1010, 2,   'Home of the chain, home of the coin.'],
    ['Retail Army',        'RETAIL','HOOD',  540_000,   166_000,   9.5,   790,  14,  'Confetti optional.'],
    ['Saylor Says',        'SAYS',  'MSTR',  1_980_000, 528_000,   -5.7,  2660, 61,  'There is no second best.'],
    ['Karp Diem',          'KARP',  'PLTR',  430_000,   121_000,   18.2,  620,  5,   'Seize the ontology.'],
    ['Dojo Dreams',        'DOJO',  'TSLA',  290_000,   88_000,    -21.9, 470,  1,   'Training on the road to full self-holding.'],
    ['CUDA Cartel',        'CUDA',  'NVDA',  2_740_000, 915_000,   6.3,   3870, 96,  'Parallel by design.'],
    ['Tim Apple',          'TIMMY', 'AAPL',  210_000,   54_000,    61.0,  330,  0.5, 'Good morning.'],
    ['Azure Sky',          'AZURE', 'MSFT',  350_000,   73_000,    -1.4,  510,  27,  'Cloud coverage, all day.'],
    ['Two Day Shipping',   'SHIP',  'AMZN',  1_260_000, 356_000,   8.8,   1920, 44,  'It arrives before you remember ordering it.'],
  ];
  const LOGOS = {
    NVDA: { fill: '#76B900', mark: 'light', svg: '<path d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z"/>' },
    TSLA: { fill: '#CC0000', mark: 'light', svg: '<path d="M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z"/>' },
    AAPL: { fill: '#111111', mark: 'light', svg: '<path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>' },
    GOOGL: { fill: '#4285F4', mark: 'color', svg: '<path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>' },
    META: { fill: '#0467DF', mark: 'light', svg: '<path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/>' },
    COIN: { fill: '#FFFFFF', mark: 'light', svg: '<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zm-2.4-8.1h4.8v3.2H9.6z" fill-rule="evenodd"/>' },
    HOOD: { fill: '#1B1F14', mark: 'dark', svg: '<path d="M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852"/>' },
    PLTR: { fill: '#101113', mark: 'light', svg: '<path d="M20.147 18L12 21.178 3.853 18 2.5 20.343 12 24l9.5-3.657L20.147 18zM12 0a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 16.078a6.568 6.568 0 1 1 0-13.136 6.568 6.568 0 0 1 0 13.136z"/>' },
    MSTR: { fill: '#D9232E', mark: 'light', svg: '<path d="M9.095 2.572h5.827v18.856H9.096zM0 2.572h5.825v18.856H.001zm18.174 0v18.854H24V8.33z"/>' },
    AMZN: { fill: '#111111', mark: 'color', svg: '<text x="12" y="15" font-family="Arial Black, Arial, sans-serif" font-size="17" font-weight="900" text-anchor="middle" fill="#111">a</text><path d="M3.2 16.6c4.6 3.6 12 3.9 17.6.6" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><path d="M19.4 16.2l2.2 1.1-2.4.9" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    MSFT: { fill: '#0078D4', mark: 'color', svg: '<rect x="1.5" y="1.5" width="10" height="10" fill="#F25022"/><rect x="12.5" y="1.5" width="10" height="10" fill="#7FBA00"/><rect x="1.5" y="12.5" width="10" height="10" fill="#00A4EF"/><rect x="12.5" y="12.5" width="10" height="10" fill="#FFB900"/>' },
    SPY: { fill: '#B22222', mark: 'light', svg: '<text x="12" y="15.5" font-family="Inter, Arial, sans-serif" font-size="10.5" font-weight="800" text-anchor="middle" fill="#B22222">S&amp;P</text>' },
    RDDT: { fill: '#FFFFFF', mark: 'light', svg: '<path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"/>' },
    SPACEX: { fill: '#FFFFFF', mark: 'light', svg: '<path d="M24 7.417C8.882 8.287 1.89 14.75.321 16.28L0 16.583h2.797C10.356 9.005 21.222 7.663 24 7.417zm-17.046 6.35c-.472.321-.945.68-1.398 1.02l2.457 1.796h2.778zM2.948 10.8H.189l3.25 2.381c.473-.321 1.02-.661 1.512-.945Z"/>' },
    SHOP: { fill: '#FFFFFF', mark: 'light', svg: '<path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"/>' },
  };

  const WORDS_A = ['Turbo', 'Quiet', 'Golden', 'Night', 'Pocket', 'Orbital', 'Velvet', 'Lucky', 'Deep', 'Paper'];
  const WORDS_B = ['Margin', 'Dividend', 'Quarter', 'Rally', 'Ticker', 'Halving', 'Guidance', 'Buyback', 'Beta', 'Float'];

  const mkPair = ([name, ticker, stock, mcap, volume, change, holders, ageH, desc], extra = {}) => ({
    name, ticker, stock, mcap, volume, change, holders, desc,
    createdAt: Date.now() - ageH * 3600e3,
    address: '0x' + hash(ticker + name).toString(16).padStart(8, '0').repeat(5),
    creator: '0x' + hash(name).toString(16).padStart(8, '0').repeat(5),
    ...extra,
  });

  /* =====================================================================
     persistence (the mock's memory between pages: launches and positions)
     ===================================================================== */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const LAUNCHED = store.get('bonded-launched', []);          // pairs created in this browser
  const HOLDINGS = store.get('bonded-holdings', {});          // ticker → token amount
  const PAIRS = [...LAUNCHED, ...SEED_PAIRS.map(p => mkPair(p))];
  const findPair = t => PAIRS.find(p => p.ticker === t);

  /* =====================================================================
     ADAPTER — the only thing the pages talk to.
     Replace `window.BONDED_ADAPTER` (define it before app.js loads) with an
     object exposing the same methods and the pages run on real data.
     ===================================================================== */
  const listeners = new Set();
  const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (_) {} });

  // a constant-product pool implied by the pair's market cap
  const pool = p => {
    const tokenReserve = CONFIG.supply * 0.55;
    const stockReserve = tokenReserve * priceShares(p);
    return { tokenReserve, stockReserve };
  };

  const mockAdapter = {
    async stats() {
      const volume = PAIRS.reduce((s, p) => s + p.volume, 0);
      const locked = PAIRS.reduce((s, p) => s + p.mcap * 0.31, 0);
      return { pairs: 1284 + LAUNCHED.length, volumeUsd: volume * 3.6, lockedUsd: locked * 4.2 };
    },
    async stocks() {
      return STOCKS.map(s => ({ ...s, pairs: PAIRS.filter(p => p.stock === s.sym).length * 17 + s.z * 3, change: ((hash(s.sym + 'd') % 700) - 300) / 100 }));
    },
    async pairs() { return PAIRS.slice(); },
    async pair(ticker) {
      const p = findPair(ticker); if (!p) return null;
      return { ...p, liquidityUsd: p.mcap * 0.31, series: priceSeries(p, 168), trades: tradeHistory(p) };
    },
    async connect() {
      if (window.ethereum?.request) {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { address };
      }
      await wait(400);
      return { address: '0xd3m0' + 'bonded'.padEnd(30, '0') + 'cafe' };
    },
    async createPair(payload) {
      // Real implementation: call the factory with payload and return the receipt.
      await wait(1600);
      const h = hash(JSON.stringify(payload) + Date.now()).toString(16);
      const res = {
        txHash: '0x' + (h + h + h + h + h + h + h + h).slice(0, 64),
        tokenAddress: '0x' + (h + h + h + h + h).slice(0, 40),
        pairAddress:  '0x' + (h + h + h + h + h).slice(2, 42),
      };
      const st = stockOf(payload.stock);
      const buyUsd = Number(payload.buy || 0) * st.price;
      const p = mkPair([payload.name, payload.ticker, payload.stock, 25_000 + buyUsd * 12, buyUsd, 0, 1, 0, payload.desc || ''], {
        address: res.tokenAddress, creator: payload.creator, image: payload.image || '', x: payload.x || '', site: payload.site || '', mine: true,
      });
      LAUNCHED.unshift(p); PAIRS.unshift(p); store.set('bonded-launched', LAUNCHED);
      if (buyUsd > 0) { HOLDINGS[p.ticker] = (HOLDINGS[p.ticker] || 0) + Number(payload.buy) / priceShares(p) * 0.98; store.set('bonded-holdings', HOLDINGS); }
      emit({ kind: 'launch', pair: p, wallet: payload.creator, ts: Date.now() });
      return res;
    },
    async quote({ ticker, side, amount }) {
      const p = findPair(ticker); const { tokenReserve, stockReserve } = pool(p);
      const fee = amount * CONFIG.swapFeeRate; const inAmt = amount - fee;
      if (side === 'buy') {
        const out = tokenReserve * inAmt / (stockReserve + inAmt);
        return { out, priceImpact: inAmt / (stockReserve + inAmt), fee, feeUnit: p.stock };
      }
      const out = stockReserve * inAmt / (tokenReserve + inAmt);
      return { out, priceImpact: inAmt / (tokenReserve + inAmt), fee, feeUnit: ticker };
    },
    async swap({ ticker, side, amount, wallet }) {
      await wait(900);
      const p = findPair(ticker); const q = await this.quote({ ticker, side, amount });
      const st = stockOf(p.stock);
      if (side === 'buy') { HOLDINGS[ticker] = (HOLDINGS[ticker] || 0) + q.out; p.mcap *= 1 + q.priceImpact * 2; p.volume += amount * st.price; }
      else { HOLDINGS[ticker] = Math.max(0, (HOLDINGS[ticker] || 0) - amount); p.mcap *= 1 - q.priceImpact * 2; p.volume += q.out * st.price; }
      p.holders += side === 'buy' ? 1 : 0;
      store.set('bonded-holdings', HOLDINGS);
      const trade = { side, amountStock: side === 'buy' ? amount : q.out, amountToken: side === 'buy' ? q.out : amount, price: priceShares(p), wallet, ts: Date.now(), tx: '0x' + hash(ticker + Date.now()).toString(16).padStart(8, '0').repeat(8) };
      emit({ kind: side, pair: p, ...trade });
      return { txHash: trade.tx, trade };
    },
    async holdings() { return Object.entries(HOLDINGS).filter(([, a]) => a > 0).map(([ticker, amount]) => ({ ticker, amount })); },
    async launched() { return LAUNCHED.map(p => p.ticker); },
    subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1 && !mockAdapter._timer) {
        const tick = () => {
          const r = Math.random();
          if (r < 0.06) {
            const st = STOCKS[Math.floor(Math.random() * STOCKS.length)];
            const name = WORDS_A[Math.floor(Math.random() * WORDS_A.length)] + ' ' + WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
            const ticker = name.split(' ').map(w => w.slice(0, 3)).join('').toUpperCase().slice(0, 6);
            if (!findPair(ticker)) {
              const p = mkPair([name, ticker, st.sym, 18_000 + Math.random() * 40_000, 2_000 + Math.random() * 9_000, (Math.random() - .3) * 40, 1 + Math.floor(Math.random() * 12), 0, 'Just bonded.']);
              PAIRS.unshift(p); emit({ kind: 'launch', pair: p, wallet: p.creator, ts: Date.now() });
            }
          } else {
            const p = PAIRS[Math.floor(Math.random() * Math.min(PAIRS.length, 24))];
            const side = r < 0.78 ? 'buy' : 'sell';
            const amountStock = +(Math.random() ** 2 * 0.6 + 0.005).toFixed(4);
            const amountToken = amountStock / priceShares(p);
            emit({ kind: side, pair: p, amountStock, amountToken, price: priceShares(p), wallet: '0x' + Math.random().toString(16).slice(2, 10).padEnd(40, '0'), ts: Date.now() });
          }
          mockAdapter._timer = setTimeout(tick, 2200 + Math.random() * 3800);
        };
        mockAdapter._timer = setTimeout(tick, 1500);
      }
      return () => listeners.delete(fn);
    },
  };

  const adapter = window.BONDED_ADAPTER || mockAdapter;
  window.Bonded = { config: CONFIG, adapter, stocks: STOCKS, pairs: PAIRS };

  /* =====================================================================
     helpers
     ===================================================================== */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const fmtUsd = n => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(n < 1 ? 4 : 2);
  };
  const fmtNum = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n >= 100 ? String(Math.round(n)) : n.toFixed(n < 1 ? 4 : 2);
  const fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const fmtAge = ts => {
    const m = Math.max(1, Math.round((Date.now() - ts) / 60e3));
    if (m < 60) return m + 'm';
    const h = Math.round(m / 60); if (h < 48) return h + 'h';
    return Math.round(h / 24) + 'd';
  };
  const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shortAddr = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '—';
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  // shares per token: 0.0000042 → 0.0₅42
  const fmtShares = x => {
    if (!x) return '0';
    if (x >= 1) return x.toFixed(3);
    const s = x.toFixed(18).replace(/0+$/, '');
    const m = s.match(/^0\.(0*)(\d+)$/);
    if (!m) return x.toPrecision(3);
    const zeros = m[1].length, digits = m[2].slice(0, 3);
    if (zeros < 4) return '0.' + m[1] + digits;
    return '0.0' + String(zeros).split('').map(d => SUB[+d]).join('') + digits;
  };

  const stockOf = sym => STOCKS.find(s => s.sym === sym) || STOCKS[0];
  const priceUsd = p => p.mcap / CONFIG.supply;
  const priceShares = p => priceUsd(p) / stockOf(p.stock).price;
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarHue = ticker => hash(ticker) % 360;

  // deterministic walk that ends at the current price, in the direction of the 24h change
  function priceSeries(p, n = 28) {
    let seed = hash(p.ticker), v = 1; const out = [];
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const span = Math.min(n, 24);
    for (let i = 0; i < n; i++) { v *= 1 + (rnd() - .5) * .07; out.push(v); }
    // pin the last `span` points so that first→last = 24h change
    const k = (1 + p.change / 100) / (out[n - 1] / out[n - span]);
    for (let i = n - span; i < n; i++) out[i] *= 1 + (k - 1) * (i - (n - span)) / (span - 1);
    const scale = priceShares(p) / out[n - 1];
    return out.map(y => y * scale);
  }
  function tradeHistory(p) {
    let seed = hash(p.ticker + 't'); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const out = []; let ts = Date.now() - 40e3;
    for (let i = 0; i < 18; i++) {
      const side = rnd() < .7 ? 'buy' : 'sell'; const amountStock = +(rnd() ** 2 * 0.5 + 0.004).toFixed(4);
      out.push({ side, amountStock, amountToken: amountStock / priceShares(p) * (1 + (rnd() - .5) * .1), price: priceShares(p) * (1 + (rnd() - .5) * .06), wallet: '0x' + Math.floor(rnd() * 1e12).toString(16).padEnd(40, '0'), ts, tx: '0x' + Math.floor(rnd() * 1e12).toString(16).padEnd(64, '0') });
      ts -= 30e3 + rnd() * 400e3;
    }
    return out;
  }
  function sparkline(p, w = 260, h = 46) {
    const pts = priceSeries(p, 28); const min = Math.min(...pts), max = Math.max(...pts);
    const xy = pts.map((y, i) => [i / (pts.length - 1) * w, h - 3 - (y - min) / (max - min || 1) * (h - 6)]);
    const line = xy.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
    return `<svg class="bd-spark ${p.change < 0 ? 'is-down' : ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon class="bd-spark-fill" points="0,${h} ${line} ${w},${h}"/><polyline points="${line}"/></svg>`;
  }
  const avatar = (p, extra = '') => p.image
    ? `<span class="bd-avatar ${extra}" style="background:url('${esc(p.image)}') center/cover"></span>`
    : `<span class="bd-avatar ${extra}" style="background:hsl(${avatarHue(p.ticker)} 70% 58%)">${esc(initials(p.name))}</span>`;
  const badge = p => {
    const ageH = (Date.now() - p.createdAt) / 3600e3;
    if (ageH < 6) return '<span class="bd-badge bd-badge-new">new</span>';
    if (p.volume / p.mcap > .3) return '<span class="bd-badge bd-badge-hot">hot</span>';
    return '';
  };
  const pairHref = p => 'pair.html?t=' + encodeURIComponent(p.ticker);

  function pairCard(p) {
    const st = stockOf(p.stock);
    return `
      <div class="bd-paircard-head">
        ${avatar(p)}
        <div><div class="bd-paircard-name">${esc(p.name)}</div><div class="bd-paircard-pair">$${esc(p.ticker)} / ${st.sym}</div></div>
        <span class="bd-pair-chg ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span>
      </div>
      <div class="bd-paircard-price"><b>${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span></b><span>≈ ${fmtUsd(priceUsd(p))}</span></div>
      ${sparkline(p)}
      <div class="bd-paircard-foot"><span>MC ${fmtUsd(p.mcap)}</span><span>Vol ${fmtUsd(p.volume)}</span><span>${fmtNum(p.holders)} holders</span></div>`;
  }
  function pairTile(p) {
    const st = stockOf(p.stock);
    const pct = clamp(Math.round(8 + Math.log10(Math.max(1, p.mcap / 1e4)) * 18), 5, 95);
    return `<a class="bd-pair" href="${pairHref(p)}">
      <div class="bd-pair-art" style="--sc:${st.color}">
        <span class="bd-pair-corner">${st.sym}</span>
        <i class="bd-frog bd-frogpic" style="--c:${st.color}">${FROG_SVG(st)}</i>
        <span class="bd-pair-corner is-right">${fmtAge(p.createdAt)} ago</span>
      </div>
      <div class="bd-pair-body">
        <div class="bd-pair-title"><span class="bd-pair-name">${esc(p.name)}</span><span class="bd-pair-pill">${p.mine ? 'Yours' : 'On the board'}</span></div>
        <div class="bd-pair-sub">${esc(p.ticker)} · Priced in ${esc(st.name)}</div>
        <div class="bd-pair-bar"><i style="width:${pct}%"></i></div>
        <div class="bd-pair-bar-labels"><span>${fmtShares(priceShares(p))} ${st.sym}</span><span>${pct}% of supply held</span></div>
        <div class="bd-pair-sparklabel"><span>Price in ${st.sym} · 24h</span><b class="${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</b></div>
        ${sparkline(p, 260, 52)}
      </div>
    </a>`;
  }
  function elementTile(s, active) {
    return `<button class="bd-element ${active ? 'is-active' : ''}" type="button" data-sym="${s.sym}">
      <span class="bd-el-z">${String(s.z).padStart(2, '0')}</span>
      <div class="bd-el-sym">${s.sym}</div>
      <div class="bd-el-name">${esc(s.name)}</div>
      <div class="bd-el-row"><span class="bd-mono">$${s.price.toFixed(2)}</span><span>${s.pairs} pairs</span></div>
    </button>`;
  }
  const toastEl = $('#toast'); let toastT;
  const toast = msg => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600); };

  /* =====================================================================
     shared chrome
     ===================================================================== */
  document.body.classList.add('bd-js');

  // one theme: the pale sky. The dark tokens stay in the stylesheet for later.
  document.documentElement.setAttribute('data-theme', 'light');

  // menu
  const burger = $('#burger'), links = $('#navlinks');
  burger?.addEventListener('click', () => { const open = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (links?.classList.contains('is-open') && !e.target.closest('.bd-pill')) links.classList.remove('is-open'); });

  // anchor navigation
  const navH = () => 90;
  const scrollToId = id => { const t = document.getElementById(id); if (!t) return; window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH(), behavior: 'smooth' }); };
  $$('[data-scroll]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); links?.classList.remove('is-open'); scrollToId(el.dataset.scroll); }));
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH() }), 60); }

  // reveal
  const rises = $$('.bd-rise');
  if ('IntersectionObserver' in window && rises.length) {
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: .08 });
    rises.forEach(el => io.observe(el));
  } else rises.forEach(el => el.classList.add('is-in'));

  // config → page
  const bindCfg = (root = document) => {
    $$('[data-cfg]', root).forEach(el => { const v = CONFIG[el.dataset.cfg]; if (v != null) el.textContent = v; });
    $$('[data-cfg-href]', root).forEach(el => { const v = CONFIG[el.dataset.cfgHref]; if (v) el.href = v; });
  };
  bindCfg();
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (__) {} ta.remove();
    }
    if (btn) { const old = btn.textContent; btn.textContent = 'copied'; setTimeout(() => btn.textContent = old, 1200); }
    toast('Copied');
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    copyText(b.dataset.copyText || CONFIG[b.dataset.copy] || b.dataset.copy, b);
  });

  // stats → strip and proof
  adapter.stats().then(s => {
    const map = { pairs: fmtNum(s.pairs), volume: fmtUsd(s.volumeUsd), locked: fmtUsd(s.lockedUsd) };
    $$('[data-stat]').forEach(el => { if (map[el.dataset.stat]) el.textContent = map[el.dataset.stat]; });
  }).catch(() => {});

  // wallet (remembered for the tab so it survives page changes)
  let wallet = null;
  const walletBtns = $$('.bd-wallet');
  const setWallet = w => {
    wallet = w; walletBtns.forEach(b => b.textContent = w ? shortAddr(w.address) : 'Connect wallet');
    try { w ? sessionStorage.setItem('bonded-wallet', JSON.stringify(w)) : sessionStorage.removeItem('bonded-wallet'); } catch (_) {}
    document.dispatchEvent(new CustomEvent('bonded:wallet', { detail: w }));
  };
  try { const w = JSON.parse(sessionStorage.getItem('bonded-wallet')); if (w?.address) setWallet(w); } catch (_) {}
  const connect = async () => { try { setWallet(await adapter.connect()); toast('Wallet connected'); } catch (e) { console.warn('wallet', e); } return wallet; };
  walletBtns.forEach(b => b.addEventListener('click', () => wallet ? (location.href = 'playground.html') : connect()));

  const page = document.body.dataset.page;

  /* =====================================================================
     THE LAKE — behind every page. Water, moving light, drifting lily pads
     with pink flowers, rings now and then. The hero's frogs sit on top.
     ===================================================================== */
  const lake = (() => {
    const root = $('.bd'); if (!root) return null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = innerWidth < 900;
    const el = document.createElement('div'); el.className = 'bd-lake'; el.setAttribute('aria-hidden', 'true');
    const anim = !reduced && !small;
    el.innerHTML = `<i class="bd-lake-water"></i>
      <svg class="bd-lake-svg" aria-hidden="true">
        <defs>
          <filter id="bd-murk" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.0045" numOctaves="3" seed="9" result="n"/>
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.10  0 0 0 0 0.34  0 0 0 0 0.27  0 0 0 1.4 -0.45"/>
            <feGaussianBlur stdDeviation="6"/>
          </filter>
          <filter id="bd-caustic" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feTurbulence type="turbulence" baseFrequency="0.011 0.014" numOctaves="2" seed="4" result="t">
              ${anim ? '<animate attributeName="baseFrequency" values="0.011 0.014;0.0125 0.0158;0.011 0.014" dur="16s" repeatCount="indefinite"/>' : ''}
            </feTurbulence>
            <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.94  0 0 0 9 -4.2"/>
            <feGaussianBlur stdDeviation="0.7"/>
          </filter>
          <filter id="bd-caustic2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feTurbulence type="turbulence" baseFrequency="0.02 0.024" numOctaves="2" seed="11" result="t">
              ${anim ? '<animate attributeName="baseFrequency" values="0.02 0.024;0.0215 0.026;0.02 0.024" dur="11s" repeatCount="indefinite"/>' : ''}
            </feTurbulence>
            <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 7 -3.6"/>
            <feGaussianBlur stdDeviation="0.9"/>
          </filter>
          <filter id="bd-water" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="28" xChannelSelector="R" yChannelSelector="G"/></filter>
          <radialGradient id="bd-skinLight" cx="42%" cy="34%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
          <radialGradient id="bd-skinDark" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
          <radialGradient id="bd-eyeg" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
          <radialGradient id="bd-padg" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#9FD27F"/><stop offset=".55" stop-color="#5FA34B"/><stop offset="1" stop-color="#3B7A34"/></radialGradient>
          <radialGradient id="bd-petal" cx="50%" cy="85%" r="80%"><stop offset="0" stop-color="#FFE3EE"/><stop offset=".6" stop-color="#F7A3C4"/><stop offset="1" stop-color="#E56A9E"/></radialGradient>
        </defs>
        <rect class="bd-murk" x="0" y="0" width="100%" height="100%" fill="#000" filter="url(#bd-murk)"/>
        <g class="bd-caustic-a">${anim ? '<animateTransform attributeName="transform" type="translate" values="0 0;-60 -30;0 0" dur="26s" repeatCount="indefinite"/>' : ''}<rect x="-80" y="-80" width="120%" height="120%" fill="#fff" filter="url(#bd-caustic)" style="width:calc(100% + 160px);height:calc(100% + 160px)"/></g>
        <g class="bd-caustic-b">${anim ? '<animateTransform attributeName="transform" type="translate" values="0 0;50 40;0 0" dur="19s" repeatCount="indefinite"/>' : ''}<rect x="-80" y="-80" width="120%" height="120%" fill="#fff" filter="url(#bd-caustic2)" style="width:calc(100% + 160px);height:calc(100% + 160px)"/></g>
      </svg>
      <i class="bd-lake-glare"></i><i class="bd-lake-depth"></i>`;
    let seed = 20260920; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // cloud reflections
    for (let k = 0; k < (small ? 2 : 4); k++) { const m = document.createElement('i'); m.className = 'bd-lake-cloud'; m.style.cssText = `--w:${(26 + rnd() * 22).toFixed(0)}vw; --t:${(rnd() * 80).toFixed(0)}%; --d:${(90 + rnd() * 70).toFixed(0)}s; --dl:${(-rnd() * 120).toFixed(0)}s`; el.appendChild(m); }
    // lily pads, the same spread on every page
    const padSVG = (flower) => `<svg viewBox="0 0 100 100">
      <path d="M50 50 L98.07 36.22 A50 50 0 1 0 98.07 63.78 Z" fill="url(#bd-padg)" stroke="rgba(0,0,0,.22)" stroke-width=".8"/>
      <g stroke="rgba(0,0,0,.18)" stroke-width=".9" fill="none">${[...Array(12)].map((_, i) => { const t = -160 + i * 29; if (t > -18 && t < 18) return ''; const r = t * Math.PI / 180; return `<path d="M50 50 Q${(50 + Math.cos(r - .12) * 28).toFixed(1)} ${(50 + Math.sin(r - .12) * 28).toFixed(1)} ${(50 + Math.cos(r) * 46).toFixed(1)} ${(50 + Math.sin(r) * 46).toFixed(1)}"/>`; }).join('')}</g>
      <path d="M50 50 L98.07 36.22 A50 50 0 1 0 98.07 63.78 Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" style="mix-blend-mode:screen"/>
      ${flower ? `<g class="bd-lotus" transform="translate(38 40) scale(.55)">${[...Array(8)].map((_, i) => `<ellipse cx="50" cy="26" rx="11" ry="26" fill="url(#bd-petal)" stroke="rgba(0,0,0,.12)" stroke-width=".8" transform="rotate(${i * 45} 50 50)"/>`).join('')}${[...Array(6)].map((_, i) => `<ellipse cx="50" cy="32" rx="8" ry="19" fill="url(#bd-petal)" transform="rotate(${22 + i * 60} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="9" fill="#F6D35A"/><circle cx="50" cy="50" r="5" fill="#E7B62D"/></g>` : ''}
    </svg>`;
    const spots = small ? [[12, 30, 1], [88, 22, 0], [10, 78, 1], [86, 70, 1], [50, 92, 0]] : [[8, 18, 1], [26, 78, 0], [14, 52, 1], [90, 16, 0], [78, 62, 1], [94, 88, 1], [50, 94, 0], [64, 8, 1], [38, 30, 0]];
    for (const [l, t, flower] of spots) {
      const p = document.createElement('i'); p.className = 'bd-lily'; p.setAttribute('data-pad', ''); p.innerHTML = padSVG(flower);
      const s = (small ? 70 : 100) + rnd() * (small ? 50 : 120);
      p.style.cssText = `--s:${s.toFixed(0)}px; --l:${l}%; --t:${t}%; --r:${(rnd() * 360).toFixed(0)}deg; --d:${(9 + rnd() * 8).toFixed(1)}s; --dx:${((rnd() - .5) * 40).toFixed(0)}px; --dy:${((rnd() - .5) * 30).toFixed(0)}px`;
      el.appendChild(p);
      for (let k = 0; k < 3; k++) { const w = document.createElement('i'); w.className = 'bd-weed'; w.style.cssText = `left:calc(${l}% + ${((rnd() - .5) * s * 1.6).toFixed(0)}px); top:calc(${t}% + ${((rnd() - .5) * s * 1.6).toFixed(0)}px)`; el.appendChild(w); }
    }
    // reeds along both banks
    const reeds = small ? [[2, 160, -4], [5, 120, 3], [93, 150, 2], [97, 110, -3]] : [[1, 240, -5], [3, 190, 2], [5.5, 280, -2], [8, 150, 4], [92, 210, 3], [94.5, 270, -3], [97, 170, 5], [99, 230, -2]];
    reeds.forEach(([l, h, r], i) => { const d = document.createElement('i'); d.className = 'bd-reed' + (i % 3 === 1 ? ' is-leaf' : ''); d.style.cssText = `--l:${l}%; --h:${h}px; --r:${r}deg; --d:${(4 + rnd() * 3).toFixed(1)}s`; el.appendChild(d); });
    // motes of pollen
    for (let k = 0; k < (small ? 8 : 18); k++) { const m = document.createElement('i'); m.className = 'bd-mote'; m.style.cssText = `left:${(rnd() * 100).toFixed(1)}%; top:${(rnd() * 100).toFixed(1)}%; --d:${(14 + rnd() * 16).toFixed(1)}s; --dl:${(-rnd() * 20).toFixed(1)}s; --mx:${((rnd() - .5) * 220).toFixed(0)}px; --my:${((rnd() - .5) * 160).toFixed(0)}px`; el.appendChild(m); }
    root.prepend(el);
    let paused = false;
    if (!reduced) setInterval(() => {
      if (paused || document.hidden) return;
      const r = document.createElement('i'); r.className = 'bd-ring'; r.style.left = (Math.random() * 100) + '%'; r.style.top = (Math.random() * 100) + '%';
      el.appendChild(r); setTimeout(() => r.remove(), 3300);
    }, 1300);

    /* flies: they buzz around a slowly drifting point, in viewport coordinates */
    const flies = [];
    if (!reduced) {
      for (let k = 0; k < (document.body.dataset.page === 'home' ? (small ? 6 : 12) : (small ? 3 : 6)); k++) {
        const f = document.createElement('i'); f.className = 'bd-fly'; el.appendChild(f);
        flies.push({ el: f, cx: Math.random() * innerWidth, cy: 120 + Math.random() * (innerHeight - 200), x: 0, y: 0, p1: Math.random() * 6, p2: Math.random() * 6, vx: 0, vy: 0, eaten: 0 });
      }
      let last = performance.now();
      const step = now => {
        const dt = paused || document.hidden ? 0 : Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
        for (const f of flies) {
          if (f.eaten) { if (t > f.eaten) { f.eaten = 0; f.cx = Math.random() * innerWidth; f.cy = 120 + Math.random() * (innerHeight - 200); f.el.classList.remove('is-eaten'); } else continue; }
          f.vx += (Math.random() - .5) * 60 * dt; f.vy += (Math.random() - .5) * 60 * dt; f.vx *= .98; f.vy *= .98;
          f.cx += f.vx * dt; f.cy += f.vy * dt;
          if (f.cx < 20 || f.cx > innerWidth - 20) f.vx *= -1; if (f.cy < 110 || f.cy > innerHeight - 30) f.vy *= -1;
          f.cx = clamp(f.cx, 20, innerWidth - 20); f.cy = clamp(f.cy, 110, innerHeight - 30);
          f.x = f.cx + Math.sin(t * 7 + f.p1) * 14 + Math.sin(t * 13 + f.p2) * 5; f.y = f.cy + Math.cos(t * 9 + f.p2) * 10 + Math.sin(t * 17 + f.p1) * 4;
          f.el.style.setProperty('--x', f.x.toFixed(1) + 'px'); f.el.style.setProperty('--y', f.y.toFixed(1) + 'px');
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    const nearestFly = (x, y, r) => { let best = null, bd = r; for (const f of flies) { if (f.eaten) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } } return best; };
    const eat = f => { f.eaten = performance.now() / 1000 + 4 + Math.random() * 6; f.el.classList.add('is-eaten'); };
    return { el, flies, nearestFly, eat, pause: v => { paused = v; el.classList.toggle('is-paused', v); }, pads: () => $$('[data-pad]', el) };
  })();


  /* water effects, in any container: a crown, rings and droplets that fly up and fall back */
  const splashAt = (container, x, y, big = 1) => {
    const mk = (cls, style) => { const e = document.createElement('i'); e.className = cls; e.style.cssText = `left:${x}px; top:${y}px; ${style}`; container.appendChild(e); return e; };
    const crown = mk('bd-crown', `--sz:${(22 * big).toFixed(0)}px`); setTimeout(() => crown.remove(), 600);
    for (let k = 0; k < 2; k++) { const r = mk('bd-ripple', `animation-delay:${k * 160}ms; --sz:${(34 * big).toFixed(0)}px`); setTimeout(() => r.remove(), 1500 + k * 160); }
    const n = Math.round(4 * big);
    for (let k = 0; k < n; k++) {
      const ang = Math.random() * Math.PI * 2, dist = (12 + Math.random() * 22) * big, up = (10 + Math.random() * 16) * big;
      const d = mk('bd-drop', `--dx:${(Math.cos(ang) * dist).toFixed(1)}px; --dy:${(Math.sin(ang) * dist * .6).toFixed(1)}px; --up:${(-up).toFixed(1)}px; --d:${(.42 + Math.random() * .2).toFixed(2)}s; width:${(2 + Math.random() * 2.5 * big).toFixed(1)}px; height:${(2 + Math.random() * 2.5 * big).toFixed(1)}px`);
      setTimeout(() => d.remove(), 800);
    }
  };

  /* a frog shoots its tongue from its mouth to a point, in its own container's coordinates */
  const tongue = (container, mx, my, tx, ty, done) => {
    const d = Math.hypot(tx - mx, ty - my), ang = Math.atan2(ty - my, tx - mx) * 180 / Math.PI;
    const t = document.createElement('i'); t.className = 'bd-tongue'; t.style.cssText = `left:${mx}px; top:${my}px; width:${d}px; transform: rotate(${ang}deg) scaleX(0)`;
    container.appendChild(t);
    const anim = t.animate([{ transform: `rotate(${ang}deg) scaleX(0)` }, { transform: `rotate(${ang}deg) scaleX(1)`, offset: .45 }, { transform: `rotate(${ang}deg) scaleX(1)`, offset: .6 }, { transform: `rotate(${ang}deg) scaleX(0)` }], { duration: 320, easing: 'ease-out' });
    setTimeout(done, 150); anim.onfinish = () => t.remove();
  };

  // the frog, seen from above, facing +x: shared by the hero and the lake
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  const FROG_SVG = (s) => {
    const logo = LOGOS[s.sym] || { fill: '#111', svg: `<text x="12" y="16" font-size="9" font-weight="800" text-anchor="middle" fill="#111">${s.sym}</text>` };
    const dark = logo.mark ? logo.mark === 'dark' : lum(s.color) > .55;
    const markFill = dark ? '#151A1E' : '#FFFFFF', shade = dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.42)';
    const mark = logo.mark === 'color'
      ? `<g class="bd-frog-mark" transform="translate(31 34) scale(1.37)">${logo.svg}</g>`
      : `<g class="bd-frog-mark" transform="translate(31.6 34.8) scale(1.37)" fill="${shade}">${logo.svg}</g><g class="bd-frog-mark" transform="translate(31 34) scale(1.37)" fill="${markFill}" opacity=".94">${logo.svg}</g>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="bd-frog-hind bd-frog-hind-l">
        <path class="bd-frog-leg" d="M40 34 C30 22 16 20 10 28 C8 32 12 36 18 36 C26 36 34 38 40 40 Z"/>
        <path class="bd-frog-leg2" d="M12 30 C4 34 2 42 8 46 C12 48 18 44 20 38 Z"/>
        <path class="bd-frog-toe" d="M8 46 L-2 40 L1 44 L-3 46 L1 48 L-2 53 L3 50 L2 56 L6 51 Z"/>
        <circle class="bd-frog-knee" cx="12" cy="29" r="2.6"/>
      </g>
      <g class="bd-frog-hind bd-frog-hind-r">
        <path class="bd-frog-leg" d="M40 66 C30 78 16 80 10 72 C8 68 12 64 18 64 C26 64 34 62 40 60 Z"/>
        <path class="bd-frog-leg2" d="M12 70 C4 66 2 58 8 54 C12 52 18 56 20 62 Z"/>
        <path class="bd-frog-toe" d="M8 54 L-2 60 L1 56 L-3 54 L1 52 L-2 47 L3 50 L2 44 L6 49 Z"/>
        <circle class="bd-frog-knee" cx="12" cy="71" r="2.6"/>
      </g>
      <g class="bd-frog-fore bd-frog-fore-l">
        <path class="bd-frog-leg" d="M66 36 C70 28 78 24 84 27 C86 30 82 34 78 36 C74 38 70 38 66 38 Z"/>
        <path class="bd-frog-toe" d="M83 27 L88 19 L85 26 L92 22 L86 28 L92 30 L85 30 Z"/>
      </g>
      <g class="bd-frog-fore bd-frog-fore-r">
        <path class="bd-frog-leg" d="M66 64 C70 72 78 76 84 73 C86 70 82 66 78 64 C74 62 70 62 66 62 Z"/>
        <path class="bd-frog-toe" d="M83 73 L88 81 L85 74 L92 78 L86 72 L92 70 L85 70 Z"/>
      </g>
      <path class="bd-frog-body" d="M25 50 C25 35 38 26 52 26 C66 26 82 34 93 50 C82 66 66 74 52 74 C38 74 25 65 25 50 Z"/>
      <path d="M25 50 C25 35 38 26 52 26 C66 26 82 34 93 50 C82 66 66 74 52 74 C38 74 25 65 25 50 Z" fill="url(#bd-skinLight)"/>
      <path class="bd-frog-flank" d="M27 44 C30 36 36 30 44 28 C38 34 35 42 35 50 C35 58 38 66 44 72 C36 70 30 64 27 56 Z"/>
      <path class="bd-frog-stripe" d="M30 50 C48 48 70 48 90 50"/>
      <path class="bd-frog-ridge" d="M32 40 C48 33 70 34 88 42"/><path class="bd-frog-ridge" d="M32 60 C48 67 70 66 88 58"/>
      <ellipse class="bd-frog-spot" cx="38" cy="43" rx="3.4" ry="2.2" transform="rotate(-20 38 43)"/><ellipse class="bd-frog-spot" cx="40" cy="58" rx="2.8" ry="2" transform="rotate(25 40 58)"/><ellipse class="bd-frog-spot" cx="60" cy="38" rx="2.4" ry="1.6"/><ellipse class="bd-frog-spot" cx="58" cy="64" rx="2.6" ry="1.7" transform="rotate(-15 58 64)"/><ellipse class="bd-frog-spot" cx="70" cy="46" rx="1.8" ry="1.3"/><ellipse class="bd-frog-spot" cx="71" cy="56" rx="1.6" ry="1.2"/>
      ${mark}
      <path d="M25 50 C25 35 38 26 52 26 C66 26 82 34 93 50 C82 66 66 74 52 74 C38 74 25 65 25 50 Z" fill="url(#bd-skinDark)"/>
      <ellipse class="bd-frog-throat" cx="86" cy="50" rx="5" ry="6"/>
      <g><ellipse class="bd-frog-eye" cx="74" cy="31" rx="9" ry="8"/><ellipse cx="74" cy="31" rx="9" ry="8" fill="url(#bd-eyeg)"/><circle class="bd-frog-iris" cx="75" cy="31.6" r="5"/><ellipse class="bd-frog-pupil" cx="75.4" cy="31.6" rx="3.8" ry="1.7"/><circle cx="72.4" cy="28.6" r="1.6" fill="#fff"/><rect class="bd-frog-lid" x="65" y="23" width="18" height="16" rx="8"/></g>
      <g><ellipse class="bd-frog-eye" cx="74" cy="69" rx="9" ry="8"/><ellipse cx="74" cy="69" rx="9" ry="8" fill="url(#bd-eyeg)"/><circle class="bd-frog-iris" cx="75" cy="68.4" r="5"/><ellipse class="bd-frog-pupil" cx="75.4" cy="68.4" rx="3.8" ry="1.7"/><circle cx="72.4" cy="65.6" r="1.6" fill="#fff"/><rect class="bd-frog-lid" x="65" y="61" width="18" height="16" rx="8"/></g>
      <circle cx="90" cy="46.5" r="1.1" fill="rgba(0,0,0,.5)"/><circle cx="90" cy="53.5" r="1.1" fill="rgba(0,0,0,.5)"/>
      <path d="M85 42.5 Q93.5 50 85 57.5" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="1.1"/>
    </svg>`;
  };

  /* =====================================================================
     THE LITTLE FROGS — small ones that hop about on the lake behind every
     page, the way the reference sites float small balloons through the
     whole scroll. Not interactive; they only keep the water alive.
     ===================================================================== */
  if (lake && page !== 'home' && !matchMedia('(prefers-reduced-motion: reduce)').matches) (() => {
    const layer = lake.el, small = innerWidth < 900;
    const N = small ? 5 : 9;
    const list = [];
    for (let i = 0; i < N; i++) {
      const s = STOCKS[(i * 5) % STOCKS.length];
      const el = document.createElement('i'); el.className = 'bd-frog';
      el.style.setProperty('--c', s.color); el.style.setProperty('--blink', (i * .9) + 's'); el.innerHTML = FROG_SVG(s);
      layer.appendChild(el);
      const size = (small ? 30 : 38) + Math.random() * (small ? 16 : 24);
      list.push({ el, size, x: Math.random() * innerWidth, y: Math.random() * innerHeight, a: Math.random() * 6.28, h: 0, state: 'idle', wait: Math.random() * 4, from: null, to: null, t: 0, dur: .6 });
    }
    const render = f => {
      f.el.style.setProperty('--x', (f.x - f.size / 2).toFixed(1) + 'px'); f.el.style.setProperty('--y', (f.y - f.size / 2).toFixed(1) + 'px');
      f.el.style.setProperty('--rot', (f.a * 180 / Math.PI).toFixed(1) + 'deg'); f.el.style.setProperty('--h', f.h.toFixed(3)); f.el.style.setProperty('--s', f.size + 'px');
    };
    const hop = f => {
      const W = innerWidth, H = innerHeight, m = 30;
      for (let k = 0; k < 20; k++) {
        const d = 50 + Math.random() * 170, ang = Math.random() * 6.28, x = f.x + Math.cos(ang) * d, y = f.y + Math.sin(ang) * d;
        if (x < m || x > W - m || y < 100 || y > H - m) continue;
        f.from = { x: f.x, y: f.y }; f.to = { x, y }; f.t = 0; f.a = Math.atan2(y - f.y, x - f.x); f.dur = .45 + d / 500;
        f.el.style.setProperty('--dur', f.dur + 's'); f.state = 'hop'; f.el.classList.add('is-hop'); splashAt(layer, f.x, f.y, .35); return;
      }
      f.x = innerWidth * Math.random(); f.y = 120 + Math.random() * (innerHeight - 160); f.wait = 1;
    };
    let last = performance.now();
    const step = now => {
      const paused = layer.classList.contains('is-paused') || document.hidden;
      const dt = paused ? 0 : Math.min(.05, (now - last) / 1000); last = now;
      for (const f of list) {
        if (f.state === 'idle') {
          f.wait -= dt;
          if (dt && (!f.cool || now > f.cool)) { const fly = lake.nearestFly(f.x, f.y, f.size * 2.6); if (fly) { f.cool = now + 2500; f.a = Math.atan2(fly.y - f.y, fly.x - f.x); f.wait = Math.max(f.wait, .8); render(f); tongue(layer, f.x + Math.cos(f.a) * f.size * .4, f.y + Math.sin(f.a) * f.size * .4, fly.x, fly.y, () => { lake.eat(fly); f.el.classList.add('is-gulp'); setTimeout(() => f.el.classList.remove('is-gulp'), 400); }); } }
          if (f.wait <= 0) hop(f);
        }
        else if (f.state === 'hop' && dt) {
          f.t = Math.min(1, f.t + dt / f.dur);
          const e = f.t < .5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
          f.x = f.from.x + (f.to.x - f.from.x) * e; f.y = f.from.y + (f.to.y - f.from.y) * e; f.h = Math.sin(Math.PI * f.t);
          if (f.t >= 1) { f.h = 0; f.state = 'idle'; f.wait = 1.5 + Math.random() * 5; f.el.classList.remove('is-hop'); f.el.classList.add('is-land'); setTimeout(() => f.el.classList.remove('is-land'), 520); splashAt(layer, f.x, f.y, .55); }
        }
        render(f);
      }
      requestAnimationFrame(step);
    };
    list.forEach(render); requestAnimationFrame(step);
  })();

  /* =====================================================================
     THE FROGS — the hero scene. Each frog is a stock. It sits, picks a
     spot, turns to face it, hops there in an arc, lands, sits again. It
     keeps out of the copy in the middle and inside the hero. Grab one and
     drop it anywhere; click one to pick its stock.
     ===================================================================== */
  function frogs() {
    const scene = $('#scene'), label = $('#fish-label'), hero = $('#hero'), copy = $('.bd-hero-in');
    if (!scene) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, top = 0, bottom = 0, avoid = null, pads = [], paused = false, running = true, selected = null, hovered = null;
    const frogs = STOCKS.map((s, i) => {
      const el = document.createElement('button');
      el.className = 'bd-frog'; el.type = 'button'; el.setAttribute('aria-label', s.sym + ' · ' + s.name);
      el.style.setProperty('--c', s.color); el.style.setProperty('--blink', (i * .7) + 's'); el.innerHTML = FROG_SVG(s);
      scene.appendChild(el);
      return { s, el, i, x: 0, y: 0, a: 0, h: 0, op: 1, state: 'idle', wait: 0, from: null, to: null, t: 0, dur: .6, size: 0 };
    });

    const measure = () => {
      W = scene.clientWidth; H = scene.clientHeight; top = 92; bottom = H - 70;
      const base = clamp(W / 17, 56, 88);
      frogs.forEach(f => { f.size = base * (0.86 + ((f.i * 7) % 5) * 0.07); });
      const r = copy.getBoundingClientRect(), sr = scene.getBoundingClientRect();
      avoid = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
      const sr2 = scene.getBoundingClientRect();
      pads = (lake ? lake.pads() : []).map(p => { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2 - sr2.left, y: r.top + r.height / 2 - sr2.top }; }).filter(p => p.y > top + 40 && p.y < bottom - 40 && p.x > 40 && p.x < W - 40);
    };
    const inRect = (x, y, r, pad) => r && x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
    const inside = (x, y, m) => x > m && x < W - m && y > top + m && y < bottom - m;
    const clearPath = (ax, ay, bx, by) => { for (let k = 0; k <= 8; k++) { const t = k / 8; if (inRect(ax + (bx - ax) * t, ay + (by - ay) * t, avoid, 30)) return false; } return true; };
    const pickTarget = f => {
      const m = f.size * .5;
      for (let k = 0; k < 40; k++) {
        let x, y;
        if (pads.length && Math.random() < .22) { const p = pads[Math.floor(Math.random() * pads.length)]; x = p.x + (Math.random() - .5) * 30; y = p.y + (Math.random() - .5) * 30; }
        else { const d = 90 + Math.random() * 220, ang = Math.random() * Math.PI * 2; x = f.x + Math.cos(ang) * d; y = f.y + Math.sin(ang) * d; }
        if (!inside(x, y, m) || inRect(x, y, avoid, 50) || !clearPath(f.x, f.y, x, y)) continue;
        if (frogs.some(o => o !== f && Math.hypot(o.x - x, o.y - y) < f.size * .8)) continue;
        return { x, y };
      }
      return null;
    };
    const randomSpot = f => { for (let k = 0; k < 80; k++) { const x = 40 + Math.random() * (W - 80), y = top + 40 + Math.random() * (bottom - top - 80); if (!inRect(x, y, avoid, 50) && !frogs.some(o => o !== f && Math.hypot(o.x - x, o.y - y) < f.size * .8)) return { x, y }; } return { x: 60, y: bottom - 60 }; };
    const mark = (x, y) => {
      const r = document.createElement('i'); r.className = 'bd-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; scene.appendChild(r); setTimeout(() => r.remove(), 1100);
      for (let k = 0; k < 5; k++) { const d = document.createElement('i'); d.className = 'bd-dust'; d.style.left = x + 'px'; d.style.top = y + 'px'; const ang = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 22; d.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px'); d.style.setProperty('--dy', (Math.sin(ang) * dist) + 'px'); scene.appendChild(d); setTimeout(() => d.remove(), 700); }
    };
    const sit = (f, wait) => { f.state = 'idle'; f.h = 0; f.wait = wait ?? (0.7 + Math.random() * 2.4); f.el.classList.remove('is-hop'); f.el.classList.add('is-land'); setTimeout(() => f.el.classList.remove('is-land'), 520); };
    const hop = f => {
      const to = pickTarget(f); if (!to) { f.wait = .8; return; }
      // crouch first, then push off
      f.state = 'crouch'; f.a = Math.atan2(to.y - f.y, to.x - f.x); f.el.classList.add('is-crouch'); render(f);
      setTimeout(() => {
        if (f.state !== 'crouch') return;
        f.el.classList.remove('is-crouch');
        f.from = { x: f.x, y: f.y }; f.to = to; f.t = 0;
        const dist = Math.hypot(to.x - f.x, to.y - f.y); f.dur = clamp(.42 + dist / 600, .45, .95); f.el.style.setProperty('--dur', f.dur + 's');
        f.state = 'hop'; f.el.classList.remove('is-land'); f.el.classList.add('is-hop');
        splashAt(scene, f.x - Math.cos(f.a) * f.size * .25, f.y - Math.sin(f.a) * f.size * .25, .6);
      }, 150);
    };
    const init = () => {
      measure();
      frogs.forEach(f => { const p = randomSpot(f); f.x = p.x; f.y = p.y; f.a = Math.random() * Math.PI * 2; f.state = 'idle'; f.h = 0; f.wait = Math.random() * 2.5; f.el.classList.remove('is-hop', 'is-land'); render(f); });
    };
    const render = f => {
      f.el.style.setProperty('--x', (f.x - f.size / 2).toFixed(1) + 'px'); f.el.style.setProperty('--y', (f.y - f.size / 2).toFixed(1) + 'px');
      f.el.style.setProperty('--rot', (f.a * 180 / Math.PI).toFixed(1) + 'deg'); f.el.style.setProperty('--h', f.h.toFixed(3));
      f.el.style.setProperty('--op', f.op); f.el.style.setProperty('--s', f.size + 'px');
    };
    const placeLabel = f => {
      if (!f) { label.classList.remove('is-on'); return; }
      label.innerHTML = `<b>${f.s.sym}</b> · ${esc(f.s.name)} · $${f.s.price.toFixed(2)} · Pair it ↗`;
      label.style.left = f.x + 'px'; label.style.top = (f.y - f.size / 2 - 36) + 'px'; label.classList.add('is-on');
    };

    let last = performance.now();
    const step = now => {
      const dt = paused ? 0 : Math.min(.05, (now - last) / 1000); last = now;
      for (const f of frogs) {
        if (f.state === 'drag') { render(f); continue; }
        if (f.state === 'idle' && dt) {
          f.wait -= dt;
          if (lake && (!f.cool || now > f.cool)) {
            const sr = scene.getBoundingClientRect(); const fly = lake.nearestFly(f.x + sr.left, f.y + sr.top, f.size * 1.9);
            if (fly) { f.cool = now + 2200; const tx = fly.x - sr.left, ty = fly.y - sr.top; f.a = Math.atan2(ty - f.y, tx - f.x); f.wait = Math.max(f.wait, .9); render(f); tongue(scene, f.x + Math.cos(f.a) * f.size * .4, f.y + Math.sin(f.a) * f.size * .4, tx, ty, () => { lake.eat(fly); f.el.classList.add('is-gulp'); setTimeout(() => f.el.classList.remove('is-gulp'), 400); }); }
          }
          if (f.wait <= 0 && !reduced) hop(f);
        }
        else if (f.state === 'hop' && dt) {
          f.t = Math.min(1, f.t + dt / f.dur);
          const e = f.t < .5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;   // ease in-out
          f.x = f.from.x + (f.to.x - f.from.x) * e; f.y = f.from.y + (f.to.y - f.from.y) * e;
          f.h = Math.sin(Math.PI * f.t);
          if (f.t >= 1) { f.x = f.to.x; f.y = f.to.y; splashAt(scene, f.x, f.y, .7 + f.size / 220); sit(f); }
        }
        render(f);
      }
      if (hovered || selected) placeLabel(hovered || selected);
      if (running && !reduced) requestAnimationFrame(step);
    };

    // pointer: grab, carry, drop, click
    let drag = null;
    frogs.forEach(f => {
      f.el.addEventListener('pointerdown', e => {
        e.preventDefault(); f.el.setPointerCapture(e.pointerId);
        drag = { f, sx: e.clientX, sy: e.clientY, ox: e.clientX - f.x, oy: e.clientY - f.y, moved: false, vx: 0, vy: 0 };
      });
      f.el.addEventListener('pointermove', e => {
        if (!drag || drag.f !== f) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) { drag.moved = true; f.state = 'drag'; f.h = .9; f.el.classList.remove('is-hop', 'is-land', 'is-crouch'); f.el.classList.add('is-drag'); splashAt(scene, f.x, f.y, .7); }
        if (!drag.moved) return;
        const nx = clamp(e.clientX - drag.ox, 10, W - 10), ny = clamp(e.clientY - drag.oy, 10, H - 10);
        drag.vx = nx - f.x; drag.vy = ny - f.y; f.x = nx; f.y = ny;
        if (Math.hypot(drag.vx, drag.vy) > 1.5) f.a = Math.atan2(drag.vy, drag.vx);
        render(f);
      });
      const release = () => {
        if (!drag || drag.f !== f) return;
        f.el.classList.remove('is-drag');
        if (drag.moved) {
          if (!inside(f.x, f.y, 20)) { const p = randomSpot(f); f.x = p.x; f.y = p.y; }
          splashAt(scene, f.x, f.y, 1.3); sit(f, .4 + Math.random());
        } else select(f);
        drag = null;
      };
      f.el.addEventListener('pointerup', release); f.el.addEventListener('pointercancel', release);
      f.el.addEventListener('pointerenter', () => { hovered = f; placeLabel(f); });
      f.el.addEventListener('pointerleave', () => { hovered = null; placeLabel(selected); });
    });

    const select = f => {
      selected = f; frogs.forEach(o => o.el.classList.toggle('is-bonded', o === f));
      $$('[data-hero-stock-name]').forEach(el => el.textContent = f.s.name);
      $$('[data-hero-stock]').forEach(el => el.textContent = f.s.sym);
      const launch = $('#hero-launch'); if (launch) launch.href = 'launch.html?stock=' + f.s.sym;
      splashAt(scene, f.x, f.y, .6); placeLabel(f);
    };

    // controls
    const motionBtn = $('#motion');
    motionBtn?.addEventListener('click', () => { paused = !paused; motionBtn.textContent = paused ? 'Resume motion' : 'Pause motion'; scene.classList.toggle('is-paused', paused); lake?.pause(paused); });
    $('#reset')?.addEventListener('click', () => { selected = null; frogs.forEach(o => o.el.classList.remove('is-bonded')); placeLabel(null); init(); $$('[data-hero-stock-name]').forEach(el => el.textContent = 'NVIDIA'); const l = $('#hero-launch'); if (l) l.href = 'launch.html'; });

    // save work when the hero is off screen or the tab is hidden
    const io = new IntersectionObserver(([en]) => { const on = en.isIntersecting && !document.hidden; if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(step); } if (!on) running = false; });
    io.observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !running) { running = true; last = performance.now(); requestAnimationFrame(step); } });
    addEventListener('resize', () => { const oW = W || 1, oH = H || 1; measure(); frogs.forEach(f => { f.x = f.x / oW * W; f.y = f.y / oH * H; render(f); }); });

    init();
    if (!reduced) requestAnimationFrame(step);
    return { select: sym => { const f = frogs.find(o => o.s.sym === sym); if (f) select(f); } };
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  if (page === 'home') {
    const scene = frogs();
    // how it works, illustrated with the frogs
    const pic = sym => { const s = stockOf(sym); return `<i class="bd-frog bd-frogpic" style="--c:${s.color}">${FROG_SVG(s)}</i>`; };
    const illus = {
      pick: `<div class="bd-illus-pick">${['TSLA', 'NVDA', 'AAPL', 'SPY'].map(sym => `<div class="bd-pick ${sym === 'NVDA' ? 'is-on' : ''}">${pic(sym)}<small>${sym}</small></div>`).join('')}</div>`,
      name: `<div class="bd-illus-name">${pic('TSLA')}<div><b>Robotaxi Season<i></i></b><span>$ROBO · in TSLA</span><em>1B fixed · no owner</em></div></div>`,
      bond: `<div class="bd-illus-bond">${pic('TSLA')}<div class="bd-bondline"></div><div class="bd-coin">$ROBO</div><span class="bd-livechip">LIVE</span></div>`,
    };
    $$('[data-illus]').forEach(el => { el.innerHTML = illus[el.dataset.illus] || ''; });
    const pairsGrid = $('#pairs-grid');
    adapter.pairs().then(pairs => {
      // one pair per big name, the busiest on each stock
      const pick = ['AMZN', 'NVDA', 'AAPL', 'MSFT', 'TSLA', 'GOOGL']
        .map(sym => pairs.filter(p => p.stock === sym).sort((a, b) => b.volume - a.volume)[0]).filter(Boolean);
      pairsGrid.innerHTML = pick.map(pairTile).join('');
    });
  }

  /* =====================================================================
     PAIRS BOARD
     ===================================================================== */
  if (page === 'board') {
    const rows = $('#rows'), cards = $('#cards'), empty = $('#empty'), chips = $('#stock-chips'), search = $('#search'), sortSel = $('#sort');
    const params = new URLSearchParams(location.search);
    const state = { tab: 'all', stock: params.get('stock') || 'all', q: params.get('q') || '', sort: 'volume', dir: -1 };
    if (state.q) search.value = state.q;
    let all = [];

    const applyFilters = () => {
      const q = state.q.trim().toLowerCase();
      let list = all.filter(p =>
        (state.stock === 'all' || p.stock === state.stock) &&
        (!q || p.name.toLowerCase().includes(q) || p.ticker.toLowerCase().includes(q) || p.stock.toLowerCase().includes(q)));
      if (state.tab === 'new') list = list.filter(p => Date.now() - p.createdAt < 24 * 3600e3);
      if (state.tab === 'hot') list = list.filter(p => p.volume / p.mcap > .25);
      if (state.tab === 'top') list = list.filter(p => p.mcap > 1e6);
      const key = { name: p => p.name.toLowerCase(), stock: p => p.stock, price: priceUsd, change: p => p.change, mcap: p => p.mcap, volume: p => p.volume, holders: p => p.holders, age: p => p.createdAt }[state.sort];
      list.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
      return list;
    };
    const render = () => {
      const list = applyFilters();
      empty.hidden = list.length > 0;
      $$('th[data-sort]').forEach(th => th.classList.toggle('is-sorted', th.dataset.sort === state.sort));
      rows.innerHTML = list.map(p => {
        const st = stockOf(p.stock);
        return `<tr data-href="${pairHref(p)}" style="cursor:pointer">
          <td><div class="bd-cell-pair">${avatar(p)}<div><b>${esc(p.name)} ${badge(p)}</b><span>$${esc(p.ticker)}</span></div></div></td>
          <td><span class="bd-stocktag"><i></i>${st.sym}</span></td>
          <td class="is-num bd-cell-price"><b>${fmtShares(priceShares(p))} ${st.sym}</b><span>≈ ${fmtUsd(priceUsd(p))}</span></td>
          <td class="is-num bd-mono ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</td>
          <td>${sparkline(p, 96, 30)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.mcap)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.volume)}</td>
          <td class="is-num bd-mono">${fmtNum(p.holders)}</td>
          <td class="is-num bd-mono">${fmtAge(p.createdAt)}</td>
          <td class="is-num"><a class="bd-btn bd-btn-xs bd-btn-gold" href="${pairHref(p)}">Trade</a></td>
        </tr>`;
      }).join('');
      cards.innerHTML = list.map(pairTile).join('');
    };
    rows.addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });

    adapter.stocks().then(stocks => {
      chips.innerHTML = `<button class="bd-chip ${state.stock === 'all' ? 'is-active' : ''}" data-stock="all" type="button">All stocks</button>` +
        stocks.map(s => `<button class="bd-chip ${state.stock === s.sym ? 'is-active' : ''}" data-stock="${s.sym}" type="button">${s.sym}</button>`).join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('[data-stock]'); if (!b) return;
        state.stock = b.dataset.stock; $$('.bd-chip', chips).forEach(c => c.classList.toggle('is-active', c === b)); render();
      });
    });
    adapter.pairs().then(pairs => { all = pairs; render(); });
    adapter.subscribe(ev => { if (ev.kind === 'launch' && !all.includes(ev.pair)) { all.unshift(ev.pair); render(); } });

    $('#tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      state.tab = b.dataset.tab; $$('.bd-tab').forEach(t => t.classList.toggle('is-active', t === b)); render();
    });
    search.addEventListener('input', () => { state.q = search.value; render(); });
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.dir = state.sort === 'name' || state.sort === 'stock' ? 1 : -1; render(); });
    $$('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      if (state.sort === th.dataset.sort) state.dir *= -1; else { state.sort = th.dataset.sort; state.dir = th.dataset.sort === 'name' || th.dataset.sort === 'stock' ? 1 : -1; }
      if ([...sortSel.options].some(o => o.value === state.sort)) sortSel.value = state.sort;
      render();
    }));
  }

  /* =====================================================================
     PAIR PAGE — chart, stats, trades, and the trade panel
     ===================================================================== */
  if (page === 'pair') {
    const root = $('#pp');
    const ticker = new URLSearchParams(location.search).get('t');
    const chartSvg = (series, w = 720, h = 300) => {
      const min = Math.min(...series), max = Math.max(...series), pad = { l: 8, r: 64, t: 12, b: 24 };
      const X = i => pad.l + i / (series.length - 1) * (w - pad.l - pad.r), Y = v => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
      const line = series.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
      const ticks = [max, (max + min) / 2, min];
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <g class="bd-grid">${ticks.map(v => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`).join('')}</g>
        <polygon class="bd-area" points="${X(0)},${h - pad.b} ${line} ${X(series.length - 1)},${h - pad.b}"/>
        <polyline class="bd-line" points="${line}"/>
        <g class="bd-axis">${ticks.map(v => `<text x="${w - pad.r + 8}" y="${(Y(v) + 3).toFixed(1)}">${fmtShares(v)}</text>`).join('')}</g>
      </svg>`;
    };
    const tradeRow = (t, st, p, fresh) => `<tr class="${fresh ? 'is-new' : ''}">
      <td class="${t.side === 'buy' ? 'bd-up' : 'bd-down'}">${t.side}</td>
      <td class="is-num">${fmtNum(t.amountStock)} ${st.sym}</td>
      <td class="is-num">${fmtNum(t.amountToken)} ${esc(p.ticker)}</td>
      <td class="is-num">${fmtShares(t.price)}</td>
      <td>${shortAddr(t.wallet)}</td>
      <td class="is-num" style="color:var(--dim)">${fmtTime(t.ts)}</td>
    </tr>`;

    adapter.pair(ticker).then(p => {
      if (!p) { root.innerHTML = `<div class="bd-empty" style="grid-column:1/-1">No pair called ${esc(ticker || '')}. <a class="bd-link" href="board.html">Back to the pairs</a>.</div>`; return; }
      const st = stockOf(p.stock);
      document.title = `$${p.ticker} / ${st.sym} — Bonded`;
      let range = '24h';
      const seriesFor = r => r === '1h' ? p.series.slice(-8) : r === '24h' ? p.series.slice(-24) : p.series;
      const rangeChange = r => { const s = seriesFor(r); return (s[s.length - 1] / s[0] - 1) * 100; };

      root.innerHTML = `
        <div>
          <div class="bd-pp-head">
            ${avatar(p)}
            <div>
              <div class="bd-pp-title">${esc(p.name)} ${badge(p)}</div>
              <div class="bd-pp-sub"><span>$${esc(p.ticker)}</span><span class="bd-stocktag"><i></i>${st.sym}</span><span>${fmtAge(p.createdAt)} ago</span><span>by ${shortAddr(p.creator)}</span></div>
            </div>
            <div class="bd-pp-price"><b id="pp-price">${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span></b><span id="pp-usd">≈ ${fmtUsd(priceUsd(p))} · <span class="${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span> 24h</span></div>
          </div>
          <div class="bd-chart ${p.change < 0 ? 'is-down' : ''}" id="chart">
            <div class="bd-chart-top">
              <span class="bd-label">Price · ${st.sym} per ${esc(p.ticker)}</span>
              <div class="bd-tabs" id="ranges"><button class="bd-tab" data-r="1h">1H</button><button class="bd-tab is-active" data-r="24h">24H</button><button class="bd-tab" data-r="7d">7D</button></div>
            </div>
            <div id="chart-svg">${chartSvg(seriesFor(range))}</div>
          </div>
          <div class="bd-stats">
            <div class="bd-stat"><span class="bd-label">Market cap</span><b id="pp-mcap">${fmtUsd(p.mcap)}</b></div>
            <div class="bd-stat"><span class="bd-label">Liquidity</span><b>${fmtUsd(p.liquidityUsd)} · locked</b></div>
            <div class="bd-stat"><span class="bd-label">24h volume</span><b id="pp-vol">${fmtUsd(p.volume)}</b></div>
            <div class="bd-stat"><span class="bd-label">Holders</span><b id="pp-holders">${fmtNum(p.holders)}</b></div>
            <div class="bd-stat"><span class="bd-label">Token</span><b class="bd-small">${shortAddr(p.address)} <button class="bd-copy" data-copy="x" data-copy-text="${p.address}">copy</button></b></div>
            <div class="bd-stat"><span class="bd-label">Pool</span><b class="bd-small">${shortAddr('0x' + p.address.slice(6) + '0f0f')} <button class="bd-copy" data-copy="x" data-copy-text="0x${p.address.slice(6)}0f0f">copy</button></b></div>
            <div class="bd-stat"><span class="bd-label">Supply</span><b class="bd-small">${CONFIG.supply.toLocaleString('en-US')} · fixed</b></div>
            <div class="bd-stat"><span class="bd-label">Ownership</span><b class="bd-small">renounced</b></div>
          </div>
          <div class="bd-pp-section">
            <h3>About</h3>
            <div class="bd-about">
              ${esc(p.desc || 'No description given.')}
              <div class="bd-links">
                ${p.x ? `<a class="bd-btn bd-btn-xs bd-btn-ghost" href="${esc(p.x)}" target="_blank" rel="noopener">X ↗</a>` : ''}
                ${p.site ? `<a class="bd-btn bd-btn-xs bd-btn-ghost" href="${esc(p.site)}" target="_blank" rel="noopener">Website ↗</a>` : ''}
                <a class="bd-btn bd-btn-xs bd-btn-ghost" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">Explorer ↗</a>
                <a class="bd-btn bd-btn-xs bd-btn-ghost" href="board.html?stock=${st.sym}">More ${st.sym} pairs →</a>
              </div>
            </div>
          </div>
          <div class="bd-pp-section">
            <h3>Trades</h3>
            <div style="overflow-x:auto"><table class="bd-trades"><thead><tr><th>Side</th><th class="is-num">${st.sym}</th><th class="is-num">${esc(p.ticker)}</th><th class="is-num">Price</th><th>Wallet</th><th class="is-num">Time</th></tr></thead>
            <tbody id="trades">${p.trades.map(t => tradeRow(t, st, p, false)).join('')}</tbody></table></div>
          </div>
        </div>
        <aside class="bd-trade" id="trade">
          <div class="bd-tabs"><button class="bd-tab is-buy is-active" data-side="buy">Buy</button><button class="bd-tab is-sell" data-side="sell">Sell</button></div>
          <div class="bd-amount">
            <label><span id="amt-label">You pay</span><a id="amt-max">max</a></label>
            <div class="bd-amount-row"><input id="amt" type="number" min="0" step="any" placeholder="0.00" inputmode="decimal"><span class="bd-unit" id="amt-unit">${st.sym}</span></div>
          </div>
          <div class="bd-quick" id="quick"></div>
          <div class="bd-arrow">↓</div>
          <div class="bd-amount">
            <label><span>You receive</span><span id="out-usd"></span></label>
            <div class="bd-amount-row"><input id="out" readonly placeholder="0"><span class="bd-unit is-coin" id="out-unit">${esc(p.ticker)}</span></div>
          </div>
          <div class="bd-quote">
            <div><span>Price</span><b>${fmtShares(priceShares(p))} ${st.sym}</b></div>
            <div><span>Price impact</span><b id="q-impact">—</b></div>
            <div><span>Fee (${CONFIG.swapFee})</span><b id="q-fee">—</b></div>
            <div><span>Min. received (1% slippage)</span><b id="q-min">—</b></div>
          </div>
          <button class="bd-btn bd-btn-buy" id="go" type="button">Connect wallet</button>
          <div class="bd-holding"><span>You hold</span><b id="hold">—</b></div>
          <div class="bd-error" id="t-error" hidden></div>
        </aside>`;

      // ranges
      $('#ranges').addEventListener('click', e => {
        const b = e.target.closest('[data-r]'); if (!b) return; range = b.dataset.r;
        $$('#ranges .bd-tab').forEach(t => t.classList.toggle('is-active', t === b));
        $('#chart').classList.toggle('is-down', rangeChange(range) < 0); $('#chart-svg').innerHTML = chartSvg(seriesFor(range));
      });

      // trade panel
      let side = 'buy', amount = 0, quote = null, holding = 0;
      const refreshHolding = async () => { holding = (await adapter.holdings(wallet?.address)).find(h => h.ticker === p.ticker)?.amount || 0; $('#hold').textContent = `${fmtNum(holding)} $${p.ticker} ≈ ${fmtNum(holding * priceShares(p))} ${st.sym}`; };
      const paintSide = () => {
        $$('#trade .bd-tab').forEach(t => t.classList.toggle('is-active', t.dataset.side === side));
        $('#amt-label').textContent = side === 'buy' ? 'You pay' : 'You sell'; $('#amt-unit').textContent = side === 'buy' ? st.sym : p.ticker; $('#amt-unit').classList.toggle('is-coin', side === 'sell');
        $('#out-unit').textContent = side === 'buy' ? p.ticker : st.sym; $('#out-unit').classList.toggle('is-coin', side === 'buy');
        $('#quick').innerHTML = side === 'buy' ? ['0.01', '0.05', '0.1', '0.5'].map(v => `<button data-v="${v}">${v} ${st.sym}</button>`).join('') : ['25', '50', '75', '100'].map(v => `<button data-pct="${v}">${v}%</button>`).join('');
        const go = $('#go'); go.className = 'bd-btn ' + (side === 'buy' ? 'bd-btn-buy' : 'bd-btn-sell');
        $('#amt').value = ''; amount = 0; paintQuote();
      };
      const paintQuote = async () => {
        const go = $('#go');
        if (!amount) { $('#out').value = ''; $('#out-usd').textContent = ''; $('#q-impact').textContent = $('#q-fee').textContent = $('#q-min').textContent = '—'; go.textContent = wallet ? (side === 'buy' ? `Buy $${p.ticker}` : `Sell $${p.ticker}`) : 'Connect wallet'; return; }
        quote = await adapter.quote({ ticker: p.ticker, side, amount });
        $('#out').value = fmtNum(quote.out);
        $('#out-usd').textContent = '≈ ' + fmtUsd(side === 'buy' ? quote.out * priceUsd(p) : quote.out * st.price);
        $('#q-impact').textContent = (quote.priceImpact * 100).toFixed(2) + '%'; $('#q-impact').className = quote.priceImpact > .05 ? 'bd-down' : '';
        $('#q-fee').textContent = fmtNum(quote.fee) + ' ' + quote.feeUnit; $('#q-min').textContent = fmtNum(quote.out * .99) + ' ' + (side === 'buy' ? p.ticker : st.sym);
        go.textContent = wallet ? (side === 'buy' ? `Buy ${fmtNum(quote.out)} $${p.ticker}` : `Sell for ${fmtNum(quote.out)} ${st.sym}`) : 'Connect wallet';
      };
      $('#trade').addEventListener('click', e => {
        const t = e.target.closest('[data-side]'); if (t) { side = t.dataset.side; paintSide(); return; }
        const q = e.target.closest('#quick button'); if (q) { const v = q.dataset.v ? Number(q.dataset.v) : holding * Number(q.dataset.pct) / 100; $('#amt').value = v ? +v.toFixed(6) : ''; amount = v || 0; paintQuote(); }
      });
      $('#amt').addEventListener('input', e => { amount = Math.max(0, Number(e.target.value) || 0); paintQuote(); });
      $('#amt-max').addEventListener('click', () => { if (side === 'sell') { $('#amt').value = +holding.toFixed(6); amount = holding; paintQuote(); } });
      $('#go').addEventListener('click', async () => {
        const err = $('#t-error'); err.hidden = true;
        if (!wallet && !(await connect())) return;
        if (!amount) { paintQuote(); return; }
        if (side === 'sell' && amount > holding + 1e-9) { err.hidden = false; err.textContent = `You hold ${fmtNum(holding)} $${p.ticker}.`; return; }
        const go = $('#go'); go.disabled = true; go.textContent = 'Waiting for signature…';
        try {
          const res = await adapter.swap({ ticker: p.ticker, side, amount, wallet: wallet.address });
          const tr = res.trade; $('#trades').insertAdjacentHTML('afterbegin', tradeRow(tr, st, p, true));
          toast(side === 'buy' ? `Bought ${fmtNum(tr.amountToken)} $${p.ticker} for ${fmtNum(tr.amountStock)} ${st.sym}` : `Sold ${fmtNum(tr.amountToken)} $${p.ticker} for ${fmtNum(tr.amountStock)} ${st.sym}`);
          $('#pp-price').innerHTML = `${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span>`; $('#pp-mcap').textContent = fmtUsd(p.mcap); $('#pp-vol').textContent = fmtUsd(p.volume); $('#pp-holders').textContent = fmtNum(p.holders);
          $('#amt').value = ''; amount = 0; await refreshHolding(); paintQuote();
        } catch (e) { err.hidden = false; err.textContent = e?.message || 'The transaction was rejected.'; }
        finally { go.disabled = false; }
      });
      document.addEventListener('bonded:wallet', () => { refreshHolding(); paintQuote(); });
      paintSide(); refreshHolding();
      // other people's trades on this pair land in the table too
      adapter.subscribe(ev => { if (ev.pair?.ticker === p.ticker && (ev.kind === 'buy' || ev.kind === 'sell') && ev.wallet !== wallet?.address) { $('#trades').insertAdjacentHTML('afterbegin', tradeRow(ev, st, p, true)); } });
    });
  }

  /* =====================================================================
     LIVE LAUNCHES
     ===================================================================== */
  if (page === 'live') {
    const feed = $('#feed'), fresh = $('#fresh');
    const item = (ev, isNew) => {
      const p = ev.pair, st = stockOf(p.stock);
      const text = ev.kind === 'launch'
        ? `<b>${esc(p.name)}</b> <span>bonded to</span> <b class="bd-gold">${st.sym}</b> <span>by ${shortAddr(ev.wallet)}</span>`
        : `<span>${shortAddr(ev.wallet)} ${ev.kind === 'buy' ? 'bought' : 'sold'}</span> <b>${fmtNum(ev.amountToken)} $${esc(p.ticker)}</b> <span>for</span> <b>${fmtNum(ev.amountStock)} ${st.sym}</b>`;
      return `<a class="bd-feed-item ${isNew ? 'is-new' : ''}" href="${pairHref(p)}"><span class="bd-feed-kind is-${ev.kind}">${ev.kind}</span>${avatar(p)}<div class="bd-feed-text">${text}</div><time>${fmtTime(ev.ts)}</time></a>`;
    };
    const paintFresh = pairs => { fresh.innerHTML = pairs.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map(pairTile).join(''); };
    adapter.pairs().then(pairs => {
      // a plausible recent past, so the page is never empty
      const past = pairs.flatMap(p => tradeHistory(p).slice(0, 2).map(t => ({ ...t, kind: t.side, pair: p })))
        .concat(pairs.filter(p => Date.now() - p.createdAt < 6 * 3600e3).map(p => ({ kind: 'launch', pair: p, wallet: p.creator, ts: p.createdAt })))
        .sort((a, b) => b.ts - a.ts).slice(0, 24);
      feed.innerHTML = past.map(ev => item(ev, false)).join('');
      paintFresh(pairs);
      adapter.subscribe(ev => {
        feed.insertAdjacentHTML('afterbegin', item(ev, true));
        while (feed.children.length > 60) feed.lastElementChild.remove();
        if (ev.kind === 'launch') adapter.pairs().then(paintFresh);
      });
    });
  }

  /* =====================================================================
     STOCKS
     ===================================================================== */
  if (page === 'stocks') {
    const grid = $('#stocks-grid'), detail = $('#stock-detail');
    let current = new URLSearchParams(location.search).get('s') || 'NVDA', stocks = [], pairs = [];
    const paint = () => {
      const s = stocks.find(x => x.sym === current) || stocks[0]; if (!s) return;
      $$('.bd-element', grid).forEach(b => b.classList.toggle('is-active', b.dataset.sym === s.sym));
      const mine = pairs.filter(p => p.stock === s.sym).sort((a, b) => b.volume - a.volume);
      const vol = mine.reduce((t, p) => t + p.volume, 0), liq = mine.reduce((t, p) => t + p.mcap * .31, 0);
      detail.innerHTML = `
        <div class="bd-sd-head"><div class="bd-sd-atom">${s.sym}</div><div><h3>${esc(s.name)}</h3><p>$${s.price.toFixed(2)} · <span class="${s.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(s.change)}</span> today</p></div></div>
        <div class="bd-sd-stats">
          <div class="bd-stat"><span class="bd-label">Pairs</span><b>${s.pairs}</b></div>
          <div class="bd-stat"><span class="bd-label">24h volume</span><b>${fmtUsd(vol * 3.6)}</b></div>
          <div class="bd-stat"><span class="bd-label">Liquidity in ${s.sym}</span><b>${fmtUsd(liq * 4.2)}</b></div>
          <div class="bd-stat"><span class="bd-label">Quoted as</span><b class="bd-small">${s.sym} per token</b></div>
        </div>
        <div class="bd-hero-cta bd-hero-cta-row" style="flex-direction:row;justify-content:flex-start;margin-bottom:16px">
          <a class="bd-btn bd-btn-primary bd-btn-sm" href="launch.html?stock=${s.sym}">Launch on ${s.sym}</a>
          <a class="bd-btn bd-btn-ghost bd-btn-sm" href="board.html?stock=${s.sym}">All ${s.sym} pairs →</a>
        </div>
        <span class="bd-label">Busiest pairs</span>
        <div class="bd-sd-list" style="margin-top:8px">${mine.slice(0, 6).map(p => `<a class="bd-sd-row" href="${pairHref(p)}">${avatar(p)}<b>${esc(p.name)}</b><span>${fmtUsd(p.volume)}</span><span class="${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span></a>`).join('') || '<div class="bd-empty">No pairs yet. Be the first.</div>'}</div>`;
      history.replaceState(null, '', 'stocks.html?s=' + s.sym);
    };
    Promise.all([adapter.stocks(), adapter.pairs()]).then(([s, p]) => {
      stocks = s; pairs = p;
      grid.innerHTML = stocks.map(x => elementTile(x, x.sym === current)).join('');
      grid.addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; current = b.dataset.sym; paint(); });
      paint();
    });
  }

  /* =====================================================================
     LAUNCH
     ===================================================================== */
  if (page === 'launch') {
    const params = new URLSearchParams(location.search);
    const form = { stock: params.get('stock') || 'NVDA', name: '', ticker: '', desc: '', image: '', buy: '', x: '', site: '' };
    const art = $('#preview-art'), card = $('#preview-card'), review = $('#review'), sel = $('#f-stock');

    const previewPair = () => ({
      name: form.name || 'Your coin', ticker: form.ticker || 'TKN', stock: form.stock, image: /^https?:\/\//.test(form.image) ? form.image : '',
      mcap: 25_000 + (form.buy ? Number(form.buy) * stockOf(form.stock).price * 12 : 0), volume: 0, change: 0, holders: 1, createdAt: Date.now(),
    });
    const rows = () => {
      const st = stockOf(form.stock);
      return [
        ['Stock', `${st.sym} · ${esc(st.name)}`], ['Priced in', `${st.sym} per coin`],
        ['Supply', '1.00B · fixed'], ['Liquidity', 'locked at launch'], ['Ownership', 'renounced'],
        ['First buy', form.buy ? `${Number(form.buy)} ${st.sym}` : 'none'],
        ['Swap fee', `${CONFIG.swapFee} · ${CONFIG.creatorShare} to you`], ['Creation fee', CONFIG.fee], ['Chain', CONFIG.chain],
      ];
    };
    const paint = () => {
      const st = stockOf(form.stock);
      art.style.setProperty('--sc', st.color);
      art.innerHTML = `<i class="bd-frog bd-frogpic" style="--c:${st.color}">${FROG_SVG(st)}</i><span class="bd-preview-ticker">${esc(form.ticker || 'TICKER')} · ${st.sym}</span>`;
      $('#sum-name').textContent = form.name || 'Your coin';
      $('#sum-sub').textContent = `${form.ticker || 'TICKER'} · priced in ${st.name}`;
      review.innerHTML = rows().map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
      card.innerHTML = `<div class="bd-paircard">${pairCard(previewPair())}</div>`;
      $('#f-ticker-pair').textContent = '/ ' + st.sym; $('#f-buy-unit').textContent = st.sym;
    };
    adapter.stocks().then(stocks => {
      if (!stocks.some(s => s.sym === form.stock)) form.stock = stocks[0].sym;
      sel.innerHTML = stocks.map(s => `<option value="${s.sym}" ${s.sym === form.stock ? 'selected' : ''}>${s.sym} — ${esc(s.name)} · $${s.price.toFixed(2)}</option>`).join('');
      sel.addEventListener('change', () => { form.stock = sel.value; paint(); });
      paint();
    });
    const fields = { name: '#f-name', ticker: '#f-ticker', desc: '#f-desc', image: '#f-image', buy: '#f-buy', x: '#f-x', site: '#f-site' };
    Object.entries(fields).forEach(([k, s]) => $(s).addEventListener('input', e => {
      form[k] = k === 'ticker' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value;
      if (k === 'ticker') e.target.value = form[k];
      paint();
    }));
    const validate = () => {
      const err = $('#f-error'); const problems = [];
      if (form.name.trim().length < 2) problems.push('Give the coin a name (2 to 32 characters).');
      if (form.ticker.length < 2 || form.ticker.length > 8) problems.push('The ticker needs 2 to 8 letters or digits.');
      if (form.ticker && STOCKS.some(s => s.sym === form.ticker)) problems.push('That ticker is a stock symbol; pick another.');
      if (form.ticker && findPair(form.ticker)) problems.push('That ticker is already bonded; pick another.');
      if (form.buy && Number(form.buy) < 0) problems.push('The first buy cannot be negative.');
      if (form.image && !/^https?:\/\//.test(form.image)) problems.push('The image needs a full https URL.');
      err.hidden = !problems.length; err.textContent = problems.join(' ');
      if (problems.length) err.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return !problems.length;
    };
    const deployBtn = $('#deploy'), callout = $('#wallet-callout');
    const paintDeploy = () => { deployBtn.textContent = wallet ? 'Bond it' : 'Connect wallet to bond'; callout.classList.toggle('is-connected', !!wallet); };
    document.addEventListener('bonded:wallet', paintDeploy); paintDeploy();
    deployBtn.addEventListener('click', async () => {
      const err = $('#tx-error'); err.hidden = true;
      if (!validate()) return;
      if (!wallet && !(await connect())) { err.hidden = false; err.textContent = 'No wallet connected.'; return; }
      deployBtn.disabled = true; deployBtn.textContent = 'Waiting for signature…';
      try {
        const res = await adapter.createPair({ ...form, supply: CONFIG.supply, creator: wallet.address });
        const st = stockOf(form.stock);
        $('#done').innerHTML = [['Pair', `${esc(form.ticker)} / ${st.sym}`], ['Token', res.tokenAddress], ['Pool', res.pairAddress], ['Transaction', res.txHash.slice(0, 18) + '…']]
          .map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
        $('#done-tx').href = `${CONFIG.explorer}/tx/${res.txHash}`; $('#done-open').href = 'pair.html?t=' + encodeURIComponent(form.ticker);
        $('.bd-launch').hidden = true; $('#done-wrap').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
        toast(`$${form.ticker} is bonded to ${st.sym}`);
      } catch (e) { err.hidden = false; err.textContent = e?.message || 'The transaction was rejected.'; }
      finally { deployBtn.disabled = false; paintDeploy(); }
    });
  }

  /* =====================================================================
     MY PLAYGROUND — launches and positions
     ===================================================================== */
  if (page === 'playground') {
    const root = $('#mine');
    const paint = async () => {
      if (!wallet) {
        root.innerHTML = `<div class="bd-mine-connect"><h2>Connect to see your playground.</h2><p>Your launches, your positions and the fees you have earned.</p><button class="bd-btn bd-btn-primary" id="mine-connect" type="button">Connect wallet</button></div>`;
        $('#mine-connect').addEventListener('click', connect); return;
      }
      const [pairs, launchedT, holdings] = await Promise.all([adapter.pairs(), adapter.launched(wallet.address), adapter.holdings(wallet.address)]);
      const launched = launchedT.map(t => pairs.find(p => p.ticker === t)).filter(Boolean);
      const positions = holdings.map(h => ({ ...h, p: pairs.find(p => p.ticker === h.ticker) })).filter(x => x.p);
      const valueUsd = positions.reduce((s, x) => s + x.amount * priceUsd(x.p), 0);
      const fees = launched.reduce((s, p) => s + p.volume * CONFIG.swapFeeRate * CONFIG.creatorShareRate, 0);
      root.innerHTML = `
        <div class="bd-mine-summary">
          <div class="bd-stat"><span class="bd-label">Positions</span><b>${fmtUsd(valueUsd)}</b></div>
          <div class="bd-stat"><span class="bd-label">Pairs held</span><b>${positions.length}</b></div>
          <div class="bd-stat"><span class="bd-label">Launched</span><b>${launched.length}</b></div>
          <div class="bd-stat"><span class="bd-label">Creator fees</span><b>${fmtUsd(fees)}</b></div>
        </div>
        <h3>Launched by you</h3>
        ${launched.length ? `<div class="bd-pairs">${launched.map(pairTile).join('')}</div><div style="margin-top:12px"><button class="bd-btn bd-btn-ghost bd-btn-sm" id="claim" type="button">Claim ${fmtUsd(fees)} in fees</button></div>`
          : `<div class="bd-mine-empty">Nothing launched from ${shortAddr(wallet.address)} yet.<br><a class="bd-btn bd-btn-primary bd-btn-sm" href="launch.html">Launch a pair</a></div>`}
        <h3>Positions</h3>
        ${positions.length ? `<div style="overflow-x:auto"><table class="bd-trades"><thead><tr><th>Pair</th><th class="is-num">Amount</th><th class="is-num">Value in stock</th><th class="is-num">Value</th><th class="is-num">24h</th><th></th></tr></thead><tbody>
          ${positions.map(({ p, amount }) => { const st = stockOf(p.stock); return `<tr><td style="font-family:var(--font-body)"><div class="bd-cell-pair">${avatar(p)}<div><b>${esc(p.name)}</b><span>$${esc(p.ticker)} / ${st.sym}</span></div></div></td><td class="is-num">${fmtNum(amount)}</td><td class="is-num">${fmtNum(amount * priceShares(p))} ${st.sym}</td><td class="is-num">${fmtUsd(amount * priceUsd(p))}</td><td class="is-num ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</td><td class="is-num"><a class="bd-btn bd-btn-xs bd-btn-gold" href="${pairHref(p)}">Trade</a></td></tr>`; }).join('')}
        </tbody></table></div>`
          : `<div class="bd-mine-empty">No positions yet. Buy into a pair and it shows up here.<br><a class="bd-btn bd-btn-ghost bd-btn-sm" href="board.html">Explore the pairs</a></div>`}`;
      $('#claim')?.addEventListener('click', () => toast(`Claimed ${fmtUsd(fees)} in creator fees`));
    };
    document.addEventListener('bonded:wallet', paint); paint();
  }

  /* =====================================================================
     DOCS — active section in the sidebar
     ===================================================================== */
  if (page === 'docs') {
    const side = $$('#docs-side a[data-scroll]');
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) side.forEach(a => a.classList.toggle('is-active', a.dataset.scroll === en.target.id)); }), { rootMargin: '-20% 0px -70% 0px' });
    side.forEach(a => { const t = document.getElementById(a.dataset.scroll); if (t) io.observe(t); });
  }
})();
