/* The chain, as the pages see it.
 *
 * Gridpad runs on Robinhood Chain and launches through Pons V2. There is no
 * second route: Pons already mints a supply into a bonding curve that
 * graduates into a Uniswap V4 pool with locked liquidity, and a contract of
 * ours doing the same thing worse is not worth asking anyone to trust. So this
 * file finds a wallet, keeps the pages pointed at one network, and hands
 * everything else to the adapter in pons.js.
 *
 * Reading never follows the wallet. A wallet parked on Base does not drag the
 * register somewhere there is nothing to read; it gets told to move instead.
 */

const CHAINS = {
  /* An Arbitrum Orbit L2 that settles to Ethereum and pays gas in ETH. */
  4663:  { name: "Robinhood Chain",   rpc: "https://rpc.mainnet.chain.robinhood.com",
           explorer: "https://robinhoodchain.blockscout.com", ticker: "ETH" },
  46630: { name: "Robinhood Testnet", rpc: "https://rpc.testnet.chain.robinhood.com/rpc",
           explorer: "https://explorer.testnet.chain.robinhood.com", ticker: "ETH", test: true },
};

/* Only so a wallet somewhere else can be named in the sentence asking it to
 * move. Nothing is ever read from these. */
const ELSEWHERE = {
  1: "Ethereum", 10: "Optimism", 56: "BNB Chain", 137: "Polygon", 8453: "Base",
  42161: "Arbitrum", 43114: "Avalanche", 59144: "Linea", 534352: "Scroll",
  84532: "Base Sepolia", 11155111: "Sepolia", 31337: "Localhost", 1337: "Localhost",
};

const DEFAULT_CHAIN = 4663;
const LAUNCH_CHAINS = new Set([4663, 46630]);

