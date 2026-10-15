/* Deploys KuaiFactory to BNB Chain and registers the restaurant pairs.
 *
 *   PRIVATE_KEY=0x... node contracts/deploy.js testnet
 *   PRIVATE_KEY=0x... node contracts/deploy.js mainnet
 *
 * mainnet: registers every pair in contracts/pairs.json (restaurant => tokenized
 *          stock on BNB Chain), so raises are paid in that stock token.
 * testnet: the stock tokens do not exist there, so every restaurant is registered
 *          with address(0): raises are paid in tBNB and graduate to COIN/tBNB. To
 *          test the stock-token path, deploy any test ERC20 and register it with
 *          STOCK_TEST=0x... (it is then used for every restaurant).
 *
 * Needs contracts/build (run `npm run compile`) and a funded deployer key. The
 * deployer receives the 1 % platform fee (feeTo) unless FEE_TO is set, and owns
 * the factory registry. Prints the factory address: paste it into
 * NETWORKS[...].factory in dapp/index.html. */
'use strict';
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const NETS = {
  testnet: { rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545', chainId: 97, router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', explorer: 'https://testnet.bscscan.com' },
  mainnet: { rpc: 'https://bsc-dataseed.binance.org', chainId: 56, router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', explorer: 'https://bscscan.com' }
};

(async () => {
  const which = process.argv[2] || 'testnet';
  const net = NETS[which];
  if (!net) throw new Error('network: testnet | mainnet');
  if (!process.env.PRIVATE_KEY) throw new Error('set PRIVATE_KEY');
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'KuaiFactory.json'), 'utf8'));
  const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json'), 'utf8'));
  delete pairs._note;
  const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const feeTo = process.env.FEE_TO || wallet.address;
  console.log(`deploying KuaiFactory to ${which} from ${wallet.address} · feeTo ${feeTo} · router ${net.router}`);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const c = await factory.deploy(feeTo, net.router);
  console.log('tx', c.deploymentTransaction().hash);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`KuaiFactory: ${addr}\n${net.explorer}/address/${addr}`);

  const ids = Object.keys(pairs);
  const stocks = ids.map((id) => which === 'mainnet' ? pairs[id].address : (process.env.STOCK_TEST || ethers.ZeroAddress));
  console.log(`registering ${ids.length} restaurants (${which === 'mainnet' ? 'tokenized stocks' : (process.env.STOCK_TEST ? 'STOCK_TEST' : 'paid in tBNB')})…`);
  const tx = await c.setStocks(ids, stocks);
  await tx.wait();
  console.log(`registered. Now set NETWORKS[${net.chainId}].factory = '${addr}' in dapp/index.html`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
