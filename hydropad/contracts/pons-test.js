/* What can be checked about the Pons integration without reaching Pons.
 *
 * The calls themselves cannot be exercised from here: Pons lives on Robinhood
 * Chain and this machine has no route to it. What is testable is everything
 * that would be wrong before a packet ever left — that the ABI fragments parse
 * and encode the arguments the published contracts declare, that the pairing
 * survives the round trip through the one field Pons gives us, and that the
 * curve arithmetic the pages quote with matches the curve's own shape.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ethers } = require("ethers");

let failed = 0;
const ok = (cond, name, extra) => {
  console.log(`${cond ? "ok  " : "FAIL"}   ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failed++;
};
const eq = (a, b, name) => ok(a === b, name, a === b ? "" : `got ${a}, wanted ${b}`);

/* pons.js is a browser file: it expects ethers as a global and defines two. */
const src = fs.readFileSync(path.join(__dirname, "..", "pons.js"), "utf8")
  + "\n;globalThis.__PONS = PONS; globalThis.__ADAPTER = PonsAdapter;";

/* Enough of a browser for the override to be exercised: the chain table it
 * consults, and a store to read a hand-set address out of. */
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const CHAINS = {
  1337: { name: "Local", test: true },
  4663: { name: "Robinhood Chain" },
  46630: { name: "Robinhood Testnet", test: true },
  1: { name: "Ethereum" },
};
const ctx = vm.createContext({ ethers, console, localStorage, CHAINS });
vm.runInContext(src, ctx);
const PONS = vm.runInContext("__PONS", ctx);
const PonsAdapter = vm.runInContext("__ADAPTER", ctx);

console.log("\nthe published surface\n");

const factory = new ethers.Interface(PONS.FACTORY_ABI);
const curve = new ethers.Interface(PONS.CURVE_ABI);
const token = new ethers.Interface(PONS.TOKEN_ABI);
ok(!!factory && !!curve && !!token, "every ABI fragment parses");

eq(PONS.address(4663), "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
   "the factory is PonsV2LaunchFactory, from the repository's deployment table");
ok(PONS.address(4663) !== PONS.V1_FACTORY,
   "and not the V1 factory, which answers enough of the same calls to look like a closed gate");
ok(PONS.has(4663), "Pons is on Robinhood Chain");
ok(!PONS.has(46630), "and not claimed on the testnet");
ok(!PONS.has(1337), "nor on the chain inside the page");

/* A launch is the one call that spends money, so its encoding is the one that
 * has to be right. Encode a whole TokenParams and read it back. */
const params = {
  name: "Dead Pool",
  symbol: "POOL",
  logo: "",
  description: PONS.describe("MEAD", "Lake Mead, Nevada / Arizona, US", "At 36.0161° N, 114.7377° W."),
  socials: { twitter: "", telegram: "", discord: "", website: "", farcaster: "" },
  creatorFeeRecipient: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
  creatorTaxBps: 0,
  buybackEnabled: true,
  expectedEconomics: ethers.ZeroHash,
  salt: ethers.ZeroHash,
};
const data = factory.encodeFunctionData("launchToken", [params, 3n, PONS.NATIVE]);
const back = factory.decodeFunctionData("launchToken", data);
eq(back[0].name, "Dead Pool", "the launch encodes and decodes its name");
eq(back[0].symbol, "POOL", "and its symbol");
eq(Number(back[1]), 3, "and the launch config id");
eq(back[2], PONS.NATIVE, "and an ETH-quoted curve");
eq(back[0].socials.length, 5, "socials carry the five fields the token stores");

/* The struct is ten fields, and it was nine here once: the tenth is the CREATE2
   salt, and leaving it out made a selector no function on the chain answers to,
   so every launch reverted with nothing to read. Checked against the signature
   written straight out of the Solidity rather than against itself. */
const LAUNCH_SIG = "launchToken((string,string,string,string,(string,string,string,string,string),"
  + "address,uint16,bool,bytes32,bytes32),uint256,address)";
eq(factory.getFunction("launchToken").selector, ethers.id(LAUNCH_SIG).slice(0, 10),
   "launchToken matches the signature in PonsV2LaunchFactory.sol");
eq(factory.getFunction("launchToken").selector, "0xf35abbcf", "and that selector is 0xf35abbcf");
eq(back[0].length, 10, "TokenParams carries all ten of its fields");
eq(curve.getFunction("buy").selector, "0x59a87bc1", "buy keeps its selector");
eq(curve.getFunction("sell").selector, "0xd04c6983", "sell keeps its selector");

console.log("\nthe factory a test may point at\n");

/* The mock exists so the paying path can be walked without Robinhood Chain.
 * What must never follow from that is a way to aim a real visitor at a
 * factory somebody else chose. */
const MOCK = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
store.set("hydropad.pons.factory.46630", MOCK);
store.set("hydropad.pons.factory.4663", MOCK);
store.set("hydropad.pons.factory.1", MOCK);

