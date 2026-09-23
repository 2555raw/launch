/* Spinpad — configuration.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE PAIRING TABLE IS THE PRODUCT. It lives here and nowhere else.
 *
 * The wheel gives two things — a body position and a colour — and the pair of
 * them names one asset. Four positions by four colours is sixteen cells, and
 * `pairings` below is all sixteen, written flat so changing one is changing one
 * line. Everything on the site is built from this object: the wheel, the board,
 * the asset desk, and the value written into the coin's contract. Nothing keeps
 * a second copy of it.
 *
 * TWO THINGS, KEPT APART ON PURPOSE.
 *
 * The PAIRING is a name. It goes into the coin's contract at construction and
 * cannot be changed afterwards. It is not a claim about a share price: there is
 * no oracle, nothing tracks anything, and none of these companies have anything
 * to do with this.
 *
 * The POOL is a real token. A company is not an ERC-20, so a pool cannot be
 * opened against "Tesla". Every pool opens against `quote` below, whose address
 * the pad verifies against the live chain before it will touch it.
 *
 * ONE NOTE WORTH READING ONCE. Naming a tradeable token after a listed company
 * is a real-world risk, not a styling choice: other people's trademarks, and
 * regulators who take an interest in anything that looks like a bet on a share.
 * This file is where you would change the names if you would rather not carry
 * that.
 *
 * ADDRESSES ARE EMPTY ON PURPOSE. They were not written from memory, because a
 * wrong one sends real liquidity somewhere it cannot be recovered from. Fill
 * them from a source you trust; the pad checks them before it uses them.
 * ────────────────────────────────────────────────────────────────────────────
 */
window.SPINPAD_CONFIG = {
  chain: {
    id: 8453,                                   // Base mainnet
    hex: '0x2105',
    name: 'Base',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    // Only used if the wallet does not know the chain yet, via wallet_addEthereumChain.
    rpc: ['https://mainnet.base.org'],
    explorer: 'https://basescan.org',
  },

  /* The router that opens the pool and takes the first liquidity.
   * Uniswap V2-compatible: addLiquidity / addLiquidityETH. A Solidly-style
   * router (Aerodrome) has a different signature and will not work unchanged —
   * the pad checks the interface before it calls it. */
  router: {
    address: '',                                // ← fill in, then verify
    kind: 'uniswap-v2',
    weth: '',                                   // ← the router's WETH(), fill in
  },

  /* Every pool is opened against this one token. It is the only address the pad
   * needs to move money, and it is checked against the chain on connect. */
  quote: {
    name: 'Wrapped Ether',
    ticker: 'WETH',
    address: '',                                // ← fill in, then verify
    decimals: 18,
  },

  /* The wheel's two axes. The order is the order they sit in: clockwise on the
     wheel, and top-to-bottom / left-to-right on the board. */
  positions: [
    { id: 'leftHand',  label: 'Left hand',  short: 'L HAND', limb: 'hand' },
    { id: 'rightHand', label: 'Right hand', short: 'R HAND', limb: 'hand' },
    { id: 'leftFoot',  label: 'Left foot',  short: 'L FOOT', limb: 'foot' },
    { id: 'rightFoot', label: 'Right foot', short: 'R FOOT', limb: 'foot' },
  ],

  colours: [
    { id: 'red',    label: 'Red',    hex: '#E4322B' },
    { id: 'yellow', label: 'Yellow', hex: '#FDD208' },
    { id: 'green',  label: 'Green',  hex: '#2FA84F' },
    { id: 'blue',   label: 'Blue',   hex: '#1B75BC' },
  ],

  /* position + colour → asset. Sixteen cells, one line each.
   *
   * The four in a colour were picked to look like that colour, which is why
   * they read as a set on the wheel: green is Nvidia, Spotify, USDG and
   * Starbucks; red is Tesla, Coca-Cola, Netflix and YouTube; yellow is Amazon,
   * Snapchat, Microsoft and McDonald's; blue is Meta, Walmart, Skype and Intel.
   * Moving one to another colour is moving its line.
   *
   *
   * `glyph` is the mark drawn on the node when there is no logo file; the names
   * come from the set in app.js. `logo` already points at assets/<ticker>.png,
   * so adding a real one is dropping a file in — nothing to edit here. A
   * missing file costs nothing: the drawn mark stays. See assets/README.md. */
  pairings: {
    'leftHand.red':     { name: 'Netflix',    ticker: 'NFLX',  glyph: 'play',     logo: 'assets/nflx.png' },
    'leftHand.yellow':  { name: 'Amazon',     ticker: 'AMZN',  glyph: 'arc',      logo: 'assets/amzn.png' },
    'leftHand.green':   { name: 'Spotify',    ticker: 'SPOT',  glyph: 'waves',    logo: 'assets/spot.png' },
    'leftHand.blue':    { name: 'Meta',       ticker: 'META',  glyph: 'loop',     logo: 'assets/meta.png' },

    'rightHand.red':    { name: 'Coca-Cola',  ticker: 'KO',    glyph: 'wave',     logo: 'assets/ko.png' },
    'rightHand.yellow': { name: 'Snapchat',   ticker: 'SNAP',  glyph: 'tiles',    logo: 'assets/snap.png' },
    'rightHand.green':  { name: 'Nvidia',     ticker: 'NVDA',  glyph: 'chevron',  logo: 'assets/nvda.png' },
    'rightHand.blue':   { name: 'Intel',      ticker: 'INTC',  glyph: 'rail',     logo: 'assets/intc.png' },

    'leftFoot.red':     { name: 'YouTube',    ticker: 'YT',    glyph: 'arrowbox', logo: 'assets/yt.png' },
    'leftFoot.yellow':  { name: "McDonald's", ticker: 'MCD',   glyph: 'delta',    logo: 'assets/mcd.png' },
    'leftFoot.green':   { name: 'Starbucks',  ticker: 'SBUX',  glyph: 'orbit',    logo: 'assets/sbux.png' },
    'leftFoot.blue':    { name: 'Skype',      ticker: 'SKYPE', glyph: 'stack',    logo: 'assets/skype.png' },

    'rightFoot.red':    { name: 'Tesla',      ticker: 'TSLA',  glyph: 'bolt',     logo: 'assets/tsla.png' },
    'rightFoot.yellow': { name: 'Microsoft',  ticker: 'MSFT',  glyph: 'grid',     logo: 'assets/msft.png' },
    'rightFoot.green':  { name: 'USDG',       ticker: 'USDG',  glyph: 'dollar',   logo: 'assets/usdg.png' },
    'rightFoot.blue':   { name: 'Walmart',    ticker: 'WMT',   glyph: 'spark',    logo: 'assets/wmt.png' },
  },

  /* What the pad puts into the first pool, as a fraction of the coin's supply
   * and an amount of the drawn token. Both are confirmed in the wallet before
   * anything moves. */
  liquidity: {
    supplyShare: 0.8,          // 80% of the new coin goes into the pool
    slippageBps: 100,          // 1%
    deadlineMinutes: 20,
  },
};
