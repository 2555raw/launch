/* Hydropad's chain layer: wallet, launcher discovery and every contract call
 * the pages make. ethers v6 is loaded as a UMD global before this file.
 *
 * There is no backend. Reads go through the wallet's provider, or through a
 * public RPC when no wallet is present, so the pages work logged out.
 */

/* The networks Hydropad runs on, and nothing else. Coins launch on Robinhood
 * Chain, so that is what the pages read: a wallet parked on Base or Polygon
 * does not drag the register somewhere there is nothing to read. */
const CHAINS = {
  /* Robinhood Chain is an Arbitrum Orbit L2 that settles to Ethereum and pays
   * gas in ETH, so the launcher deploys and runs on it unchanged. Contract
   * deployment there is permissionless: no allowlist to get onto. */
  4663:     { name: "Robinhood Chain", rpc: "https://rpc.mainnet.chain.robinhood.com",   explorer: "https://robinhoodchain.blockscout.com", ticker: "ETH" },
  46630:    { name: "Robinhood Testnet", rpc: "https://rpc.testnet.chain.robinhood.com/rpc", explorer: "https://explorer.testnet.chain.robinhood.com", ticker: "ETH", test: true },
};

/* Only so a wallet somewhere else can be named in the sentence that asks it to
 * move. Nothing is ever read from these. */
const ELSEWHERE = {
  1: "Ethereum", 10: "Optimism", 56: "BNB Chain", 137: "Polygon", 8453: "Base",
  42161: "Arbitrum", 43114: "Avalanche", 59144: "Linea", 534352: "Scroll",
  84532: "Base Sepolia", 11155111: "Sepolia", 31337: "Localhost", 1337: "Localhost",
};

/* Launchers known to this build. Anyone can deploy their own from the UI; the
 * address they get is remembered per chain in localStorage. */
const DEPLOYMENTS = {
  // 4663:  "0x…",
  // 46630: "0x…",
};

/* Where the pages read from when nobody has a wallet connected: the network
 * coins are actually launched on. */
const DEFAULT_CHAIN = 4663;

/* Launching is Robinhood Chain only. Reading works on any network your wallet
 * is on — if somebody put a launcher there, the tables will show it — but this
 * build only opens new pairings on the chain it is for. 1337 is the EVM that
 * runs inside the page, which is a sandbox rather than a network, and is kept
 * open so the site can be used with no wallet and no money. */
const LAUNCH_CHAINS = new Set([4663, 46630]);

const LAUNCHER_KEY = c => `hydropad.launcher.${c}`;