eq(PONS.address(46630), ethers.getAddress(MOCK), "a test chain can be pointed at a local factory");
ok(PONS.has(46630), "and Pons is then routed to on that chain");
eq(PONS.address(4663), "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
   "the published address always wins: mainnet cannot be repointed");
eq(PONS.address(1), null, "and a live chain with no factory of ours refuses the override outright");
ok(!PONS.overrideAllowed(4663), "4663 is not overridable");
ok(!PONS.overrideAllowed(1), "nor is Ethereum");
ok(PONS.overrideAllowed(46630), "the testnet is");

store.set("hydropad.pons.factory.46630", "not an address");
eq(PONS.address(46630), null, "a stored value that is not an address is ignored rather than trusted");
store.delete("hydropad.pons.factory.46630");
store.delete("hydropad.pons.factory.4663");
store.delete("hydropad.pons.factory.1");
ok(!PONS.has(46630), "and with nothing stored the testnet has no Pons again");

console.log("\nthe pairing, through the only field Pons gives us\n");

const described = PONS.describe("MEAD", "Lake Mead", null);
eq(PONS.sourceOf(described), "MEAD", "the ticker survives the round trip");
ok(described.includes("Lake Mead"), "a person reads the place, not a tag");
ok(/no ownership of the water/.test(described), "and the disclaimer travels with it on chain");
eq(PONS.sourceOf("just some meme coin"), null, "a token that is not ours reads as not ours");
eq(PONS.sourceOf(""), null, "an empty description does not throw");
eq(PONS.sourceOf(undefined), null, "nor does a missing one");
eq(PONS.sourceOf(PONS.describe("NSAS", "Nubian Sandstone")), "NSAS", "a second source, with no note");

console.log("\nthe curve the pages quote with\n");

/* Pons prices against a reserve that includes a phantom amount nobody
 * deposited, exactly the shape of Hydropad's own virtual reserve. */
const q = ethers.parseEther("4.2");      // quote reserve, phantom included
const t = ethers.parseEther("800000000");
const feeBps = 100;

const out = PONS.quoteBuy(q, t, ethers.parseEther("1"), feeBps);
ok(out > 0n, "a buy returns tokens", ethers.formatEther(out));

const bigger = PONS.quoteBuy(q, t, ethers.parseEther("2"), feeBps);
ok(bigger > out, "twice the ETH buys more tokens");
ok(bigger < out * 2n, "but less than twice as many: the price rises as it fills");

const after = PONS.quoteBuy(q + ethers.parseEther("1"), t - out, ethers.parseEther("1"), feeBps);
ok(after < out, "the second buyer of the same size pays more per token");

const backOut = PONS.quoteSell(q, t, out, feeBps);
ok(backOut < ethers.parseEther("1"), "selling straight back loses the fee both ways",
   ethers.formatEther(backOut));

eq(PONS.quoteBuy(q, t, 0n, feeBps), 0n, "nothing in, nothing out");
eq(PONS.quoteSell(q, t, 0n, feeBps), 0n, "and the same selling");

const noFee = PONS.quoteBuy(q, t, ethers.parseEther("1"), 0);
ok(noFee > out, "a fee-free curve returns more than a fee-charging one");

console.log("\nthe adapter\n");

ok(typeof PonsAdapter.launch === "function", "the adapter launches");
ok(typeof PonsAdapter.buy === "function" && typeof PonsAdapter.sell === "function", "and trades");
for (const m of ["pairings", "pairing", "tokenMeta", "balanceOf", "price", "quoteBuy", "quoteSell", "trades"]) {
  ok(typeof PonsAdapter[m] === "function", `it answers ${m}(), like the launcher it stands in for`);
}
ok(PonsAdapter.START_BLOCK[4663] === undefined,
   "no invented floor for the scan: 8991118 was the V1 factory's, and too high a floor hides launches");
ok(PonsAdapter.CHUNK <= 50000, "and asks for log ranges a public RPC will serve");

console.log("\nthe gate\n");

/* The bug this file exists to keep out: asking launchEnabled() rather than
 * canLaunch(caller). The first is only the public gate; the second is the
 * predicate launchToken enforces, and it is also true for whitelisted
 * addresses while the gate is shut. */
ok(PONS.FACTORY_ABI.some(f => /function canLaunch/.test(f)), "canLaunch is in the surface");
const ponsSrc = fs.readFileSync(path.join(__dirname, "..", "pons.js"), "utf8");
ok(/canLaunch\(/.test(ponsSrc), "and the launch path asks it");
ok(!/if \(!enabled\) throw/.test(ponsSrc), "the public gate alone no longer refuses a launch");
ok(/willLaunch/.test(ponsSrc), "there is a read for whether Pons would take this address");

const chainSrc = fs.readFileSync(path.join(__dirname, "..", "chain.js"), "utf8");
ok(/launchRoute\(\)/.test(chainSrc), "a launch picks its route");
ok(/routeFor\(/.test(chainSrc), "and each token is read wherever it lives");
ok(/ready\(\)/.test(chainSrc), "somewhere to read from is either route, not just a launcher of ours");

console.log(failed ? `\n${failed} failed\n` : "\nall good\n");
process.exit(failed ? 1 : 0);
