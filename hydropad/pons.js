/* Pons V2: the launchpad already deployed on Robinhood Chain.
 *
 * Hydropad does not need its own launcher on a chain Pons is on. Pons mints the
 * supply into a constant-product curve, trades it, and graduates it into a
 * Uniswap V4 pool whose liquidity is locked for good — which is the one thing
 * Hydropad's own contract could never honestly promise.
 *
 * What it costs us: the token is a PonsV2LauncherToken, so there is no source()
 * of our own to write the water into. Its `description` is a public string on
 * chain, set at launch and readable by anyone, so that is where the pairing
 * goes — human-readable, with a machine tag on the end so this build and any
 * indexer can read it back exactly.
 *
 * Addresses and signatures are from the published contracts:
 *   github.com/ponsdotdev/ponsfamily  ·  contractsV2/src/v2
 *
 * Everything that can change under us — the launch fee, which launch configs
 * exist, the supply and graduation threshold they imply — is read from the
 * factory at the moment of use rather than baked in here.
 */

const PONS = {
  /* Pons is on Robinhood Chain. It is not on the testnet or on the EVM that
   * runs inside the page, and on those Hydropad falls back to its own
   * launcher, which is why that contract is still in the build. */
  FACTORY: {
    /* PonsV2LaunchFactory, from the repository's own deployment table.
     * 0xA5aAb3F0…51feB is the V1 factory and answers some of the same calls,
     * which is exactly why pointing at it looked like a closed gate rather
     * than a wrong address. */
    4663: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  },

  /* The V1 factory, kept here so a build that ever reads it back knows what it
   * is looking at rather than guessing. Nothing calls it. */
  V1_FACTORY: "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB",

  /* The bonding curve's quote asset. Pons also takes USDG and tokenized
   * equities; a coin paired to a body of water trades in ETH. */
  NATIVE: "0x0000000000000000000000000000000000000000",

  FACTORY_ABI: [
    "function launchFee() view returns (uint256)",
    "function launchEnabled() view returns (bool)",
    "function launchConfigCount() view returns (uint256)",
    "function getLaunchConfig(uint256 id) view returns (tuple(uint256 supply, uint256 curveFeeBps, uint256 phantomQuote, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, bool enabled))",
    "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
    "function maxCreatorTaxBps() view returns (uint256)",
    "function canLaunch(address launcher) view returns (bool)",
    "function getLaunchedToken(address token) view returns (tuple(address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
    "function launchToken(tuple(string name, string symbol, string logo, string description, tuple(string twitter, string telegram, string discord, string website, string farcaster) socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 expectedEconomics, bytes32 salt) params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)",
    "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  ],

  CURVE_ABI: [
    "function token() view returns (address)",
    "function pairToken() view returns (address)",
    "function graduationThreshold() view returns (uint256)",
    "function graduated() view returns (bool)",
    "function readyToGraduate() view returns (bool)",
    "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
    "function realQuoteReserve() view returns (uint256)",
    "function sellableTokens() view returns (uint256)",
    "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
    "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
    "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
    "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
  ],

  TOKEN_ABI: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
    "function logo() view returns (string)",
    "function description() view returns (string)",
    "function deployer() view returns (address)",
  ],

  /* The fee escrow pays creators. A Hydropad vault was ours to define; this
   * one is Pons', and the creator's share is claimed from it. */
  ESCROW_ABI: [
    "function balanceOf(address recipient) view returns (uint256)",
    "function claim() returns (uint256 amount)",
  ],

  has(chainId) { return !!this.FACTORY[Number(chainId)]; },
  address(chainId) { return this.FACTORY[Number(chainId)] || null; },

  /* ---------------- the pairing, written into `description` ----------------
   *
   * Pons' token has no field of ours, so the pairing has to survive as text.
   * It is written to be read by a person first — this is what shows up in
   * every explorer and wallet — with a tag on the end that parses exactly.
   */
  TAG: /\[hydropad:1:([A-Z0-9]{1,12})\]/,

  describe(source, place, note) {
    const head = place ? `Paired to ${place} (${source}).` : `Paired to ${source}.`;
    const body = note ? ` ${note}` : "";
    return `${head}${body} The pairing names that body of water and nothing more:` +
      ` it conveys no ownership of the water, no legal claim on it and no physical backing.` +
      ` [hydropad:1:${source}]`;
  },

  /* The ticker back out of a description, or null if this token was not
   * launched through Hydropad. Anyone can write our tag into their own
   * description, so this says "claims to be paired to", not "is". */
  sourceOf(description) {
    const m = this.TAG.exec(String(description || ""));
    return m ? m[1] : null;
  },

  /* ---------------- reads that have to come off the chain ---------------- */

  factory(runner, chainId) {
    const at = this.address(chainId);
    if (!at) throw new Error("Pons is not on this network.");
    return new ethers.Contract(at, this.FACTORY_ABI, runner);
  },

  curve(address, runner) { return new ethers.Contract(address, this.CURVE_ABI, runner); },
  token(address, runner) { return new ethers.Contract(address, this.TOKEN_ABI, runner); },

  /* Which launch config to open against. The protocol owner adds and disables
   * these, so the only safe answer is whatever the factory says right now:
   * the newest enabled one, with its own supply and graduation threshold. */
  async pickConfig(factory) {
    const count = Number(await factory.launchConfigCount());
    if (!count) throw new Error("Pons has no launch configs on this network.");
    for (let id = count - 1; id >= 0; id--) {
      const c = await factory.getLaunchConfig(id);
      if (c.enabled) {
        return {
          id,
          supply: c.supply,
          curveFeeBps: Number(c.curveFeeBps),
          phantomQuote: c.phantomQuote,
          graduationThreshold: c.graduationThreshold,
          poolFee: Number(c.poolFee),
        };
      }
    }
    throw new Error("Every Pons launch config is disabled.");
  },

  /* Everything the launch form needs to quote a launch honestly, read live.
   *
   * `launchEnabled` is only the public gate. The predicate launchToken really
   * enforces is canLaunch(caller) — the gate OR a place on the whitelist — so
   * that is what decides whether this account can launch, and asking the other
   * one told whitelisted launchers they were locked out when they were not. */
  async terms(runner, chainId, who) {
    const f = this.factory(runner, chainId);
    const [fee, open, allowed, config] = await Promise.all([
      f.launchFee(),
      f.launchEnabled(),
      who ? f.canLaunch(who) : Promise.resolve(false),
      this.pickConfig(f),
    ]);
    return { factory: f, launchFee: fee, publicGate: open, allowed, config };
  },

  /* Will Pons take a launch from this address right now? */
  async willLaunch(runner, chainId, who) {
    if (!who) return false;
    try {
      return await this.factory(runner, chainId).canLaunch(who);
    } catch (e) {
      console.warn("pons: canLaunch failed", e.shortMessage || e.message);
      return false;
    }
  },

  /* The curve's own arithmetic, mirrored for display only. The quote reserve
   * the curve prices against includes a phantom amount nobody deposited, the
   * same shape as Hydropad's own virtual reserve. */
  quoteBuy(quoteReserve, tokenReserve, quoteIn, feeBps) {
    const net = quoteIn - (quoteIn * BigInt(feeBps)) / 10000n;
    if (net <= 0n) return 0n;
    const k = quoteReserve * tokenReserve;
    return tokenReserve - k / (quoteReserve + net);
  },

  quoteSell(quoteReserve, tokenReserve, tokensIn, feeBps) {
    if (tokensIn <= 0n) return 0n;
    const k = quoteReserve * tokenReserve;
    const gross = quoteReserve - k / (tokenReserve + tokensIn);
    return gross - (gross * BigInt(feeBps)) / 10000n;
  },
};

