#!/usr/bin/env node
/* ===========================================================================
   deploy.js — puts TestEURG and the Vault on a testnet, and prints the two
   lines you paste into config.js.

   No toolchain and no library: solc compiles the sources, sig.js signs the
   transactions (the same keccak and secp256k1 the page uses to check a
   signature), and everything else is JSON-RPC over fetch.

     RPC=https://sepolia.base.org \
     KEY=0x<private key with some testnet ether> \
     node scripts/deploy.js

   Options:
     --buildings <euros>   the vault's opening carrying value (default 0)
     --dry                 compile and price it, send nothing

   THE KEY. Use a throwaway key that holds nothing but testnet ether. It is
   read from the environment, never written to disk, never logged, and never
   leaves this process except as a signature. A key that has ever touched real
   money does not belong in an environment variable.

   THE CHAIN. Deploy this where its tokens are known to be worthless:
   TestEURG lets anyone mint, and the Vault is not audited. The refusal
   below is deliberate — mainnet chain ids are turned away.
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

/* sig.js is written for a browser; it only wants somewhere to hang itself */
global.window = global.window || {};
require(path.join(root, 'sig.js'));
const SIG = global.window.PROPELLO_SIG;

const RPC = process.env.RPC;
const KEY = process.env.KEY;
const DRY = process.argv.includes('--dry');
const BUILDINGS = (() => {
  const i = process.argv.indexOf('--buildings');
  return i === -1 ? 0n : BigInt(String(process.argv[i + 1]).replace(/[^0-9]/g, '') || '0');
})();

/* chains where a mistake costs real money */
const MAINNETS = { 1: 'Ethereum', 10: 'Optimism', 56: 'BNB', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum', 43114: 'Avalanche' };

/* ------------------------------------------------------------------ rpc --- */
let rpcId = 0;
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })
  });
  if (!res.ok) throw new Error(method + ': http ' + res.status);
  const j = await res.json();
  if (j.error) throw new Error(method + ': ' + (j.error.message || JSON.stringify(j.error)));
  return j.result;
}

/* ------------------------------------------------------------------ rlp --- */
/* Ethereum's list encoding: a length prefix, then the bytes. */
function rlpLen(n, offset) {
  if (n < 56) return Buffer.from([offset + n]);
  const len = Buffer.from(n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, '0'), 'hex');
  return Buffer.concat([Buffer.from([offset + 55 + len.length]), len]);
}
function rlp(item) {
  if (Array.isArray(item)) {
    const body = Buffer.concat(item.map(rlp));
    return Buffer.concat([rlpLen(body.length, 0xc0), body]);
  }
  const b = Buffer.isBuffer(item) ? item : Buffer.from(item);
  if (b.length === 1 && b[0] < 0x80) return b;
  return Buffer.concat([rlpLen(b.length, 0x80), b]);
}
/* a quantity is big-endian with no leading zeros, and zero is empty */
function qty(v) {
  let h = BigInt(v).toString(16);
  if (h === '0') return Buffer.alloc(0);
  if (h.length % 2) h = '0' + h;
  return Buffer.from(h, 'hex');
}

/* ------------------------------------------------------- signing a tx ---- */
/* Legacy (type 0) with EIP-155 replay protection: every chain worth
   deploying to still accepts it, and it is nine fields instead of twelve. */
function signTx(tx, chainId, key) {
  const fields = [qty(tx.nonce), qty(tx.gasPrice), qty(tx.gas),
    tx.to ? Buffer.from(tx.to.slice(2), 'hex') : Buffer.alloc(0),
    qty(tx.value || 0), Buffer.from((tx.data || '0x').slice(2), 'hex')];
  const forSigning = rlp([...fields, qty(chainId), Buffer.alloc(0), Buffer.alloc(0)]);
  const hash = SIG.keccak256(new Uint8Array(forSigning));
  const sig = SIG._sign(hash, BigInt(key));                 /* 0x r(32) s(32) v(1) */
  const r = Buffer.from(sig.slice(2, 66), 'hex');
  const s = Buffer.from(sig.slice(66, 130), 'hex');
  const recovery = parseInt(sig.slice(130, 132), 16) - 27;
  const v = BigInt(chainId) * 2n + 35n + BigInt(recovery);
  /* the signature must recover to us, or the node will take the coins of
     whoever it does recover to */
  const signer = SIG.recover(hash, sig);
  return { raw: '0x' + rlp([...fields, qty(v), qty(BigInt('0x' + r.toString('hex'))), qty(BigInt('0x' + s.toString('hex')))]).toString('hex'), signer };
}

