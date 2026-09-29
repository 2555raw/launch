// Deploys NebariFactory and NebariRouter to the network in ../config.js.
//
//   PRIVATE_KEY=0x… TREASURY=0x… PROTOCOL_BPS=1000 node scripts/deploy.js [--write] [--rpc URL]
//
// --write pastes the new addresses into ../config.js. Nothing here ever prints the key.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const configPath = path.resolve(__dirname, '..', '..', 'config.js');
const cfgSrc = fs.readFileSync(configPath, 'utf8');
const cfg = (() => { const w = {}; new Function('window', cfgSrc)(w); return w.NEBARI_CONFIG; })();

const build = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.json'), 'utf8'));

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('Set PRIVATE_KEY to the deployer wallet (it needs a little ETH on ' + cfg.network.name + ').');
  const rpc = opt('--rpc', process.env.RPC || cfg.network.rpc);
  const provider = new ethers.JsonRpcProvider(rpc, { chainId: cfg.network.chainId, name: cfg.network.name }, { staticNetwork: true });
  const wallet = new ethers.Wallet(key, provider);
  const treasury = process.env.TREASURY || wallet.address;
  const protocolBps = BigInt(process.env.PROTOCOL_BPS || cfg.protocolBps || 0);
  const poolManager = process.env.POOL_MANAGER || cfg.poolManager;

  const net = await provider.getNetwork();
  if (Number(net.chainId) !== cfg.network.chainId) throw new Error(`RPC is chain ${net.chainId}, config expects ${cfg.network.chainId}`);
  const pmCode = await provider.getCode(poolManager);
  if (pmCode === '0x') throw new Error('No contract at the PoolManager address ' + poolManager + '. Check config.js against the Uniswap deployments page.');

  const bal = await provider.getBalance(wallet.address);
  console.log('network   ', cfg.network.name, Number(net.chainId));
  console.log('deployer  ', wallet.address, ethers.formatEther(bal), 'ETH');
  console.log('treasury  ', treasury);
  console.log('protocol  ', protocolBps.toString(), 'bps');
  console.log('poolMgr   ', poolManager);
  if (bal === 0n) throw new Error('Deployer has no ETH for gas.');

  const F = build('NebariFactory'), R = build('NebariRouter');
  console.log('\ndeploying NebariFactory…');
  const factory = await new ethers.ContractFactory(F.abi, F.bytecode, wallet).deploy(poolManager, treasury, protocolBps);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log('factory   ', factoryAddr);
  console.log('deploying NebariRouter…');
  const router = await new ethers.ContractFactory(R.abi, R.bytecode, wallet).deploy(poolManager);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log('router    ', routerAddr);
  const block = await provider.getBlockNumber();

  console.log(`\nexplorer  ${cfg.network.explorer}/address/${factoryAddr}`);
  if (flag('--write')) {
    let out = cfgSrc
      .replace(/factory:\s*'[^']*'/, `factory: '${factoryAddr}'`)
      .replace(/router:\s*'[^']*'/, `router: '${routerAddr}'`)
      .replace(/deployBlock:\s*\d+/, `deployBlock: ${block}`)
      .replace(/protocolBps:\s*\d+/, `protocolBps: ${protocolBps}`);
    fs.writeFileSync(configPath, out);
    console.log('wrote', configPath);
  } else {
    console.log('\nPaste into config.js:\n  factory: \'' + factoryAddr + '\',\n  router: \'' + routerAddr + '\',\n  deployBlock: ' + block + ',');
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