const Chain = {
  wallets: [],
  wallet: null,
  walletChain: null,
  chainId: DEFAULT_CHAIN,
  provider: null,
  signer: null,
  account: null,
  offline: false,

  /* ---------------- wallets ----------------
   * EIP-6963, so every wallet in the browser announces itself rather than
   * fighting over window.ethereum. The one that answered last time is
   * remembered, because being asked which wallet on every page is worse than
   * being asked once. */
  discoverWallets() {
    this.wallets = [];
    const seen = new Set();
    const onAnnounce = e => {
      const d = e.detail;
      if (!d || !d.info || seen.has(d.info.rdns)) return;
      seen.add(d.info.rdns);
      this.wallets.push(d);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.removeEventListener("eip6963:announceProvider", onAnnounce);
    if (!this.wallets.length && window.ethereum) {
      this.wallets.push({ info: { rdns: "injected", name: "Browser wallet" },
                          provider: window.ethereum });
    }
    return this.wallets;
  },

  hasWallet() { return this.wallets.length > 0; },
  walletList() { return this.wallets.map(w => w.info); },

  pickWallet() {
    let saved = null;
    try { saved = localStorage.getItem("gridpad.wallet"); } catch (_) {}
    return this.wallets.find(w => w.info.rdns === saved) || this.wallets[0];
  },

  useWallet(entry) {
    if (!entry) return null;
    this.wallet = entry.provider;
    this.walletInfo = entry.info;
    try { localStorage.setItem("gridpad.wallet", entry.info.rdns); } catch (_) {}
    return entry;
  },

  /* ---------------- start ---------------- */
  async init() {
    this.discoverWallets();
    if (this.hasWallet()) {
      try {
        this.useWallet(this.pickWallet());
        const accounts = await this.wallet.request({ method: "eth_accounts" });
        this.walletChain = Number(BigInt(await this.wallet.request({ method: "eth_chainId" })));
        const bp = new ethers.BrowserProvider(this.wallet);
        if (LAUNCH_CHAINS.has(this.walletChain)) {
          this.chainId = this.walletChain;
          this.provider = bp;
        }
        if (accounts && accounts.length) {
          this.account = ethers.getAddress(accounts[0]);
          this.signer = await bp.getSigner();
        }
        this.wallet.on?.("chainChanged", () => location.reload());
        this.wallet.on?.("accountsChanged", () => location.reload());
      } catch (e) { console.warn("wallet init failed", e); }
    }
    if (!this.provider) {
      const saved = Number(localStorage.getItem("gridpad.chain") || DEFAULT_CHAIN);
      this.chainId = CHAINS[saved] ? saved : DEFAULT_CHAIN;
      this.provider = new ethers.JsonRpcProvider(CHAINS[this.chainId].rpc, undefined,
                                                { staticNetwork: true });
    }
    this.offline = !(await this.reachable());
    return this;
  },

  async reachable() {
    try {
      await Promise.race([
        this.provider.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]);
      return true;
    } catch (_) { return false; }
  },

  async connect() {
    if (!this.hasWallet()) throw new Error("No wallet in this browser.");
    if (!this.wallet) this.useWallet(this.pickWallet());
    const accounts = await this.wallet.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts.length) throw new Error("No account was shared.");
    const bp = new ethers.BrowserProvider(this.wallet);
    this.provider = bp;
    this.signer = await bp.getSigner();
    this.account = ethers.getAddress(accounts[0]);
    this.walletChain = Number((await bp.getNetwork()).chainId);
    if (LAUNCH_CHAINS.has(this.walletChain)) this.chainId = this.walletChain;
    return this.account;
  },

  requireSigner() {
    if (!this.signer) throw new Error("Connect a wallet first.");
    return this.signer;
  },

  /* ---------------- where we are ---------------- */
  viaPons() { return typeof PONS !== "undefined" && PONS.has(this.chainId); },
  pons() { return PonsAdapter.bind(this); },
  ready() { return this.viaPons(); },

  /* Asks about the WALLET, not about what the pages read: reading is pinned to
   * Robinhood Chain, signing happens wherever the wallet actually is. */
  canLaunch() { return LAUNCH_CHAINS.has(Number(this.walletChain)); },

  chainInfo() { return CHAINS[this.chainId] || CHAINS[DEFAULT_CHAIN]; },
  walletChainInfo() {
    const id = Number(this.walletChain);
    return CHAINS[id] || { name: ELSEWHERE[id] || `chain ${id}`, explorer: "", ticker: "ETH", away: true };
  },

  explorerLink(kind, value) {
    const base = this.chainInfo().explorer;
    return base ? `${base}/${kind}/${value}` : null;
  },

  /* A wallet that has never seen the chain answers 4902, and then it has to be
   * added before it can be switched to. Robinhood Chain is new enough that most
   * wallets take that path. */
  async switchTo(id) {
    if (!this.hasWallet()) throw new Error("No wallet in this browser.");
    if (!this.wallet) this.useWallet(this.pickWallet());
    const info = CHAINS[id];
    if (!info) throw new Error(`Gridpad does not run on chain ${id}.`);
    const hex = "0x" + Number(id).toString(16);
    try {
      await this.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if (e && (e.code === 4902 || e.code === -32603)) {
        await this.wallet.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hex, chainName: info.name, rpcUrls: [info.rpc],
            nativeCurrency: { name: "Ether", symbol: info.ticker, decimals: 18 },
            blockExplorerUrls: info.explorer ? [info.explorer] : [],
          }],
        });
        await this.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
      } else throw e;
    }
    try { localStorage.setItem("gridpad.chain", String(id)); } catch (_) {}
    return id;
  },

  /* ---------------- reads ----------------
   *
   * A read that never answers is the failure an RPC actually has: not an error,
   * which every caller handles, but silence. One of those behind a table leaves
   * it on "Reading the chain…" for as long as the tab stays open. */
  READ_MS: 9000,

  within(promise, fallback) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).catch(e => {
        console.warn("chain: read failed", e.shortMessage || e.message);
        return fallback;
      }),
      new Promise(res => { timer = setTimeout(() => {
        console.warn("chain: read timed out after", this.READ_MS, "ms");
        res(fallback);
      }, this.READ_MS); }),
    ]).finally(() => clearTimeout(timer));
  },

  /* onPartial, when given, is handed whatever has been found so far as often
   * as the scan finds more, so a page draws rows while it is still looking. */
  async pairings(limit = 50, onPartial = null) {
    if (!this.viaPons()) return [];
    return this.within(this.pons().pairings(limit, onPartial), []);
  },
  async pairing(token) { return this.pons().pairing(token); },
  async tokenMeta(address) {
    return this.within(this.pons().tokenMeta(address),
                       { address, name: "Unreadable", symbol: "?", source: "", totalSupply: 0n });
  },
  async balanceOf(token, who) { return this.pons().balanceOf(token, who); },
  async price(token) { return this.pons().price(token); },
  async quoteBuy(token, ethIn) { return this.pons().quoteBuy(token, ethIn); },
  async quoteSell(token, amount) { return this.pons().quoteSell(token, amount); },
  async trades(token, blocks) { return this.pons().trades(token, blocks); },

  /* ---------------- writes ---------------- */
  async launch(params) { return this.pons().launch(params); },
  async buy(token, ethWei, minOut = 0n) { return this.pons().buy(token, ethWei, minOut); },
  async sell(token, amount, minOut = 0n) { return this.pons().sell(token, amount, minOut); },
  async fees(token) { return this.pons().fees(token); },
  async sweep(token, minOut) { return this.pons().sweep(token, minOut); },
  async claimFees() { return this.pons().claimFees(); },

  /* ---------------- launches as they happen ----------------
   *
   * One call per tick asking whether anything has been launched since the block
   * last looked at, and only when something has does it tell the page to read
   * again. It stops while the tab is hidden, because a background tab polling a
   * public RPC every twenty seconds is a good way to get rate limited, and it
   * asks straight away when the tab comes back, since a tab returning has
   * usually missed something. */
  watchLaunches(onNew, everyMs = 20000) {
    let seen = null, stopped = false, timer = null;

    const tick = async () => {
      if (stopped || document.hidden || this.offline || !this.viaPons()) return;
      let head;
      try { head = await this.provider.getBlockNumber(); } catch (_) { return; }
      if (seen === null) { seen = head; return; }
      if (head <= seen) return;
      const from = seen + 1;
      seen = head;
      try {
        const f = PONS.factory(this.provider, this.chainId);
        const logs = await f.queryFilter(f.filters.TokenLaunched(), from, head);
        if (logs.length) onNew(logs.length);
      } catch (_) {}
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { await tick(); if (!stopped) schedule(); }, everyMs);
    };
    const onShow = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onShow);
    tick(); schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  },
};
