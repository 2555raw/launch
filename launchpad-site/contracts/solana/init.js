#!/usr/bin/env node
/* One-time setup of the Sol Bite program on a cluster: creates the Config PDA
   with the admin (the signing keypair) and the fee destination.
   node init.js --cluster devnet --fee-to <wallet> [--keypair ~/.config/solana/id.json] [--program <id>] [--rpc <url>] */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const S = require('../../chain/solbite');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cluster = arg('--cluster', 'devnet');
const rpc = arg('--rpc', cluster === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com');
const programId = new PublicKey(arg('--program', fs.readFileSync(path.join(__dirname, 'program-id.txt'), 'utf8').trim()));
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(arg('--keypair', path.join(os.homedir(), '.config', 'solana', 'id.json')), 'utf8'))));
const feeTo = new PublicKey(arg('--fee-to', kp.publicKey.toBase58()));

(async () => {
  const cn = new Connection(rpc, 'confirmed');
  const [config] = S.configPda(programId);
  const cur = await cn.getAccountInfo(config);
  if (cur) { const c = S.decodeConfig(cur.data); console.log(`config already initialised on ${cluster}: admin ${c.admin}, fee to ${c.feeTo}`); if (c.admin !== kp.publicKey.toBase58()) return; if (c.feeTo === feeTo.toBase58()) return; const sig = await sendAndConfirmTransaction(cn, new Transaction().add(S.ixSetFeeTo(programId, kp.publicKey, feeTo)), [kp]); console.log(`fee destination set to ${feeTo.toBase58()} (${sig})`); return; }
  const sig = await sendAndConfirmTransaction(cn, new Transaction().add(S.ixInitConfig(programId, kp.publicKey, feeTo)), [kp]);
  console.log(`config initialised on ${cluster}: admin ${kp.publicKey.toBase58()}, fee to ${feeTo.toBase58()} (${sig})`);
})().catch((e) => { console.error(e.message); process.exit(1); });
