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
 * AND NO, NOT A TOKENIZED SHARE EITHER. This comes up, so: tokenized US
 * equities do exist as ERC-20s on Base — Dinari's dShares, and their official
 * SDK lists eip155:8453 among its chains. They still cannot be the quote token
 * here, because they are permissioned: that same SDK is built around KYC, with
 * document types, statuses and managed checks, so only approved wallets may
 * hold the token. A Uniswap V2 pair is an anonymous contract with no KYC, so
 * addLiquidity's transferFrom into the pair reverts. A permissionless pool
 * against a permissioned token is not a thing.
 *
 * (Backed Finance's xStocks — AAPLx, TSLAx, GOOGLx — are Solana SPL tokens, so
 * they are not candidates on an EVM chain at all.)
 *
 * Which is why the sixteen are names and the pool is WETH. That is not a
 * shortcut around the hard version; it is the only shape that works.
 *
 * ONE NOTE WORTH READING ONCE. Naming a tradeable token after a listed company
 * is a real-world risk, not a styling choice: other people's trademarks, and
 * regulators who take an interest in anything that looks like a bet on a share.
 * This file is where you would change the names if you would rather not carry
 * that.
 *
 * ADDRESSES. None of these was written from memory. `quote` is filled in with
 * WETH on Base, taken from Uniswap's own published token list and corroborated
 * by a second Uniswap package. `router` is still empty because no package
 * publishes a V2 router for Base, and a wrong one sends real liquidity
 * somewhere it cannot be recovered from. The pad checks whatever is here
 * against the live chain before it uses it.
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
  /* STILL EMPTY, and not for the same reason the quote token was. There is no
   * package on npm that publishes a V2 router address for Base: @uniswap/v2-sdk
   * ships one factory, 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f, and that is
   * Ethereum mainnet. So there was nothing to copy from a source, and writing
   * forty characters from memory into the call that moves the liquidity is how
   * money ends up somewhere nobody can get it back from.
   *
   * Fill both from the router's own deployment page. The pad checks it before
   * it will use it: WETH() has to return `weth` below and factory() has to
   * answer at all, or pools stay off and deploying still works.
   *
   * Aerodrome is the big one on Base and is NOT a drop-in: it is Solidly-style,
   * its addLiquidity takes a `stable` flag this pad does not send. */
  router: {
    address: '',                                // ← fill in, then verify
    kind: 'uniswap-v2',
    weth: '',                                   // ← the router's WETH(), fill in
  },

  /* Every pool is opened against this one token. It is the only address the pad
   * needs to move money, and it is checked against the chain on connect.
   *
   * WETH on Base, and the one address here that was not written from memory:
   * it came out of the `@uniswap/default-token-list` package (Uniswap Labs
   * Default, v22.21.0) and is corroborated by the WETH9 map in
   * `@uniswap/sdk-core`, which is a second package agreeing on the same forty
   * characters. Check it yourself against basescan before you put money
   * through it; the pad also calls symbol() and decimals() on connect and
   * refuses it if the chain disagrees.
   *
   * To pair against something else, replace these four lines. From the same
   * list, on Base:
   *   USDC   6  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   *   USDbC  6  0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA
   *   cbBTC  8  0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf
   *   DAI   18  0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb
   *   EURC   6  0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42
   * The ticker and decimals have to match the chain, not your intention. */
  quote: {
    name: 'Wrapped Ether',
    ticker: 'WETH',
    address: '0x4200000000000000000000000000000000000006',
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