/* ---------------------------------------------------------------------------
 * The adapter the pages talk to.
 *
 * Hydropad's own launcher answers one contract for every pairing; Pons keeps a
 * factory, a curve per token, and the token itself. This puts the second shape
 * behind the first, so app.js keeps calling pairings(), price(), buy() and the
 * rest without knowing which launchpad is underneath.
 * ------------------------------------------------------------------------- */

const PonsAdapter = {
  /* Pons went live on Robinhood Chain at this block. Nothing before it can
   * hold a launch, so a backward scan has somewhere to stop. */
  /* 8991118 is where the V1 factory started, not this one, and guessing a
   * floor that is too high silently hides launches. The scan is bounded by
   * MAX_SCAN instead, which is a window, not a claim about history. */
  START_BLOCK: {},

  /* Public RPCs cap how many blocks one eth_getLogs may cover. */
  CHUNK: 45000,
  MAX_SCAN: 900000,

  chain: null,          // the Chain object, for provider/signer/chainId
  cache: new Map(),     // token address -> { curve, source, launchedAt }

  bind(chain) { this.chain = chain; return this; },

  /* Whether Pons would accept a launch from the connected account. Cached per
   * account, because the launch form asks on every repaint. */
  async canLaunch() {
    const who = this.chain.account;
    if (!who) return false;
    if (this._canFor === who) return this._can;
    this._can = await PONS.willLaunch(this.chain.provider, this.chain.chainId, who);
    this._canFor = who;
    return this._can;
  },

  /* Does Pons know this token? Tokens opened on Hydropad's own launcher on the
   * same chain do not appear here, and are read the old way. */
  async knows(token) {
    const key = String(token).toLowerCase();
    if (this.cache.has(key)) return true;
    try {
      const rec = await this.factory().getLaunchedToken(token);
      if (rec.exists) { this.cache.set(key, { curve: rec.curve }); return true; }
    } catch (_) { /* not a Pons launch */ }
    return false;
  },

  provider() { return this.chain.provider; },
  signerOr(runner) { return runner || this.chain.provider; },

  factory(withSigner = false) {
    return PONS.factory(withSigner ? this.chain.requireSigner() : this.chain.provider, this.chain.chainId);
  },

  /* ---------------- reads ---------------- */

  /* Walk TokenLaunched backwards from the head until enough Hydropad pairings
   * have turned up or the scan runs out of room. Pons carries every launch on
   * the chain, most of which have nothing to do with water, so the tag in the
   * description is what decides. */
  /* How long a scan may take before it gives back whatever it has. A page that
   * says "reading the chain" forever is worse than one that says "nothing
   * here yet" in a few seconds. */
  BUDGET_MS: 9000,
  MAX_LOGS: 600,
  BATCH: 12,

  /* Tokens on this chain already known to be ours, so a second visit does not
   * pay for the scan again. */
  knownKey() { return `hydropad.pons.known.${this.chain.chainId}`; },
  known() {
    try { return JSON.parse(localStorage.getItem(this.knownKey()) || "[]"); }
    catch (_) { return []; }
  },
  remember(token, curve, source) {
    try {
      const all = this.known().filter(k => k.token.toLowerCase() !== token.toLowerCase());
      all.unshift({ token, curve, source });
      localStorage.setItem(this.knownKey(), JSON.stringify(all.slice(0, 60)));
    } catch (_) {}
  },

  /* Pons carries every launch on the chain and most have nothing to do with
   * water, so the tag in the description is what decides. Reading that is one
   * call per token, which is why this is bounded on every axis: a deadline, a
   * ceiling on how many logs are inspected, and the reads themselves run in
   * batches rather than one after another. Whatever is known already is shown
   * first and costs nothing.
   */
  async pairings(limit = 50) {
    const out = [];
    const seen = new Set();

    /* Anything this browser has already established is ours. */
    for (const k of this.known()) {
      if (seen.has(k.token.toLowerCase())) continue;
      seen.add(k.token.toLowerCase());
      this.cache.set(k.token.toLowerCase(), { curve: k.curve, source: k.source });
      try { out.push(await this.pairing(k.token, { curve: k.curve, source: k.source })); }
      catch (e) { console.warn("pons: known token unreadable", k.token, e.shortMessage || e.message); }
      if (out.length >= limit) return out;
    }

    const deadline = Date.now() + this.BUDGET_MS;
    const f = this.factory();
    let head;
    try { head = await this.provider().getBlockNumber(); }
    catch (e) { console.warn("pons: no head", e.shortMessage || e.message); return out; }

    const floor = Math.max(this.START_BLOCK[Number(this.chain.chainId)] || 0, head - this.MAX_SCAN);
    let to = head;
    let inspected = 0;

    while (to > floor && out.length < limit && inspected < this.MAX_LOGS && Date.now() < deadline) {
      const from = Math.max(floor, to - this.CHUNK);
      let logs = [];
      try {
        logs = await f.queryFilter(f.filters.TokenLaunched(), from, to);
      } catch (e) {
        console.warn("pons: log range refused", from, to, e.shortMessage || e.message);
      }
      logs.reverse();

      for (let i = 0; i < logs.length && out.length < limit; i += this.BATCH) {
        if (Date.now() > deadline || inspected >= this.MAX_LOGS) break;
        const slice = logs.slice(i, i + this.BATCH);
        inspected += slice.length;
        const found = await Promise.all(slice.map(l => this.fromLaunchLog(l).catch(() => null)));
        for (const p of found) {
          if (p && !seen.has(p.token.toLowerCase())) { seen.add(p.token.toLowerCase()); out.push(p); }
        }
      }
      to = from - 1;
    }
    return out;
  },

  /* One launch event into a pairing, or null when it is not one of ours. */
  async fromLaunchLog(log) {
    const token = log.args.token;
    try {
      const t = PONS.token(token, this.provider());
      const description = await t.description();
      const source = PONS.sourceOf(description);
      if (!source) return null;
      this.cache.set(token.toLowerCase(), { curve: log.args.curve, source });
      this.remember(token, log.args.curve, source);
      return this.pairing(token, { curve: log.args.curve, source, block: log.blockNumber });
    } catch (e) {
      console.warn("pons: could not read", token, e.shortMessage || e.message);
      return null;
    }
  },

  /* The launch record and the curve's state, in the shape app.js expects. */
  async pairing(token, hint = {}) {
    const f = this.factory();
    const rec = hint.curve ? null : await f.getLaunchedToken(token);
    if (rec && !rec.exists) throw new Error("Not a Pons launch.");
    const curveAt = hint.curve || rec.curve;
    const c = PONS.curve(curveAt, this.provider());

    const [reserves, raised, graduated, source, launchedAt] = await Promise.all([
      c.getReserves(),
      c.realQuoteReserve(),
      c.graduated(),
      hint.source !== undefined ? hint.source : this.sourceOf(token),
      hint.block !== undefined ? this.timeOf(hint.block) : 0,
    ]);

    return {
      token,
      curve: curveAt,
      creator: rec ? rec.deployer : await PONS.token(token, this.provider()).deployer(),
      source: source || "",
      ethReserve: reserves.quoteReserve,
      tokenReserve: reserves.tokenReserve,
      raised,
      /* Creator fees live in Pons' own escrow, not in a vault this contract
       * would let us read per token. The token page says so rather than
       * printing a figure it cannot stand behind. */
      vault: 0n,
      launchedAt,
      graduated,
      viaPons: true,
    };
  },

  async sourceOf(token) {
    const hit = this.cache.get(String(token).toLowerCase());
    if (hit && hit.source) return hit.source;
    const description = await PONS.token(token, this.provider()).description();
    return PONS.sourceOf(description) || "";
  },

  async timeOf(block) {
    try {
      const b = await this.provider().getBlock(block);
      return b ? Number(b.timestamp) : 0;
    } catch (_) { return 0; }
  },

  async curveOf(token) {
    const hit = this.cache.get(String(token).toLowerCase());
    if (hit && hit.curve) return hit.curve;
    const rec = await this.factory().getLaunchedToken(token);
    if (!rec.exists) throw new Error("Pons does not know this token.");
    this.cache.set(String(token).toLowerCase(), { curve: rec.curve });
    return rec.curve;
  },

  async tokenMeta(address) {
    const t = PONS.token(address, this.provider());
    const [name, symbol, description, totalSupply] = await Promise.all([
      t.name(), t.symbol(), t.description(), t.totalSupply(),
    ]);
    return { address, name, symbol, source: PONS.sourceOf(description) || "", totalSupply, description };
  },

  async balanceOf(token, who) {
    return PONS.token(token, this.provider()).balanceOf(who || this.chain.account);
  },

  async feeBps() {
    if (this._fee !== undefined) return this._fee;
    const { config } = await PONS.terms(this.provider(), this.chain.chainId);
    this._fee = config.curveFeeBps;
    return this._fee;
  },

  async price(token) {
    const c = PONS.curve(await this.curveOf(token), this.provider());
    const { quoteReserve, tokenReserve } = await c.getReserves();
    return tokenReserve === 0n ? 0n : (quoteReserve * 10n ** 18n) / tokenReserve;
  },

  async quoteBuy(token, ethIn) {
    const c = PONS.curve(await this.curveOf(token), this.provider());
    const [{ quoteReserve, tokenReserve }, fee] = await Promise.all([c.getReserves(), this.feeBps()]);
    return PONS.quoteBuy(quoteReserve, tokenReserve, ethIn, fee);
  },

  async quoteSell(token, amount) {
    const c = PONS.curve(await this.curveOf(token), this.provider());
    const [{ quoteReserve, tokenReserve }, fee] = await Promise.all([c.getReserves(), this.feeBps()]);
    return PONS.quoteSell(quoteReserve, tokenReserve, amount, fee);
  },

  async trades(token, blocks = 50000) {
    const c = PONS.curve(await this.curveOf(token), this.provider());
    const head = await this.provider().getBlockNumber();
    const from = Math.max(0, head - Math.min(blocks, this.CHUNK));
    const [buys, sells] = await Promise.all([
      c.queryFilter(c.filters.CurveBuy(), from, head).catch(() => []),
      c.queryFilter(c.filters.CurveSell(), from, head).catch(() => []),
    ]);
    const rows = [
      ...buys.map(l => ({
        block: l.blockNumber, hash: l.transactionHash, trader: l.args.buyer, isBuy: true,
        eth: l.args.quoteIn, tokens: l.args.tokensOut, fee: l.args.fee + l.args.tax,
      })),
      ...sells.map(l => ({
        block: l.blockNumber, hash: l.transactionHash, trader: l.args.seller, isBuy: false,
        eth: l.args.quoteOut, tokens: l.args.tokensIn, fee: l.args.fee + l.args.tax,
      })),
    ];
    return rows.sort((a, b) => a.block - b.block);
  },

  /* ---------------- writes ---------------- */

  /* Pons takes the launch fee as an exact msg.value, so the opening buy cannot
   * ride along in the same call the way Hydropad's own launch() allowed. It is
   * a second transaction against the new curve, sent straight after.
   *
   * Supply is not ours to choose either: the launch config fixes it, along with
   * the graduation threshold. The form reads those back rather than pretending
   * the numbers typed into it are the ones that will apply.
   */
  async launch({ name, symbol, source, place, note, firstBuyWei, logo = "" }) {
    const signer = this.chain.requireSigner();
    const { factory, launchFee, publicGate, allowed, config } =
      await PONS.terms(signer, this.chain.chainId, this.chain.account);
    if (!allowed) {
      throw new Error(publicGate
        ? "Pons refused this address."
        : "Pons has its public launch gate closed: only whitelisted addresses can launch through it right now.");
    }

    /* Ties the launch to the terms quoted a moment ago, so an owner re-peg
     * landing underneath this transaction makes it revert instead of silently
     * repricing it. */
    const expectedEconomics = await factory.previewLaunchEconomics(config.id, PONS.NATIVE);

    const params = {
      name,
      symbol,
      logo,
      description: PONS.describe(source, place, note),
      socials: { twitter: "", telegram: "", discord: "", website: "", farcaster: "" },
      creatorFeeRecipient: this.chain.account,
      creatorTaxBps: 0,
      buybackEnabled: true,
      expectedEconomics,
      /* The token's address is derived from this, so two launches must never
       * share one. Random, rather than zero, which every caller would reuse. */
      salt: ethers.hexlify(ethers.randomBytes(32)),
    };

    const tx = await factory.launchToken(params, config.id, PONS.NATIVE, { value: launchFee });
    const rc = await tx.wait();

    let token = null, curve = null;
    for (const log of rc.logs) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed && parsed.name === "TokenLaunched") {
          token = parsed.args.token; curve = parsed.args.curve; break;
        }
      } catch (_) { /* a log from another contract in the same transaction */ }
    }
    if (!token) throw new Error("Pons did not emit TokenLaunched in this receipt.");
    this.cache.set(token.toLowerCase(), { curve, source });
    this.remember(token, curve, source);

    /* Take the first position, if one was asked for. A failure here leaves the
     * launch standing: the coin exists, it just has no opening buy. */
    let firstBuy = null;
    if (firstBuyWei && firstBuyWei > 0n) {
      try {
        const b = await PONS.curve(curve, signer).buy(firstBuyWei, 0n, this.chain.account, { value: firstBuyWei });
        firstBuy = (await b.wait()).hash;
      } catch (e) {
        console.warn("pons: opening buy failed", e.shortMessage || e.message);
      }
    }
    return { token, curve, hash: rc.hash, firstBuy };
  },

  async buy(token, ethWei, minTokensOut = 0n) {
    const c = PONS.curve(await this.curveOf(token), this.chain.requireSigner());
    const tx = await c.buy(ethWei, minTokensOut, this.chain.account, { value: ethWei });
    return tx.wait();
  },

  async sell(token, amount, minEthOut = 0n) {
    const curveAt = await this.curveOf(token);
    const erc = PONS.token(token, this.chain.requireSigner());
    const allowance = await erc.allowance(this.chain.account, curveAt);
    if (allowance < amount) {
      await (await erc.approve(curveAt, ethers.MaxUint256)).wait();
    }
    const tx = await PONS.curve(curveAt, this.chain.requireSigner()).sell(amount, minEthOut, this.chain.account);
    return tx.wait();
  },
};