/* -------------------------------------------------------------- compile -- */
function compile() {
  const solc = require(path.join(root, 'node_modules', 'solc'));
  const dir = path.join(root, 'contracts');
  const sources = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sol')))
    sources[f] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources,
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
  })));
  const errs = (out.errors || []).filter(e => e.severity === 'error');
  if (errs.length) { errs.forEach(e => console.error(e.formattedMessage)); process.exit(1); }
  const find = name => {
    for (const f in out.contracts) if (out.contracts[f][name]) return out.contracts[f][name];
    throw new Error('no contract named ' + name);
  };
  return { TestEURG: find('TestEURG'), Vault: find('Vault'), RollRegistry: find('RollRegistry') };
}

/* --------------------------------------------------------------- deploy -- */
const pad = v => BigInt(v).toString(16).padStart(64, '0');

async function main() {
  if (!RPC) { console.error('set RPC to a node url'); process.exit(2); }
  if (!DRY && !/^0x[0-9a-fA-F]{64}$/.test(KEY || '')) { console.error('set KEY to a 32-byte hex private key (or pass --dry)'); process.exit(2); }

  const built = compile();
  console.log('compiled  TestEURG ' + built.TestEURG.evm.bytecode.object.length / 2 + 'B · Vault ' + built.Vault.evm.bytecode.object.length / 2 + 'B');

  const chainId = Number(await rpc('eth_chainId', []));
  if (MAINNETS[chainId]) {
    console.error('\nrefusing: chain ' + chainId + ' is ' + MAINNETS[chainId] + ', where these tokens would not be worthless.');
    console.error('TestEURG lets anyone mint and the Vault is not audited. Use a testnet.');
    process.exit(1);
  }
  console.log('chain     ' + chainId);

  if (DRY) { console.log('\n--dry: nothing sent.'); return; }

  const me = SIG._addressOf(SIG._mul(SIG._G, BigInt(KEY)));
  const balance = BigInt(await rpc('eth_getBalance', [me, 'latest']));
  console.log('deployer  ' + me + '  (' + (Number(balance) / 1e18).toFixed(5) + ' ether)');
  if (balance === 0n) { console.error('\nthat account has no testnet ether — fund it from a faucet first.'); process.exit(1); }

  let nonce = Number(await rpc('eth_getTransactionCount', [me, 'pending']));
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));

  async function send(label, data) {
    const tx = { nonce, gasPrice, gas: 0, to: null, value: 0, data };
    const gas = BigInt(await rpc('eth_estimateGas', [{ from: me, data }]));
    tx.gas = gas + gas / 5n;                                   /* a fifth of headroom */
    const { raw, signer } = signTx(tx, chainId, KEY);
    if (signer.toLowerCase() !== me.toLowerCase()) throw new Error('the signature does not recover to the deployer — refusing to send');
    const hash = await rpc('eth_sendRawTransaction', [raw]);
    process.stdout.write(label + '  ' + hash + ' …');
    for (let i = 0; i < 90; i++) {
      const r = await rpc('eth_getTransactionReceipt', [hash]);
      if (r) {
        if (BigInt(r.status) !== 1n) throw new Error(label + ' reverted');
        console.log(' ' + r.contractAddress);
        nonce++;
        return r.contractAddress;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(label + ': no receipt after three minutes');
  }

  const eurg = await send('TestEURG', '0x' + built.TestEURG.evm.bytecode.object);
  /* Vault(asset, operator, buildingsAtCost) — six decimals, like the token */
  const args = pad(BigInt(eurg)) + pad(BigInt(me)) + pad(BUILDINGS * 1000000n);
  const vault = await send('Vault   ', '0x' + built.Vault.evm.bytecode.object + args);
  const registry = '0x' + (await rpc('eth_call', [{ to: vault, data: '0x7b103999' }, 'latest'])).slice(-40);

  fs.writeFileSync(path.join(root, 'contracts', 'deployed.' + chainId + '.json'),
    JSON.stringify({ chainId, asset: eurg, vault, registry, operator: me, deployedAt: new Date().toISOString() }, null, 2) + '\n');

  console.log('\npaste into config.js:\n');
  console.log('  asset:    \'' + eurg + '\',');
  console.log('  vault:    \'' + vault + '\',');
  console.log('  registry: \'' + registry + '\',');
  console.log('\nthe operator (the only account that can close a month) is ' + me);
}

/* required as a module, the pieces above are testable on their own */
module.exports = { rlp, qty, signTx, compile };
if (require.main === module) main().catch(e => { console.error('\n' + e.message); process.exit(1); });
