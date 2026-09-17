/* Spillway's chain layer: wallet, launcher discovery and every contract call
 * the pages make. ethers v6 is loaded as a UMD global before this file.
 *
 * There is no backend. Reads go through the wallet's provider, or through a
 * public RPC when no wallet is present, so the pages work logged out.
 */

const CHAINS = {
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
  // 84532: "0x…",
};

const LAUNCHER_KEY = c => `spillway.launcher.${c}`;

const Chain = {
  provider: null,     // read provider (wallet or public RPC)
  signer: null,
  account: null,
  chainId: null,
  launcher: null,     // address
  readOnly: true,
  offline: false,     // no node reachable from here

  hasWallet() { return typeof window !== "undefined" && !!window.ethereum; },

  /* Read-only boot: pick a chain and provider without prompting the wallet. */
  async init() {
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
      this.chainId = this.chainId || Number(localStorage.getItem("spillway.chain") || 84532);
      const cfg = CHAINS[this.chainId] || CHAINS[84532];
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
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      return true;
    } catch (_) { return false; }
  },

  /* Prompt the wallet. Returns the connected address. */
  async connect() {
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

  chainInfo() {
    return CHAINS[this.chainId] || { name: `Chain ${this.chainId}`, explorer: "", ticker: "ETH" };
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
  },

  forgetLauncher() {
    try { localStorage.removeItem(LAUNCHER_KEY(this.chainId)); } catch (_) {}
    this.launcher = null;
  },

  contract(withSigner = false) {
    if (!this.launcher) throw new Error("No launcher on this network yet.");
    return new ethers.Contract(this.launcher, SPILLWAY.Spillway.abi, withSigner ? this.requireSigner() : this.provider);
  },

  token(address, withSigner = false) {
    return new ethers.Contract(address, SPILLWAY.SpillwayToken.abi, withSigner ? this.requireSigner() : this.provider);
  },

  requireSigner() {
    if (!this.signer) throw new Error("Connect a wallet first.");
    return this.signer;
  },

  /* Deploy a launcher from the connected wallet. */
  async deployLauncher() {
    const signer = this.requireSigner();
    const factory = new ethers.ContractFactory(SPILLWAY.Spillway.abi, SPILLWAY.Spillway.bytecode, signer);
    const c = await factory.deploy();
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
    const tx = await c.launch(name, symbol, source, supply, { value: firstBuyWei || 0n });
    const rc = await tx.wait();
    const iface = new ethers.Interface(SPILLWAY.Spillway.abi);
    for (const log of rc.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "Launched") return { token: parsed.args.token, hash: rc.hash };
      } catch (_) { /* a log from another contract */ }
    }
    throw new Error("Launched event not found in the receipt");
  },

  async buy(token, ethWei, minTokensOut = 0n) {
    const tx = await this.contract(true).buy(token, minTokensOut, { value: ethWei });
    return tx.wait();
  },

  async sell(token, amount, minEthOut = 0n) {
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

/* Curve constants, mirrored from the contract for display. */
const CURVE = {
  FEE_BPS: 300n,
  VIRTUAL_ETH: 1200000000000000000n,
  TARGET: 4200000000000000000n,
};
