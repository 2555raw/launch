/* The board of tokens people launched through the site.

   A launch is a real Pons transaction on Robinhood Chain, so the board only
   lists what the chain confirms: the server fetches the receipt of the hash
   the browser reports and reads the TokenLaunched log the Pons V2 factory
   emitted. A hash that has no such log, or a log for another wallet, is
   refused. In demo mode (no chain) the report is taken as given so the
   screen can be exercised. */

'use strict';

const { ethers } = require('ethers');

const RPC = process.env.ROBINHOOD_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const FACTORY = (process.env.PONS_FACTORY || '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e').toLowerCase();
const TOPIC = ethers.id('TokenLaunched(address,address,address,address,uint256,uint256)');
let provider = null;

function rpc() {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true, batchMaxCount: 1 });
  return provider;
}

const topicAddress = (t) => ethers.getAddress('0x' + String(t).slice(-40));

/* The launch a transaction made, from its receipt: { token, curve, deployer }
   or an { error } that says why it is not one. */
async function verify(hash, deployer) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(hash || ''))) return { error: 'that is not a transaction hash' };
  let receipt;
  try {
    receipt = await Promise.race([rpc().getTransactionReceipt(hash), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))]);
  } catch (err) {
    return { error: 'could not reach Robinhood Chain to check the transaction; try again in a moment', retry: true };
  }
  if (!receipt) return { error: 'the chain has no such transaction yet; try again once it confirms', retry: true };
  if (receipt.status !== 1) return { error: 'that transaction reverted' };
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== FACTORY || log.topics[0] !== TOPIC || log.topics.length < 4) continue;
    const found = { token: topicAddress(log.topics[1]), curve: topicAddress(log.topics[2]), deployer: topicAddress(log.topics[3]) };
    if (found.deployer.toLowerCase() !== String(deployer).toLowerCase()) return { error: 'that launch was made by another wallet' };
    return found;
  }
  return { error: 'that transaction is not a Pons launch' };
}

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const url = (s) => { const v = clean(s, 300); return /^(https?:\/\/|ipfs:\/\/)/i.test(v) ? v : ''; };

/* The public record of a launch, from the browser's report and the chain's
   answer. */
function record(body, chain, deployer) {
  return {
    id: 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: Date.now(),
    token: chain.token, curve: chain.curve, deployer: chain.deployer || deployer,
    hash: String(body.hash),
    name: clean(body.name, 32) || 'Token',
    ticker: clean(body.ticker, 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TOKEN',
    desc: clean(body.desc, 200),
    image: url(body.image),
    twitter: url(body.twitter), telegram: url(body.telegram), website: url(body.website),
    color: /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? String(body.color).toLowerCase() : '#ff7a1a',
    face: clean(body.face, 12),
    buyHash: /^0x[0-9a-fA-F]{64}$/.test(String(body.buyHash || '')) ? String(body.buyHash) : '',
    buyWei: /^\d{1,30}$/.test(String(body.buyWei || '')) ? String(body.buyWei) : ''
  };
}

module.exports = { verify, record, RPC, FACTORY, TOPIC };
