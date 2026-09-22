// Deploys the LilyPad protocol and approves the stocks. Needs a compiled out/artifacts.json (npm run compile).
//
//   RPC_URL=https://rpc.mainnet.chain.robinhood.com \
//   PRIVATE_KEY=0x… TREASURY=0x… \
//   V2_ROUTER=0x… V2_FACTORY=0x… \          # a Uniswap-V2-style DEX on the chain; omit to deploy without a graduator for now
//   LAUNCH_FEE=0.002 \                        # ETH
//   node scripts/deploy.mjs stocks.json
//
// stocks.json: [{ "symbol": "TSLA", "address": "0x…", "phantom": "16.64", "threshold": "41.6" }, …]
// phantom and threshold are in whole shares; decimals are read from each token.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, ContractFactory, Contract, parseUnits, formatUnits } from 'ethers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'out', 'artifacts.json'), 'utf8'));
const env = (k, d) => process.env[k] ?? d;
const rpc = env('RPC_URL'); const pk = env('PRIVATE_KEY'); const treasury = env('TREASURY');
if (!rpc || !pk || !treasury) { console.error('Set RPC_URL, PRIVATE_KEY and TREASURY.'); process.exit(1); }
const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(pk, provider);
const net = await provider.getNetwork();
console.log(`deployer ${wallet.address} on chain ${net.chainId}`);

const deploy = async (name, args) => {
  const f = new ContractFactory(ART[name].abi, ART[name].bytecode, wallet);
  const c = await f.deploy(...args); await c.waitForDeployment();
  console.log(`${name.padEnd(20)} ${await c.getAddress()}`); return c;
};

let graduator = '0x0000000000000000000000000000000000000000';
if (env('V2_ROUTER') && env('V2_FACTORY')) graduator = await (await deploy('UniswapV2Graduator', [env('V2_ROUTER'), env('V2_FACTORY')])).getAddress();
else console.log('no V2_ROUTER/V2_FACTORY: deploying without a graduator; curves cannot graduate until setGraduator() is called');
const factory = await deploy('LilyPadFactory', [treasury, graduator, parseUnits(env('LAUNCH_FEE', '0.002'), 18)]);

const stocksFile = process.argv[2];
const stocks = stocksFile ? JSON.parse(fs.readFileSync(stocksFile, 'utf8')) : [];
const erc20 = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
for (const s of stocks) {
  const t = new Contract(s.address, erc20, provider);
  const dec = Number(await t.decimals()); const sym = await t.symbol().catch(() => s.symbol);
  const tx = await factory.setStock(s.address, parseUnits(String(s.phantom), dec), parseUnits(String(s.threshold), dec), true);
  await tx.wait();
  console.log(`stock ${s.symbol.padEnd(6)} ${s.address} (${sym}, ${dec} dec) phantom ${s.phantom} threshold ${s.threshold}`);
}
const outFile = path.join(HERE, '..', 'out', `deployment.${net.chainId}.json`);
fs.writeFileSync(outFile, JSON.stringify({ chainId: String(net.chainId), factory: await factory.getAddress(), graduator, treasury, launchFee: env('LAUNCH_FEE', '0.002'), stocks, deployer: wallet.address, at: new Date().toISOString() }, null, 2));
console.log('written', outFile);
console.log(`\nSite: window.BONDED_LILYPAD = { factory: '${await factory.getAddress()}', chainId: ${net.chainId} }`);
