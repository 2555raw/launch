/* Can a power station actually be paired to a coin through the launcher?
 *
 *   npm run node        # in another shell
 *   node contracts/pair-test.js
 *
 * Not a mock of our own code: this runs pons.js — the same file the browser
 * loads — against a real EVM with a real PonsV2LaunchFactory deployed on it,
 * launches a token, and then reads the description back off the chain the way
 * an explorer or an indexer would.
 *
 * Pons itself lives on Robinhood Chain and no test machine here can reach it,
 * so the factory is contracts/PonsV2Mock.sol: the published surface, the same
 * signatures, the same struct order, CREATE2 off the caller's salt. What it
 * proves is Gridpad's side — that the call encodes, that the register's figures
 * survive into the token, and that the tag parses back out. contracts/
 * pons-test.js pins the selector against the real Solidity separately.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const solc = require("solc");
const { ethers } = require("ethers");

const RPC = "http://127.0.0.1:8545";
const FEE = ethers.parseEther("0.0005");
let failed = 0;
const ok = (c, name, extra) => {
  console.log(`${c ? "ok  " : "FAIL"}   ${name}${extra ? "  — " + extra : ""}`);
  if (!c) failed++;
};
const eq = (a, b, name) => ok(a === b, name, a === b ? "" : `got ${a}, wanted ${b}`);

/* pons.js and data.js are browser files: give them the globals a page would. */
function load(provider, chainId, account, signer) {
  const ctx = vm.createContext({
    ethers, console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    CHAINS: { [chainId]: { name: "Local", test: true } },
  });
  for (const f of ["data.js", "pons.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
  }
  vm.runInContext("globalThis.__P = PONS; globalThis.__A = PonsAdapter; globalThis.__D = PLANTS;", ctx);
  return {
    PONS: vm.runInContext("__P", ctx),
    Adapter: vm.runInContext("__A", ctx),
    PLANTS: vm.runInContext("__D", ctx),
  };
}

function compileMock() {
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: { "m.sol": { content: fs.readFileSync(path.join(__dirname, "PonsV2Mock.sol"), "utf8") } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris",
                outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  })));
  for (const e of out.errors || []) if (e.severity === "error") throw new Error(e.formattedMessage);
  const c = out.contracts["m.sol"].PonsV2LaunchFactory;
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const net = await provider.getNetwork();
  const chainId = Number(net.chainId);
  const accts = await provider.listAccounts();
  const owner = await provider.getSigner(await accts[1].getAddress());
  const me = await accts[0].getAddress();
  const signer = await provider.getSigner(me);

  const { abi, bytecode } = compileMock();
  const factory = await new ethers.ContractFactory(abi, bytecode, owner).deploy(FEE, false);
  await factory.waitForDeployment();
  const at = await factory.getAddress();
  /* The gate shut and this address whitelisted: the one case where
     canLaunch(caller) and launchEnabled() disagree. */
  await (await factory.setWhitelisted(me, true)).wait();

  const { PONS, Adapter, PLANTS } = load(provider, chainId, me, signer);
  PONS.FACTORY[chainId] = at;
  const chain = {
    provider, signer, account: me, chainId,
    requireSigner: () => signer,
  };
  const pons = Adapter.bind(chain);

  console.log(`\nmock Pons at ${at}  ·  chain ${chainId}  ·  gate shut, ${me.slice(0, 8)}… whitelisted\n`);
  console.log("the register\n");

  ok(PLANTS.length >= 100, "the register has something in it", `${PLANTS.length} plants`);
  ok(PLANTS.every(p => p.url), "every plant carries the URL of the body that published it");
  ok(PLANTS.every(p => Array.isArray(p.g) && p.g.length === 2), "and coordinates");
  ok(PLANTS.every(p => p.mw > 0), "and a capacity");
  ok(new Set(PLANTS.map(p => p.t)).size === PLANTS.length, "tickers are unique");
  const classes = [...new Set(PLANTS.map(p => p.c))].sort();
  eq(classes.join(", "), "Geothermal, Hydro, Solar, Wind", "four classes, all of them renewable");

  console.log("\nlaunching a coin paired to one of them\n");

  const plant = PLANTS.find(p => p.n === "Grand Coulee") || PLANTS[0];
  const place = `${plant.n}, ${plant.l}`;
  const note = `${plant.c}, ${plant.mw.toLocaleString("en-US")} MW, at `
    + `${Math.abs(plant.g[0]).toFixed(4)}° ${plant.g[0] >= 0 ? "N" : "S"}, `
    + `${Math.abs(plant.g[1]).toFixed(4)}° ${plant.g[1] >= 0 ? "E" : "W"}.`;

  const before = await provider.getBalance(at);
  const res = await pons.launch({
    name: `${plant.n} Coin`, symbol: plant.t, source: plant.t, place, note,
    firstBuyWei: ethers.parseEther("0.25"),
  });
  const after = await provider.getBalance(at);

  ok(!!res.token && ethers.isAddress(res.token), "the launch returned a token", res.token);
  eq((after - before).toString(), FEE.toString(), "and paid the factory exactly its launch fee");

  const rec = await factory.getLaunchedToken(res.token);
  ok(rec.exists, "Pons has a record of it");
  eq(rec.deployer.toLowerCase(), me.toLowerCase(), "with this address as the deployer");
  eq(rec.pairToken, ethers.ZeroAddress, "and an ETH-quoted curve");

  console.log("\nthe pairing, read back off the chain\n");

  const erc = new ethers.Contract(res.token, [
    "function description() view returns (string)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
  ], provider);
  const description = await erc.description();

  ok(description.includes(plant.n), "the station is named in it", plant.n);
  ok(description.includes(plant.l), "and the country");
  ok(description.includes(`${plant.mw.toLocaleString("en-US")} MW`), "and the capacity as the register has it");
  ok(/\d+\.\d{4}° [NS]/.test(description), "and the coordinates");
  ok(/no ownership of the plant/.test(description), "the disclaimer travelled with it");
  ok(/no claim on its output/.test(description), "including the one about the output");
  eq(PONS.sourceOf(description), plant.t, "and the ticker parses back out of the tag");
  eq(await erc.symbol(), plant.t, "the token carries the ticker");

  const held = await erc.balanceOf(me);
  ok(held > 0n, "the opening buy landed on the curve",
     `${Number(ethers.formatEther(held)).toLocaleString("en-US")} ${plant.t}`);

  console.log(`\n   ${description}\n`);

  console.log("a second launch, so one is not a fluke\n");
  const other = PLANTS.find(p => p.c === "Geothermal" && p.t !== plant.t);
  const r2 = await pons.launch({
    name: other.n, symbol: other.t, source: other.t,
    place: `${other.n}, ${other.l}`, note: `${other.c}, ${other.mw} MW.`,
    firstBuyWei: 0n,
  });
  ok(r2.token !== res.token, "a different salt gives a different address", r2.token);
  const d2 = await new ethers.Contract(r2.token, ["function description() view returns (string)"],
                                       provider).description();
  eq(PONS.sourceOf(d2), other.t, "and its own ticker reads back");

  console.log(failed ? `\n${failed} failed\n` : "\nall good\n");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("\nFAILED:", e.message); process.exit(1); });
