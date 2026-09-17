/* An Ethereum node inside the page.
 *
 * When no wallet or no network is available, Spillway can run a real EVM in the
 * browser (Ganache's web build) and deploy the same compiled bytecode to it.
 * Nothing is faked: the launcher executes, the curve is the contract's, and the
 * numbers come from state transitions the EVM actually performed. Nothing leaves
 * the browser either — there is no node to leave to.
 *
 * Each page load starts a fresh EVM, so every transaction sent here is journalled
 * in localStorage and replayed on boot. Accounts are deterministic, so replaying
 * the same transactions in the same order rebuilds the same chain, addresses and
 * balances.
 */

const DemoChain = {
  JOURNAL: "spillway.demo.journal",
  FLAG: "spillway.demo.on",
  CHAIN_ID: 1337,
  MAX_TXS: 200,

  provider: null,
  accounts: [],
  replaying: false,

  isOn() {
    try { return localStorage.getItem(this.FLAG) === "1"; } catch (_) { return false; }
  },

  enable() { try { localStorage.setItem(this.FLAG, "1"); } catch (_) {} },

  disable() {
    try {
      localStorage.removeItem(this.FLAG);
      localStorage.removeItem(this.JOURNAL);
      localStorage.removeItem(`spillway.launcher.${this.CHAIN_ID}`);
    } catch (_) {}
  },

  reset() {
    try {
      localStorage.removeItem(this.JOURNAL);
      localStorage.removeItem(`spillway.launcher.${this.CHAIN_ID}`);
    } catch (_) {}
  },

  /* The EVM is 7MB of JavaScript: only fetch it when it is actually used. */
  async load() {
    if (typeof Ganache !== "undefined") return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/ganache.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the in-page EVM."));
      document.head.appendChild(s);
    });
  },

  /* Boots the EVM, replays the journal, and hands back an EIP-1193 provider the
   * rest of the site treats exactly like a wallet. */
  async boot(onProgress = () => {}) {
    onProgress("Loading the EVM…");
    await this.load();

    onProgress("Starting the chain…");
    this.provider = Ganache.provider({
      logging: { quiet: true },
      wallet: { deterministic: true, totalAccounts: 3, defaultBalance: 1000 },
      chain: { chainId: this.CHAIN_ID, networkId: this.CHAIN_ID, hardfork: "merge" },
      miner: { blockGasLimit: 30000000 },
    });
    this.accounts = await this.provider.request({ method: "eth_accounts" });

    const journal = this.read();
    if (journal.length) {
      this.replaying = true;
      for (let i = 0; i < journal.length; i++) {
        onProgress(`Replaying transaction ${i + 1} of ${journal.length}…`);
        try {
          await this.provider.request({ method: "eth_sendTransaction", params: [journal[i]] });
        } catch (e) {
          console.warn("demo replay failed at", i, e);
          this.write(journal.slice(0, i));   // drop what no longer applies
          break;
        }
      }
      this.replaying = false;
    }
    return this.eip1193();
  },

  read() {
    try { return JSON.parse(localStorage.getItem(this.JOURNAL) || "[]"); } catch (_) { return []; }
  },

  write(list) {
    try { localStorage.setItem(this.JOURNAL, JSON.stringify(list)); } catch (_) {}
  },

  record(tx) {
    const { from, to, data, value, gas } = tx;
    const list = this.read();
    list.push({ from, to, data, value, gas });
    this.write(list.slice(-this.MAX_TXS));
  },

  eip1193() {
    const self = this;
    return {
      isSpillwayDemo: true,
      on() {}, removeListener() {},
      async request({ method, params = [] }) {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return self.accounts;
        if (method === "eth_chainId") return "0x" + self.CHAIN_ID.toString(16);
        if (method === "eth_sendTransaction") {
          const hash = await self.provider.request({ method, params });
          if (!self.replaying) self.record(params[0]);
          return hash;
        }
        return self.provider.request({ method, params });
      },
    };
  },
};
