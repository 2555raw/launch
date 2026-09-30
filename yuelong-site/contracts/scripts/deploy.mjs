// Deploys Yuelong to any EVM chain from your own key, and writes the addresses the site needs.
// Needs a compiled out/artifacts.json (npm run compile).
//
// Put the settings in contracts/.env (git ignores it) or pass them as environment variables:
//
//   RPC_URL=https://test.chain.opentensor.ai     # Bittensor EVM testnet (chain 945)
//   PRIVATE_KEY=0x…                              # the deployer; it becomes the factory owner
//   TREASURY=0x…                                 # where fees go (default: the deployer)
//   LAUNCH_FEE=0                                 # native coin per launch
//   PHANTOM=20  THRESHOLD=50                     # native-pair curve: virtual reserve, graduation target
//   WNATIVE=0x…                                  # reuse an existing wrapped native coin (default: deploy one)
//   NATIVE_NAME="Wrapped TAO"  NATIVE_SYMBOL=WTAO
//
//   node scripts/deploy.mjs [pairs.json]
//
// pairs.json (optional, ERC20 quote assets besides the native coin):
//   [{ "symbol": "USDC", "address": "0x…", "phantom": "5000", "threshold": "12000" }]
//
// Writes out/deployment.<chainId>.json. The site's admin page (/admin.html) imports it, or
// deploys the same contracts straight from a browser wallet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, NonceManager, ContractFactory, Contract, parseUnits, getAddress } from 'ethers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const dotenv = path.join(ROOT, '.env');
if (fs.existsSync(dotenv)) for (const line of fs.readFileSync(dotenv, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const ART = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'artifacts.json'), 'utf8'));
const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const rpc = env('RPC_URL'); const pk = env('PRIVATE_KEY');
if (!rpc || !pk) { console.error('Set RPC_URL and PRIVATE_KEY (contracts/.env or the environment).'); process.exit(1); }

const provider = new JsonRpcProvider(rpc);
const key = new Wallet(pk, provider);
const wallet = new NonceManager(key);
wallet.address = key.address;
const net = await provider.getNetwork();
const chainId = Number(net.chainId);
const treasury = getAddress(env('TREASURY', wallet.address));
const bal = await provider.getBalance(wallet.address);
console.log(`deployer ${wallet.address} on chain ${chainId}, balance ${Number(bal) / 1e18}`);
const startBlock = await provider.getBlockNumber();

const deploy = async (name, args) => {
  const f = new ContractFactory(ART[name].abi, ART[name].bytecode, wallet);
  const c = await f.deploy(...args); await c.waitForDeployment();
  console.log(`${name.padEnd(18)} ${await c.getAddress()}`); return c;
};
const send = async (label, p) => { const tx = await p; await tx.wait(); console.log(`${label.padEnd(18)} ${tx.hash}`); };

const wnative = env('WNATIVE') ? getAddress(env('WNATIVE')) : await (await deploy('WrappedNative', [env('NATIVE_NAME', 'Wrapped TAO'), env('NATIVE_SYMBOL', 'WTAO')])).getAddress();
const factory = await deploy('YuelongFactory', [treasury, '0x0000000000000000000000000000000000000000', parseUnits(env('LAUNCH_FEE', '0'), 18), wnative]);
const factoryAddr = await factory.getAddress();
const graduator = await (await deploy('PoolGraduator', [factoryAddr])).getAddress();
await send('setGraduator', factory.setGraduator(graduator));
const router = await (await deploy('YuelongRouter', [wnative])).getAddress();
await send('setStock native', factory.setStock(wnative, parseUnits(env('PHANTOM', '20'), 18), parseUnits(env('THRESHOLD', '50'), 18), true));

const pairs = [{ address: wnative, symbol: env('NATIVE_SYMBOL', 'WTAO').replace(/^W/, ''), decimals: 18, native: true }];
const pairsFile = process.argv[2];
const erc20 = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
for (const s of pairsFile ? JSON.parse(fs.readFileSync(pairsFile, 'utf8')) : []) {
  const t = new Contract(s.address, erc20, provider);
  const dec = Number(await t.decimals());
  await send(`setStock ${s.symbol}`, factory.setStock(s.address, parseUnits(String(s.phantom), dec), parseUnits(String(s.threshold), dec), true));
  pairs.push({ address: getAddress(s.address), symbol: s.symbol, decimals: dec, native: false });
}

const out = { chainId, factory: factoryAddr, router, wnative, graduator, treasury, startBlock, pairs, deployer: wallet.address, at: new Date().toISOString() };
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const outFile = path.join(ROOT, 'out', `deployment.${chainId}.json`);
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log('\nwritten', outFile, '\n' + JSON.stringify(out, null, 2));
