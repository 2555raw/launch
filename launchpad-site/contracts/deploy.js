/* Deploys BentoFactory to BNB Chain.
 *
 *   PRIVATE_KEY=0x... node contracts/deploy.js testnet
 *   PRIVATE_KEY=0x... node contracts/deploy.js mainnet
 *
 * Needs the compiled artifacts in contracts/build (run `node contracts/compile.js`
 * first) and a funded deployer key (tBNB from the BNB testnet faucet for testnet).
 * Prints the factory address: paste it into NETWORKS[...].factory in dapp/index.html.
 * The deployer address receives the 1% platform fee (feeTo). */
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
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'BentoFactory.json'), 'utf8'));
  const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const feeTo = process.env.FEE_TO || wallet.address;
  console.log(`deploying BentoFactory to ${which} from ${wallet.address} · feeTo ${feeTo} · router ${net.router}`);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const c = await factory.deploy(feeTo, net.router);
  console.log('tx', c.deploymentTransaction().hash);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`BentoFactory: ${addr}\n${net.explorer}/address/${addr}\n\nNow set NETWORKS[${net.chainId}].factory = '${addr}' in dapp/index.html`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