const Chain = {
  walletChain: null,
  provider: null,     // read provider (wallet or public RPC)
  signer: null,
  account: null,
  chainId: null,
  launcher: null,     // address
  readOnly: true,
  offline: false,     // no node reachable from here

  /* ---------------- wallets ----------------
   *
   * More than one wallet can be installed in the same browser, and when they
   * are, whichever loaded last owns window.ethereum: picking MetaMask in the
   * UI while Phantom had taken the global is how people end up signing from
   * the wrong account. EIP-6963 exists for exactly this — every wallet
   * announces itself with a name, an icon and a stable id, and the page picks.
   * window.ethereum stays as the fallback for anything that has not caught up.
   */
  wallets: [],          // [{ info: { uuid, name, icon, rdns }, provider }]
  wallet: null,         // the EIP-1193 provider actually in use

  /* Wallets answer this synchronously during page load, so the list is asked
   * for once, early, and read from there. */
  discoverWallets() {
    if (typeof window === "undefined") return;
    const seen = new Set(this.wallets.map(w => w.info.rdns));
    window.addEventListener("eip6963:announceProvider", e => {
      const d = e.detail;
      if (!d || !d.info || seen.has(d.info.rdns)) return;
      seen.add(d.info.rdns);
      this.wallets.push(d);
      window.dispatchEvent(new CustomEvent("hydropad:wallets"));
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  },

  /* Everything a picker needs: the announced wallets, plus whatever has taken
   * window.ethereum if it never announced itself. */
  walletList() {
    const out = this.wallets.slice();
    if (window.ethereum && !out.some(w => w.provider === window.ethereum)) {
      const eth = window.ethereum;
      const name = eth.isMetaMask ? "MetaMask"
        : eth.isPhantom ? "Phantom"
        : eth.isRabby ? "Rabby"
        : eth.isCoinbaseWallet ? "Coinbase Wallet"
        : "Browser wallet";
      out.push({ info: { uuid: "injected", name, icon: "", rdns: "injected" }, provider: eth });
    }
    return out;
  },

  /* The one in use: what was chosen, else what was chosen last time, else
   * whatever there is. */
  pickWallet(rdns) {
    const list = this.walletList();
    if (!list.length) return null;
    if (rdns) {
      const hit = list.find(w => w.info.rdns === rdns);
      if (hit) return hit;
    }
    let saved = null;
    try { saved = localStorage.getItem("hydropad.wallet"); } catch (_) {}
    return list.find(w => w.info.rdns === saved) || list[0];
  },

  useWallet(entry) {
    if (!entry) return null;
    this.wallet = entry.provider;
    try { localStorage.setItem("hydropad.wallet", entry.info.rdns); } catch (_) {}
    return entry;
  },

  hasWallet() { return typeof window !== "undefined" && this.walletList().length > 0; },

  /* Read-only boot: pick a chain and provider without prompting the wallet.
   *
   * There used to be an EVM booted inside the page when there was no wallet.
   * It made the site look alive with no network and no money, and it is gone:
   * coins launch through Pons on Robinhood Chain, and a table of coins that
   * exist only in one browser tab is indistinguishable from a table of coins
   * that exist, which is worse than an empty table. */
  async init(onProgress) {
    this.discoverWallets();
    if (this.hasWallet()) {
      try {
        this.useWallet(this.pickWallet());
        const accounts = await this.wallet.request({ method: "eth_accounts" });
        const hexId = await this.wallet.request({ method: "eth_chainId" });
        this.walletChain = Number(BigInt(hexId));
        /* The site is pinned to Robinhood Chain. A wallet parked somewhere else
         * is a thing to tell the visitor about, not a place to go and read: the
         * register, the prices and the launches all live on one network, and
         * following the wallet to Polygon only ever finds an empty page there. */
        const bp = new ethers.BrowserProvider(this.wallet);
        if (LAUNCH_CHAINS.has(this.walletChain)) {
          this.chainId = this.walletChain;
          this.provider = bp;
        }
        if (accounts && accounts.length) {
          this.account = ethers.getAddress(accounts[0]);
          this.signer = await bp.getSigner();
          this.readOnly = false;
        }
        this.wallet.on?.("chainChanged", () => location.reload());
        this.wallet.on?.("accountsChanged", () => location.reload());
      } catch (e) { console.warn("wallet init failed", e); }
    }
    if (!this.provider) {
      /* No wallet, or a wallet on a network Hydropad does not run on: read from
       * Robinhood Chain's own node either way. */
      const saved = Number(localStorage.getItem("hydropad.chain") || DEFAULT_CHAIN);
      this.chainId = CHAINS[saved] ? saved : DEFAULT_CHAIN;
      const cfg = CHAINS[this.chainId];
      this.provider = new ethers.JsonRpcProvider(cfg.rpc, undefined, { staticNetwork: true });
    }
    this.launcher = this.launcherAddress();
    this.offline = !(await this.reachable());
    return this;
  },

  /* A node is only useful if we can actually reach it: a blocked network, an
   * offline browser or a sandboxed frame all land here. */
  async reachable() {
    try {
      await Promise.race([
        this.provider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      return true;
    } catch (_) { return false; }
  },

  /* Prompt the wallet. Returns the connected address. */
  async connect(rdns) {
    if (!this.hasWallet()) throw new Error("No wallet found. Install MetaMask, Phantom, Rabby or another EIP-1193 wallet.");
    this.useWallet(this.pickWallet(rdns));
    const accounts = await this.wallet.request({ method: "eth_requestAccounts" });
    const bp = new ethers.BrowserProvider(this.wallet);
    this.provider = bp;
    this.signer = await bp.getSigner();
    this.account = ethers.getAddress(accounts[0]);
    this.walletChain = Number((await bp.getNetwork()).chainId);
    if (LAUNCH_CHAINS.has(this.walletChain)) this.chainId = this.walletChain;
    this.readOnly = false;
    this.launcher = this.launcherAddress();
    return this.account;
  },

  /* Can a pairing be opened from where we are standing? This one asks about
   * the WALLET, not about what the pages are reading: reading is pinned to
   * Robinhood Chain, and signing happens wherever the wallet actually is. */
  canLaunch() { return LAUNCH_CHAINS.has(Number(this.walletChain)); },

  /* Where the wallet is, for the sentence that asks it to move. Named, when it
   * is somewhere well known, so that sentence reads like a sentence. */
  walletChainInfo() {
    const id = Number(this.walletChain);
    if (CHAINS[id]) return CHAINS[id];
    return { name: ELSEWHERE[id] || `chain ${id}`, explorer: "", ticker: "ETH", away: true };
  },

  /* Pons is already deployed on Robinhood Chain, so on that network there is
   * no launcher of ours to deploy and nothing to wait for: the pages talk to
   * Pons and a coin launched here graduates into a locked Uniswap V4 pool.
   * Everywhere else — the testnet, the EVM inside this page — Hydropad's own
   * launcher is what there is. */
  viaPons() {
    return typeof PONS !== "undefined" && PONS.has(this.chainId);
  },

  pons() { return PonsAdapter.bind(this); },

  /* Somewhere to read from and launch against, by either route. On a Pons
   * chain that is always true; elsewhere it takes a launcher of ours. */
  ready() { return this.viaPons() || !!this.launcher; },

  /* Pons is the launchpad on Robinhood Chain, but its public launch gate can
   * be closed, and then only whitelisted addresses get through it. That is not
   * a dead end: Hydropad's own launcher is a contract like any other and can
   * be opened on that chain too. This decides which route a launch takes, and
   * the form says which one it is before anybody signs. */
  async launchRoute() {
    if (!this.viaPons()) return "own";
    return (await this.pons().canLaunch()) ? "pons" : "own";
  },

  /* A read that never answers is the failure an RPC actually has: not an
   * error, which every caller here already handles, but silence. One of those
   * behind a table leaves it on "Reading the chain…" for as long as the tab
   * stays open, which is what the sidebar was doing. Every read a page waits
   * on goes through this, and one that overruns counts as one that failed. */
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

  /* Reads go wherever the token actually lives. A chain can hold both. */
  async routeFor(token) {
    if (!this.viaPons()) return "own";
    return (await this.within(this.pons().knows(token), false)) ? "pons" : "own";
  },

  /* What the pages are reading. Always one of Hydropad's own networks. */
  chainInfo() { return CHAINS[this.chainId] || CHAINS[DEFAULT_CHAIN]; },

  /* Move the wallet onto another network. A wallet that has never seen the
   * chain answers 4902; then it has to be added before it can be switched to,
   * which is what EIP-3085 is for. Robinhood Chain is new enough that most
   * wallets will take this path. */
  async switchTo(id) {
    if (!this.hasWallet()) throw new Error("No wallet in this browser.");
    if (!this.wallet) this.useWallet(this.pickWallet());
    const cfg = CHAINS[id];
    if (!cfg || !cfg.rpc) throw new Error("That network cannot be switched to from here.");
    const hex = "0x" + Number(id).toString(16);
    try {
      await this.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      const code = e && (e.code ?? e.data?.originalError?.code);
      if (code !== 4902 && code !== -32603) throw e;
      await this.wallet.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: cfg.name,
          nativeCurrency: { name: "Ether", symbol: cfg.ticker, decimals: 18 },
          rpcUrls: [cfg.rpc],
          blockExplorerUrls: cfg.explorer ? [cfg.explorer] : undefined,
        }],
      });
      await this.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    }
    try { localStorage.setItem("hydropad.chain", String(id)); } catch (_) {}
    return id;
  },

  launcherAddress() {
    const fromUrl = new URLSearchParams(location.search).get("launcher");
    if (fromUrl && ethers.isAddress(fromUrl)) {
      try { localStorage.setItem(LAUNCHER_KEY(this.chainId), fromUrl); } catch (_) {}
      return ethers.getAddress(fromUrl);
    }
    let saved = null;
    try { saved = localStorage.getItem(LAUNCHER_KEY(this.chainId)); } catch (_) {}
    const addr = saved || DEPLOYMENTS[this.chainId];
    return addr && ethers.isAddress(addr) ? ethers.getAddress(addr) : null;
  },

  rememberLauncher(addr) {
    this.launcher = ethers.getAddress(addr);
    try { localStorage.setItem(LAUNCHER_KEY(this.chainId), this.launcher); } catch (_) {}
    /* The pages navigate softly, so nothing reloads when a launcher appears
     * part way through a visit. Announce it, and the chrome catches up. */
    try {
      window.dispatchEvent(new CustomEvent("hydropad:chain", { detail: { launcher: this.launcher } }));
    } catch (_) {}
  },

  forgetLauncher() {
    try { localStorage.removeItem(LAUNCHER_KEY(this.chainId)); } catch (_) {}
    this.launcher = null;
  },

  contract(withSigner = false) {
    if (!this.launcher) throw new Error("No launcher on this network yet.");
    return new ethers.Contract(this.launcher, HYDROPAD.Hydropad.abi, withSigner ? this.requireSigner() : this.provider);
  },

  token(address, withSigner = false) {
    return new ethers.Contract(address, HYDROPAD.HydropadToken.abi, withSigner ? this.requireSigner() : this.provider);
  },

  requireSigner() {
    if (!this.signer) throw new Error("Connect a wallet first.");
    return this.signer;
  },

  /* Deploy a launcher from the connected wallet. */
  async deployLauncher() {
    const signer = this.requireSigner();
    const factory = new ethers.ContractFactory(HYDROPAD.Hydropad.abi, HYDROPAD.Hydropad.bytecode, signer);
    const c = await factory.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();
    this.rememberLauncher(addr);
    return addr;
  },

  /* ---------------- reads ---------------- */

  /* A chain can hold coins opened both ways: through Pons, and through a
   * launcher of ours somebody put there when Pons would not take them. Read
   * both and merge, newest first. */
  /* onPartial, when given, is called with whatever has been found so far, as
   * often as the scan finds more. A page can draw rows while the scan is still
   * running instead of holding a spinner until it finishes. */
  async pairings(limit = 50, onPartial = null) {
    const lots = [];
    if (this.viaPons()) {
      lots.push(await this.within(this.pons().pairings(limit, onPartial), []));
    }
    if (this.launcher) {
      const rows = await this.within(this.contract().listPairings(0, limit), []);
      lots.push(rows.map(toPairing));
    }
    if (lots.length === 1) return lots[0];
    return lots.flat().sort((a, b) => b.launchedAt - a.launchedAt).slice(0, limit);
  },

  async pairing(token) {
    if (await this.routeFor(token) === "pons") return this.pons().pairing(token);
    const p = await this.contract().pairings(token);
    return toPairing(p);
  },

  async tokenMeta(address) {
    if (await this.routeFor(address) === "pons") {
      return this.within(this.pons().tokenMeta(address), unreadable(address));
    }
    const t = this.token(address);
    const read = this.within(Promise.all([t.name(), t.symbol(), t.source(), t.totalSupply()]), null);
    const got = await read;
    if (!got) return unreadable(address);
    const [name, symbol, source, totalSupply] = got;
    return { address, name, symbol, source, totalSupply };
  },

  async balanceOf(token, who) {
    if (await this.routeFor(token) === "pons") return this.pons().balanceOf(token, who);
    return this.token(token).balanceOf(who || this.account);
  },

  async price(token) {
    return await this.routeFor(token) === "pons"
      ? this.pons().price(token) : this.contract().price(token);
  },
  async quoteBuy(token, ethIn) {
    return await this.routeFor(token) === "pons"
      ? this.pons().quoteBuy(token, ethIn) : this.contract().quoteBuy(token, ethIn);
  },
  async quoteSell(token, amount) {
    return await this.routeFor(token) === "pons"
      ? this.pons().quoteSell(token, amount) : this.contract().quoteSell(token, amount);
  },

  /* Trade history from the launcher's own logs. */
  async trades(token, blocks = 50000) {
    if (await this.routeFor(token) === "pons") return this.pons().trades(token, blocks);
    const c = this.contract();
    const head = await this.provider.getBlockNumber();
    const from = Math.max(0, head - blocks);
    const logs = await c.queryFilter(c.filters.Traded(token), from, head);
    return logs.map(l => ({
      block: l.blockNumber,
      hash: l.transactionHash,
      trader: l.args.trader,
      isBuy: l.args.isBuy,
      eth: l.args.ethAmount,
      tokens: l.args.tokenAmount,
      fee: l.args.fee,
    }));
  },

  /* ---------------- writes ---------------- */

  async launch({ name, symbol, source, supply, firstBuyWei, place, note }) {
    if (await this.launchRoute() === "pons") {
      return this.pons().launch({ name, symbol, source, place, note, firstBuyWei });
    }
    /* Falling back to our own launcher on a chain that has none yet: open it
     * first, the same as anywhere else. */
    if (!this.launcher) await this.deployLauncher();
    const c = this.contract(true);
    const tx = await c.launch(name, symbol, source, supply, { value: firstBuyWei || 0n });
    const rc = await tx.wait();
    const iface = new ethers.Interface(HYDROPAD.Hydropad.abi);
    for (const log of rc.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "Launched") return { token: parsed.args.token, hash: rc.hash };
      } catch (_) { /* a log from another contract */ }
    }
    throw new Error("Launched event not found in the receipt");
  },

  async buy(token, ethWei, minTokensOut = 0n) {
    if (await this.routeFor(token) === "pons") return this.pons().buy(token, ethWei, minTokensOut);
    const tx = await this.contract(true).buy(token, minTokensOut, { value: ethWei });
    return tx.wait();
  },

  async sell(token, amount, minEthOut = 0n) {
    if (await this.routeFor(token) === "pons") return this.pons().sell(token, amount, minEthOut);
    const erc = this.token(token, true);
    const allowance = await erc.allowance(this.account, this.launcher);
    if (allowance < amount) {
      const approve = await erc.approve(this.launcher, ethers.MaxUint256);
      await approve.wait();
    }
    const tx = await this.contract(true).sell(token, amount, minEthOut);
    return tx.wait();
  },

  async claimVault(token) {
    if (await this.routeFor(token) === "pons") {
      throw new Error("Creator fees on Pons are claimed from its own fee escrow, not from here.");
    }
    const tx = await this.contract(true).claimVault(token);
    return tx.wait();
  },

  /* ---------------- helpers ---------------- */

  explorerLink(kind, value) {
    const base = this.chainInfo().explorer;
    if (!base) return null;
    return `${base}/${kind}/${value}`;
  },
};

