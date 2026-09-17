/* Hydropad's chain layer: wallet, launcher discovery and every contract call
 * the pages make. ethers v6 is loaded as a UMD global before this file.
 *
 * There is no backend. Reads go through the wallet's provider, or through a
 * public RPC when no wallet is present, so the pages work logged out.
 */

const CHAINS = {
  1337:     { name: "In-page chain", rpc: "",                                            explorer: "",                               ticker: "ETH", test: true },
  /* Robinhood Chain is an Arbitrum Orbit L2 that settles to Ethereum and pays
   * gas in ETH, so the launcher deploys and runs on it unchanged. Contract
   * deployment there is permissionless: no allowlist to get onto. */
  4663:     { name: "Robinhood Chain", rpc: "https://rpc.mainnet.chain.robinhood.com",   explorer: "https://robinhoodchain.blockscout.com", ticker: "ETH" },
  46630:    { name: "Robinhood Testnet", rpc: "https://rpc.testnet.chain.robinhood.com/rpc", explorer: "https://explorer.testnet.chain.robinhood.com", ticker: "ETH", test: true },
  1:        { name: "Ethereum",     rpc: "https://ethereum-rpc.publicnode.com",         explorer: "https://etherscan.io",           ticker: "ETH" },
  8453:     { name: "Base",         rpc: "https://mainnet.base.org",                    explorer: "https://basescan.org",           ticker: "ETH" },
  84532:    { name: "Base Sepolia", rpc: "https://sepolia.base.org",                    explorer: "https://sepolia.basescan.org",   ticker: "ETH", test: true },
  11155111: { name: "Sepolia",      rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io",   ticker: "ETH", test: true },
  10:       { name: "Optimism",     rpc: "https://mainnet.optimism.io",                 explorer: "https://optimistic.etherscan.io",ticker: "ETH" },
  42161:    { name: "Arbitrum",     rpc: "https://arb1.arbitrum.io/rpc",                explorer: "https://arbiscan.io",            ticker: "ETH" },
  137:      { name: "Polygon",      rpc: "https://polygon-rpc.com",                     explorer: "https://polygonscan.com",        ticker: "POL" },
  31337:    { name: "Localhost",    rpc: "http://127.0.0.1:8545",                       explorer: "",                               ticker: "ETH", test: true },
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
const LAUNCH_CHAINS = new Set([4663, 46630, 1337]);

const LAUNCHER_KEY = c => `hydropad.launcher.${c}`;

const Chain = {
  provider: null,     // read provider (wallet or public RPC)
  signer: null,
  account: null,
  chainId: null,
  launcher: null,     // address
  readOnly: true,
  offline: false,     // no node reachable from here
  demo: false,        // running the EVM inside this page

  hasWallet() { return typeof window !== "undefined" && !!window.ethereum; },

  /* Read-only boot: pick a chain and provider without prompting the wallet. */
  async init(onProgress) {
    if (DemoChain.isOn()) {
      try {
        await this.useDemo(onProgress);
        await this.openDemoWorld(onProgress);
        return this;
      } catch (e) {
        console.warn("demo chain failed to boot", e);
        DemoChain.disable();
      }
    }
    if (this.hasWallet()) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const hexId = await window.ethereum.request({ method: "eth_chainId" });
        this.chainId = Number(BigInt(hexId));
        const bp = new ethers.BrowserProvider(window.ethereum);
        this.provider = bp;
        if (accounts && accounts.length) {
          this.account = ethers.getAddress(accounts[0]);
          this.signer = await bp.getSigner();
          this.readOnly = false;
        }
        window.ethereum.on?.("chainChanged", () => location.reload());
        window.ethereum.on?.("accountsChanged", () => location.reload());
      } catch (e) { console.warn("wallet init failed", e); }
    }
    if (!this.provider) {
      this.chainId = this.chainId || Number(localStorage.getItem("hydropad.chain") || DEFAULT_CHAIN);
      const cfg = CHAINS[this.chainId] || CHAINS[DEFAULT_CHAIN];
      this.provider = new ethers.JsonRpcProvider(cfg.rpc, undefined, { staticNetwork: true });
    }
    this.launcher = this.launcherAddress();
    this.offline = !(await this.reachable());

    /* Nothing to talk to: rather than show a dead site, run the chain here,
     * unless somebody has deliberately switched back to their own wallet. */
    if ((this.offline || !this.hasWallet()) && !DemoChain.optedOut()) {
      try {
        await this.useDemo(onProgress);
        await this.openDemoWorld(onProgress);
      } catch (e) {
        console.warn("could not start the in-page chain", e);
      }
    }
    return this;
  },

  /* A fresh in-page chain has no launcher and nothing launched. Deploy one and
   * open the seed pairings, so the tables hold real state from the first load. */
  async openDemoWorld(onProgress = () => {}) {
    if (!this.demo) return;
    if (!this.launcher) {
      onProgress("Deploying the launcher…");
      await this.deployLauncher();
    }
    /* Top up rather than bail out: a reload part way through the seeding used
     * to leave the world permanently half open, because any one pairing was
     * taken as proof that all of them were there. Each seed is paired to a
     * different source, so that is what is checked. */
    const existing = await this.pairings(20);
    const have = new Set(existing.map(p => p.source));

    const open = s => this.launch({
      name: s.name,
      symbol: s.symbol,
      source: s.source,
      supply: ethers.parseEther(s.supply),
      firstBuyWei: ethers.parseEther(s.buy),
    });

    /* Each of these is a real transaction through a real EVM, which takes a
     * second or two. Only the first is waited on: the page opens with something
     * in its tables, and the rest arrive behind it, announcing themselves so
     * whatever is on screen can read the chain again. */
    const missing = DemoChain.SEEDS.filter(s => !have.has(s.source));
    if (!missing.length) return;
    const [first, ...rest] = missing;
    onProgress(`Opening ${first.symbol}…`);
    await open(first);
    this.seeding = (async () => {
      for (const s of rest) {
        try {
          await open(s);
          window.dispatchEvent(new CustomEvent("hydropad:chain", { detail: { symbol: s.symbol } }));
        } catch (e) { console.warn("seed failed", s.symbol, e); }
      }
      this.seeding = null;
    })();
  },

  /* Start (or restart) the in-page EVM and run everything against it. */
  async useDemo(onProgress) {
    DemoChain.enable();
    const injected = await DemoChain.boot(onProgress);
    const bp = new ethers.BrowserProvider(injected);
    this.provider = bp;
    this.signer = await bp.getSigner(DemoChain.accounts[0]);
    this.account = ethers.getAddress(DemoChain.accounts[0]);
    this.chainId = DemoChain.CHAIN_ID;
    this.demo = true;
    this.offline = false;
    this.readOnly = false;
    this.launcher = this.launcherAddress();
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
  async connect() {
    if (this.demo) return this.account;
    if (!this.hasWallet()) throw new Error("No wallet found. Install MetaMask, Rabby or another EIP-1193 wallet.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const bp = new ethers.BrowserProvider(window.ethereum);
    this.provider = bp;
    this.signer = await bp.getSigner();
    this.account = ethers.getAddress(accounts[0]);
    this.chainId = Number((await bp.getNetwork()).chainId);
    this.readOnly = false;
    this.launcher = this.launcherAddress();
    return this.account;
  },

  /* Can a pairing be opened from where we are standing? */
  canLaunch() { return LAUNCH_CHAINS.has(Number(this.chainId)); },

  chainInfo() {
    return CHAINS[this.chainId] || { name: `Chain ${this.chainId}`, explorer: "", ticker: "ETH" };
  },

  /* Move the wallet onto another network. A wallet that has never seen the
   * chain answers 4902; then it has to be added before it can be switched to,
   * which is what EIP-3085 is for. Robinhood Chain is new enough that most
   * wallets will take this path. */
  async switchTo(id) {
    if (this.demo) throw new Error("Leave the in-page chain first.");
    if (!this.hasWallet()) throw new Error("No wallet in this browser.");
    const cfg = CHAINS[id];
    if (!cfg || !cfg.rpc) throw new Error("That network cannot be switched to from here.");
    const hex = "0x" + Number(id).toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      const code = e && (e.code ?? e.data?.originalError?.code);
      if (code !== 4902 && code !== -32603) throw e;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: cfg.name,
          nativeCurrency: { name: "Ether", symbol: cfg.ticker, decimals: 18 },
          rpcUrls: [cfg.rpc],
          blockExplorerUrls: cfg.explorer ? [cfg.explorer] : undefined,
        }],
      });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
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
  /* Estimating gas makes the node run the transaction over and over while it
   * binary searches for a limit. On a real node that is cheap; on the EVM
   * running inside this page it is the slowest thing the site does, and a
   * launch that deploys a token inside the call can take minutes. These are
   * measured ceilings from contracts/test.js, generous enough to cover any
   * input the forms allow, and they are only used on the in-page chain: a real
   * wallet still estimates and still shows the user what it will cost. */
  GAS: { deploy: 4_200_000n, launch: 3_400_000n, buy: 420_000n, sell: 400_000n, approve: 120_000n, claim: 140_000n },

  gas(kind, extra = {}) {
    if (!this.demo) return extra;
    return { ...extra, gasLimit: this.GAS[kind] };
  },

  async deployLauncher() {
    const signer = this.requireSigner();
    const factory = new ethers.ContractFactory(HYDROPAD.Hydropad.abi, HYDROPAD.Hydropad.bytecode, signer);
    const c = await factory.deploy(this.gas("deploy"));
    await c.waitForDeployment();
    const addr = await c.getAddress();
    this.rememberLauncher(addr);
    return addr;
  },

  /* ---------------- reads ---------------- */

  async pairings(limit = 50) {
    if (!this.launcher) return [];
    const raw = await this.contract().listPairings(0, limit);
    return raw.map(toPairing);
  },

  async pairing(token) {
    const p = await this.contract().pairings(token);
    return toPairing(p);
  },

  async tokenMeta(address) {
    const t = this.token(address);
    const [name, symbol, source, totalSupply] = await Promise.all([
      t.name(), t.symbol(), t.source(), t.totalSupply(),
    ]);
    return { address, name, symbol, source, totalSupply };
  },

  async balanceOf(token, who) {
    return this.token(token).balanceOf(who || this.account);
  },

  async price(token) { return this.contract().price(token); },
  async quoteBuy(token, ethIn) { return this.contract().quoteBuy(token, ethIn); },
  async quoteSell(token, amount) { return this.contract().quoteSell(token, amount); },

  /* Trade history from the launcher's own logs. */
  async trades(token, blocks = 50000) {
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

  async launch({ name, symbol, source, supply, firstBuyWei }) {
    const c = this.contract(true);
    const tx = await c.launch(name, symbol, source, supply, this.gas("launch", { value: firstBuyWei || 0n }));
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
    const tx = await this.contract(true).buy(token, minTokensOut, this.gas("buy", { value: ethWei }));
    return tx.wait();
  },

  async sell(token, amount, minEthOut = 0n) {
    const erc = this.token(token, true);
    const allowance = await erc.allowance(this.account, this.launcher);
    if (allowance < amount) {
      const approve = await erc.approve(this.launcher, ethers.MaxUint256, this.gas("approve"));
      await approve.wait();
    }
    const tx = await this.contract(true).sell(token, amount, minEthOut, this.gas("sell"));
    return tx.wait();
  },

  async claimVault(token) {
    const tx = await this.contract(true).claimVault(token, this.gas("claim"));
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

/* Curve constants, mirrored from the contract for display. */
const CURVE = {
  FEE_BPS: 300n,
  VIRTUAL_ETH: 1200000000000000000n,
  TARGET: 4200000000000000000n,
};
