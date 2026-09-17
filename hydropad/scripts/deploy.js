/* Put the launcher on a real chain, from your own key, on your own machine.
 *
 *   PRIVATE_KEY=0x… node scripts/deploy.js --network robinhood
 *   PRIVATE_KEY=0x… node scripts/deploy.js --network robinhood-testnet
 *
 * The key is read from the environment and never written anywhere: not to a
 * file, not to the console, not into the build. Run this where the key lives.
 *
 * It refuses to send anything until it has checked that the node on the other
 * end really is the chain you named, that the account can cover the gas, and
 * that you have seen the estimate. --yes skips that last confirmation.
 *
 * What comes back is the launcher's address. Paste it into DEPLOYMENTS in
 * chain.js and every visitor on that network reads the same pairings without
 * configuring anything, or pass --write and this does it for you.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { ethers } = require("ethers");

const NETWORKS = {
  "robinhood": {
    chainId: 4663,
    name: "Robinhood Chain",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    live: true,
  },
  "robinhood-testnet": {
    chainId: 46630,
    name: "Robinhood Testnet",
    rpc: "https://rpc.testnet.chain.robinhood.com/rpc",
    explorer: "https://explorer.testnet.chain.robinhood.com",
  },
  "local": {
    chainId: Number(process.env.CHAIN_ID || 46630),
    name: "Local node",
    rpc: "http://127.0.0.1:8545",
    explorer: "",
  },
};

const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const die = msg => { console.error("\n" + msg + "\n"); process.exit(1); };

const ask = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); });
});

/* The launcher's ABI and bytecode, as the site itself loads them. */
function artifact() {
  const file = path.join(__dirname, "..", "contract.js");
  if (!fs.existsSync(file)) die("contract.js is missing. Run `npm run build` first.");
  const src = fs.readFileSync(file, "utf8") + "\n;module.exports = HYDROPAD;";
  const m = { exports: {} };
  new Function("module", "exports", src)(m, m.exports);
  return m.exports;
}

/* Writing the address back into the build, so nobody has to paste it in by
 * hand and nobody ends up reading a different launcher than everyone else. */
function remember(chainId, address) {
  const file = path.join(__dirname, "..", "chain.js");
  let src = fs.readFileSync(file, "utf8");
  const line = `  ${chainId}: "${address}",`;
  const live = new RegExp(`^\\s*${chainId}:\\s*"0x[0-9a-fA-F]{40}",\\s*$`, "m");
  const commented = new RegExp(`^\\s*//\\s*${chainId}:.*$`, "m");
  if (live.test(src)) src = src.replace(live, line);
  else if (commented.test(src)) src = src.replace(commented, line);
  else src = src.replace(/^const DEPLOYMENTS = \{$/m, `const DEPLOYMENTS = {\n${line}`);
  fs.writeFileSync(file, src);
  console.log(`   chain.js now ships ${address} as the launcher on ${chainId}.`);
}

(async () => {
  const which = opt("--network", "robinhood-testnet");
  const net = NETWORKS[which];
  if (!net) die(`Unknown network "${which}". One of: ${Object.keys(NETWORKS).join(", ")}.`);

  const key = process.env.PRIVATE_KEY;
  if (!key) die(
    "PRIVATE_KEY is not set. Run this on the machine that holds the key:\n\n" +
    `  PRIVATE_KEY=0x… node scripts/deploy.js --network ${which}\n\n` +
    "Use a key that exists for this and holds only the gas it needs.");

  const provider = new ethers.JsonRpcProvider(net.rpc, undefined, { staticNetwork: true });

  /* A node that answers is not necessarily the node you meant. */
  let live;
  try {
    live = await provider.getNetwork();
  } catch (e) {
    die(`Cannot reach ${net.name} at ${net.rpc}\n  ${e.shortMessage || e.message}`);
  }
  if (Number(live.chainId) !== net.chainId) {
    die(`${net.rpc} answers as chain ${live.chainId}, not ${net.chainId}. Refusing to deploy.`);
  }

  const wallet = new ethers.Wallet(key, provider);
  const balance = await provider.getBalance(wallet.address);
  const head = await provider.getBlockNumber();

  console.log(`\n${net.name}  ·  chain ${net.chainId}  ·  block ${head}`);
  console.log(`account  ${wallet.address}`);
  console.log(`balance  ${ethers.formatEther(balance)} ETH`);

  const { Hydropad } = artifact();
  const factory = new ethers.ContractFactory(Hydropad.abi, Hydropad.bytecode, wallet);
  const tx = await factory.getDeployTransaction();

  let gas, fee;
  try {
    gas = await provider.estimateGas({ ...tx, from: wallet.address });
    fee = await provider.getFeeData();
  } catch (e) {
    die(`The node refused to estimate this deployment:\n  ${e.shortMessage || e.message}`);
  }
  const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  const cost = gas * price;
  console.log(`gas      ${gas} at ${ethers.formatUnits(price, "gwei")} gwei  ≈ ${ethers.formatEther(cost)} ETH`);

  if (balance < cost) {
    die(`Not enough to cover it: ${ethers.formatEther(balance)} ETH against ${ethers.formatEther(cost)} ETH of gas.`);
  }

  if (!flag("--yes")) {
    const what = net.live ? "REAL ETH on mainnet" : "test ETH";
    const a = await ask(`\nDeploy the launcher to ${net.name}, paying ${what}? [y/N] `);
    if (a !== "y" && a !== "yes") die("Nothing sent.");
  }

  console.log("\nsending…");
  const c = await factory.deploy();
  const sent = c.deploymentTransaction();
  console.log(`tx       ${sent.hash}`);
  await c.waitForDeployment();
  const address = await c.getAddress();
  const receipt = await provider.getTransactionReceipt(sent.hash);

  console.log(`\nlauncher ${address}`);
  console.log(`block    ${receipt.blockNumber}  ·  gas used ${receipt.gasUsed}`);
  if (net.explorer) console.log(`explorer ${net.explorer}/address/${address}`);

  /* Proof it is the contract we meant, read back from the chain itself. */
  const onChain = await provider.getCode(address);
  console.log(`code     ${(onChain.length - 2) / 2} bytes on chain`);
  const launcher = new ethers.Contract(address, Hydropad.abi, provider);
  const pairings = await launcher.listPairings(0, 1);
  console.log(`state    ${pairings.length} pairings, as a fresh launcher should have`);

  if (flag("--write")) remember(net.chainId, address);
  else console.log(`\nPut it in DEPLOYMENTS in chain.js:\n  ${net.chainId}: "${address}",`);
})().catch(e => die(e.shortMessage || e.message || String(e)));