function toPairing(p) {
  return {
    token: p.token,
    creator: p.creator,
    source: p.source,
    ethReserve: p.ethReserve,
    tokenReserve: p.tokenReserve,
    raised: p.raised,
    vault: p.vault,
    launchedAt: Number(p.launchedAt),
    graduated: p.graduated,
  };
}

/* ---------------- launches as they happen ----------------
 *
 * The tables read the chain once, when a page opens, and then sat there: a
 * coin launched a minute later did not appear until somebody reloaded. This
 * watches for the event instead, and it watches cheaply — one call per tick
 * asking whether anything has been launched since the last block it looked at,
 * and only when something has does it tell the page to read again.
 *
 * It stops while the tab is hidden. A background tab polling a public RPC
 * every twenty seconds for an hour is a good way to get rate limited.
 */
Chain.watchLaunches = function watchLaunches(onNew, everyMs = 20000) {
  let seen = null;
  let stopped = false;
  let timer = null;

  const sources = () => {
    const out = [];
    if (this.viaPons()) {
      try {
        const f = PONS.factory(this.provider, this.chainId);
        out.push({ c: f, filter: f.filters.TokenLaunched() });
      } catch (_) {}
    }
    if (this.launcher) {
      try {
        const c = this.contract();
        if (c.filters.Launched) out.push({ c, filter: c.filters.Launched() });
      } catch (_) {}
    }
    return out;
  };

  const tick = async () => {
    if (stopped || document.hidden || this.offline) return;
    let head;
    try { head = await this.provider.getBlockNumber(); }
    catch (_) { return; }
    if (seen === null) { seen = head; return; }
    if (head <= seen) return;

    const from = seen + 1;
    seen = head;
    for (const { c, filter } of sources()) {
      let logs = [];
      try { logs = await c.queryFilter(filter, from, head); }
      catch (_) { continue; }
      if (logs.length) { onNew(logs.length); return; }
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { await tick(); if (!stopped) schedule(); }, everyMs);
  };

  /* A tab coming back to the front has usually missed something, so it asks
   * straight away rather than waiting out the rest of the interval. */
  const onShow = () => { if (!document.hidden) tick(); };
  document.addEventListener("visibilitychange", onShow);
  tick();
  schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onShow);
  };
};

/* A token the chain would not describe in time. Every caller wants a row, not
 * an exception: a table that draws one line as "unreadable" is better than a
 * table that draws nothing. */
function unreadable(address) {
  return { address, name: "Unreadable", symbol: "?", source: "", totalSupply: 0n };
}

/* Curve constants, mirrored from the contract for display. */
const CURVE = {
  FEE_BPS: 300n,
  VIRTUAL_ETH: 1200000000000000000n,
  TARGET: 4200000000000000000n,
};
