/* BentoFactory from the server: where it is deployed, and deploying it.
 *
 * The page asks GET /api/config for the factory address per chain, the default
 * chain and the social links, so nothing has to be rebuilt when the factory
 * moves. Addresses come from the store (a deployment made from /admin) or from
 * FACTORY_56 / FACTORY_97 in the environment.
 *
 * Deploying needs DEPLOYER_KEY (a funded key; on testnet any key with a little
 * tBNB from the faucet) and contracts/build (committed). The admin page shows
 * the deployer address and its balance per chain and has a Deploy button:
 * it deploys BentoFactory, registers every restaurant from contracts/pairs.json
 * (the tokenized stock on mainnet, tBNB on testnet) and stores the address. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const NETS = {
  97: { key: 'testnet', chainId: 97, rpc: process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com', router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', explorer: 'https://testnet.bscscan.com', symbol: 'tBNB' },
  56: { key: 'mainnet', chainId: 56, rpc: process.env.BSC_RPC || 'https://bsc-dataseed.binance.org', router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', explorer: 'https://bscscan.com', symbol: 'BNB' }
};
const KEY = (process.env.DEPLOYER_KEY || '').trim();
const X_URL = (process.env.X_URL || '').trim();

function deployer() { if (!/^0x[0-9a-fA-F]{64}$/.test(KEY)) return null; try { return new ethers.Wallet(KEY); } catch { return null; } }

function factories(store) {
  const out = {};
  for (const c of Object.keys(NETS)) {
    const env = (process.env['FACTORY_' + c] || '').trim();
    const st = store.factories && store.factories[c] && store.factories[c].address;
    const a = st || env;
    if (a && ethers.isAddress(a)) out[c] = ethers.getAddress(a);
  }
  return out;
}

function config(store) {
  const f = factories(store);
  const def = Number(process.env.DEFAULT_CHAIN) || (f[56] ? 56 : f[97] ? 97 : 56);
  return { paths: true, factories: f, defaultChain: def, social: X_URL ? { x: X_URL } : {}, deployed: store.factories || {} };
}

async function status(store) {
  const w = deployer();
  const chains = {};
  await Promise.all(Object.values(NETS).map(async (n) => {
    const row = { key: n.key, factory: factories(store)[n.chainId] || null, explorer: n.explorer, symbol: n.symbol, balance: null, record: (store.factories || {})[n.chainId] || null };
    if (w) { try { const p = new ethers.JsonRpcProvider(n.rpc, n.chainId, { staticNetwork: true }); row.balance = ethers.formatEther(await p.getBalance(w.address)); } catch (e) { row.balanceError = e.message; } }
    chains[n.chainId] = row;
  }));
  return { deployer: w ? w.address : null, chains, busy: Boolean(busy) };
}

let busy = null;
async function deploy(chainId, store, save) {
  const n = NETS[chainId]; if (!n) throw new Error('chain must be 56 or 97');
  const w = deployer(); if (!w) throw new Error('DEPLOYER_KEY is not set or not a private key');
  if (busy) throw new Error('a deployment is already running');
  busy = chainId;
  try {
    const art = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'build', 'BentoFactory.json'), 'utf8'));
    const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'pairs.json'), 'utf8')); delete pairs._note;
    const provider = new ethers.JsonRpcProvider(n.rpc, n.chainId, { staticNetwork: true });
    const wallet = w.connect(provider);
    const bal = await provider.getBalance(wallet.address);
    if (bal < ethers.parseEther('0.02')) throw new Error(`deployer ${wallet.address} has ${ethers.formatEther(bal)} ${n.symbol}; it needs about 0.05 ${n.symbol} for the deployment`);
    const feeTo = (process.env.FEE_TO && ethers.isAddress(process.env.FEE_TO)) ? process.env.FEE_TO : wallet.address;
    const cf = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
    const c = await cf.deploy(feeTo, n.router);
    const tx = c.deploymentTransaction().hash;
    await c.waitForDeployment();
    const address = await c.getAddress();
    const ids = Object.keys(pairs);
    const stocks = ids.map((id) => chainId === 56 ? pairs[id].address : (process.env.STOCK_TEST || ethers.ZeroAddress));
    const reg = await c.setStocks(ids, stocks); await reg.wait();
    store.factories ||= {};
    store.factories[chainId] = { address, tx, feeTo, deployer: wallet.address, at: Date.now(), registered: ids.length, stocks: chainId === 56 ? 'tokenized' : (process.env.STOCK_TEST ? 'STOCK_TEST' : 'tBNB') };
    await save();
    return store.factories[chainId];
  } finally { busy = null; }
}

module.exports = { NETS, config, status, deploy, factories };
