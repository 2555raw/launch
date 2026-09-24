/* Twistr — configuration.
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
 * ADDRESSES. None of these was written from memory, and every one of them is
 * checked against the live chain before the pad will move anything through it.
 * Where an address came from is written beside it, because that is the only
 * part of this file that can lose somebody real money.
 * ────────────────────────────────────────────────────────────────────────────
 */
window.TWISTR_CONFIG = {
  chain: {
    id: 8453,                                   // Base mainnet
    hex: '0x2105',
    name: 'Base',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    // Only used if the wallet does not know the chain yet, via wallet_addEthereumChain.
    rpc: ['https://mainnet.base.org'],
    explorer: 'https://basescan.org',
  },

  /* The router that opens the pool and takes the first liquidity: Uniswap's own
   * V2 router on Base, and the factory behind it.
   *
   * WHERE THESE CAME FROM. An earlier version of this file said no package
   * publishes a V2 router for Base. That was wrong, and it was wrong because I
   * looked in @uniswap/v2-sdk, which only re-exports the map, instead of in
   * @uniswap/sdk-core, which holds it. sdk-core 7.19.3 ships V2_ROUTER_ADDRESSES
   * and V2_FACTORY_ADDRESSES keyed by chain, and chain 8453 is in both.
   *
   * The factory is corroborated by a second, unrelated publisher: the `sushi`
   * package (7.3.15) has its own UNISWAP_V2_FACTORY_ADDRESS map, and its entry
   * for Base is the same forty characters. The router is from sdk-core alone.
   *
   * WHICH IS WHY THE FACTORY IS HERE AT ALL. The pad does not take the router
   * on trust. On connect it asks the router two questions and both answers have
   * to match this file: WETH() has to return `weth`, and factory() has to return
   * `factory`. A wrong router address would have to answer both correctly to get
   * through, which a random contract will not. That check is what makes it safe
   * to ship a router that only one package vouches for — and if either answer
   * disagrees, pools stay off and deploying still works.
   *
   * Aerodrome is the big one on Base and is NOT a drop-in: it is Solidly-style,
   * its addLiquidity takes a `stable` flag this pad does not send, so it would
   * fail the interface check rather than silently do the wrong thing. */
  router: {
    address: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',   // Uniswap V2 Router02
    kind: 'uniswap-v2',
    weth: '0x4200000000000000000000000000000000000006',      // the router's WETH()
    factory: '0x8909dc15e40173ff4699343b6eb8132c65e18ec6',   // the router's factory()
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

  /* The launcher contract, and the reason it exists is not gas.
   *
   * A contract creation has no `to`, no recipient and no transfer. Wallet
   * simulators exist to show a person the balance changes a transaction will
   * cause, so on a creation they have nothing to describe — and Phantom in
   * particular answers with a red "could not simulate this request" and a
   * "Confirm (unsafe)" button, every single time, on a deployment that is
   * completely fine.
   *
   * Through the factory the same launch is an ordinary call: there is a `to`,
   * and the mint inside emits Transfer(0x0 -> you, supply), which is exactly
   * what a simulator reads. The warning stops because its cause is gone.
   *
   * EMPTY MEANS THE PAD FALLS BACK TO A DIRECT CREATION, which works, makes the
   * same coin, and looks alarming in some wallets. Nothing breaks either way.
   *
   * To fill it: deploy contract/TwistrFactory.sol once — the pad can do it
   * from the wallet panel, using the bytecode in contract/twistr-factory.js so
   * it is the same build everything else was checked against — and put the
   * address the receipt gives back here. It holds nothing, has no owner, no
   * fee and no way to reach a coin once made, so there is nothing to lose by
   * it and nothing anybody can take out of it. */
  factory: {
    /* Deterministic, and that is the whole trick.
     *
     * The launcher is deployed through Safe's singleton factory — a CREATE2
     * deployer that already exists on Base — so its address is decided by the
     * bytecode and the salt rather than by who deploys it or when. It is
     * written here BEFORE anything is deployed, and the pad checks whether the
     * code is actually there on connect.
     *
     * That is what removes the last contract creation from the whole product.
     * The launcher itself used to be a bare create, which is precisely what
     * some wallets refuse to preview, so the fix for "my wallet blocks this"
     * required sending the one transaction the wallet blocks. Through the
     * CREATE2 deployer it is an ordinary call, like everything else.
     *
     * Verified in a local EVM: installing Safe's proxy at its published
     * address and calling it with salt + bytecode deploys the launcher at
     * exactly the address below, with runtime code matching this build.
     *
     *   deployer  0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7
     *             (@safe-global/safe-singleton-factory 2.0.0, artifacts/8453)
     *   salt      keccak256("twistr.launcher.v1")
     *
     * The address is never trusted on its word. The pad reads the code there
     * and compares it byte for byte with contract/twistr-factory.js before it
     * will launch through it; anything else falls back to a direct creation. */
    address: '0xa2c32f06f71B23C137A6182c7E785cbb13A26A3C',
    deployer: '0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7',
    salt: '0xac03e0ca39f425b4a8a6eea68035c8da98e672bb152c70ab13875d1a66b0589e',
  },

  /* ── Pons, on Robinhood Chain (4663) ───────────────────────────────────────
   *
   * The Base side above deploys its own ERC-20 and opens a Uniswap V2 pool.
   * Pons is a different venue on a different chain and it is where the creator
   * fee exists at all, so it gets its own block rather than overloading the
   * one above. A launch goes to one or the other; there is no launch that is
   * both.
   *
   * THE FEE. `bps` is yours: 200 basis points is 2%, written into the token at
   * construction as `creatorTaxBps`, accruing to `recipient`. The pad refuses
   * to build a launch if `recipient` is empty or zero, because the tax would
   * then accrue to nobody and there is no clean way back — the recipient is
   * fixed at construction and changing it later goes through a proposal with an
   * `effectiveAt` delay.
   *
   * There is deliberately no "pons share" field here. Pons's own cut is
   * `curveFeeBps` on whichever LaunchConfig is used, split by the protocol's
   * FeePolicy. It is not passed in and it is not ours to allocate — picking a
   * config is the whole of that choice. The pad reads it and shows it.
   *
   * `recipient` IS EMPTY AND HAS TO STAY EMPTY UNTIL IT IS YOUR ADDRESS. It is
   * the one value in this file that decides where revenue goes, it cannot be
   * derived from anything, and a plausible-looking wrong address here is
   * revenue paid to a stranger for the life of every coin launched. Fill it
   * with the wallet you want paid on chain 4663, and nothing else. */
  pons: {
    enabled: true,
    fee: {
      bps: 200,                                 // 2%, capped by maxCreatorTaxBps()
      recipient: '',                            // ← YOUR address on 4663. Nothing launches until this is set.
    },
    /* Which LaunchConfig to launch with. Read from the factory with
       launchConfigCount() / getLaunchConfig(id) and shown before launching;
       null means "ask the chain and let the launcher pick". */
    configId: null,
    /* The pair tokens are NOT listed here on purpose. approvedPairTokens() is a
       lookup and not an enumeration, so a list here would be transcribed by
       hand — and a wrong address in the call that moves liquidity is the exact
       failure this file exists to avoid. The pad discovers them from the
       factory's own TokenLaunched logs and re-checks each one with
       approvedPairTokens() before offering it. */
    pairTokens: [],
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
   * THESE SIXTEEN ARE PAIRABLE FOR REAL, but not from this file yet. They are
   * all on the list of 63 stock tokens that Pons v2 accepts as the `pairToken`
   * argument of a launch, on Robinhood Chain (4663). That is a different chain
   * from the one in `chain` above and a different AMM — Pons is Uniswap V4,
   * with pool keys and hooks, where this pad calls V2 addLiquidity. Until that
   * integration exists these are still names written into the contract and the
   * pool still opens against `quote`.
   *
   * Colour could not be matched to brand the way the previous set was: the 63
   * skew heavily blue (META, GOOGL, INTC, COIN, IBM, BA, F, PFE, DELL...) and
   * have almost nothing green. Green takes the two real greens, Nvidia and
   * Shopify, plus two marks that are black and read on any ground.
   */
  pairings: {
    'leftHand.red':     { name: 'Tesla',      ticker: 'TSLA', glyph: 'bolt',     logo: 'assets/tsla.png' },
    'leftHand.yellow':  { name: 'Amazon',     ticker: 'AMZN', glyph: 'arc',      logo: 'assets/amzn.png' },
    'leftHand.green':   { name: 'Nvidia',     ticker: 'NVDA', glyph: 'chevron',  logo: 'assets/nvda.png' },
    'leftHand.blue':    { name: 'Meta',       ticker: 'META', glyph: 'loop',     logo: 'assets/meta.png' },

    'rightHand.red':    { name: 'Lululemon',  ticker: 'LULU', glyph: 'orbit',    logo: 'assets/lulu.png' },
    'rightHand.yellow': { name: 'Snapchat',   ticker: 'SNAP', glyph: 'spark',    logo: 'assets/snap.png' },
    'rightHand.green':  { name: 'Shopify',    ticker: 'SHOP', glyph: 'tiles',    logo: 'assets/shop.png' },
    'rightHand.blue':   { name: 'Intel',      ticker: 'INTC', glyph: 'rail',     logo: 'assets/intc.png' },

    'leftFoot.red':     { name: 'GameStop',   ticker: 'GME',  glyph: 'arrowbox', logo: 'assets/gme.png' },
    'leftFoot.yellow':  { name: 'Microsoft',  ticker: 'MSFT', glyph: 'grid',     logo: 'assets/msft.png' },
    'leftFoot.green':   { name: 'Bull',       ticker: 'BULL', glyph: 'delta',    logo: 'assets/bull.png' },
    'leftFoot.blue':    { name: 'Ford',       ticker: 'F',    glyph: 'stack',    logo: 'assets/f.png' },

    'rightFoot.red':    { name: 'Netflix',    ticker: 'NET',  glyph: 'play',     logo: 'assets/net.png' },
    'rightFoot.yellow': { name: 'Gold',       ticker: 'GLD',  glyph: 'dollar',   logo: 'assets/gld.png' },
    'rightFoot.green':  { name: 'India',      ticker: 'INDA', glyph: 'waves',    logo: 'assets/inda.png' },
    'rightFoot.blue':   { name: 'Coinbase',   ticker: 'COIN', glyph: 'wave',     logo: 'assets/coin.png' },
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
