/* The three things this game needs from Ethereum.

   One: proof that whoever typed an address holds its key. A marble can win
   money, so entering someone else's wallet has to be impossible. The browser
   signs one sentence with personal_sign (EIP-191) and ethers recovers the
   address that signed it; if it is the address that was claimed, the wallet is
   theirs.

   Two: how much a round is worth. Creator fees land in one wallet, in ETH. Its
   balance when a round opens and again when it closes, and the difference is
   what those minutes earned - shown in dollars at the ETH price of the moment,
   which comes from the Chainlink ETH/USD feed over the same RPC, so there is
   no second service to depend on. Set FEE_WALLET to turn it on.

   Three: how many of the coin a wallet holds, when MIN_TOKENS asks for it.

   No key ever reaches this file and it never sends a transaction: it reads,
   and it checks signatures. */

'use strict';

const { ethers } = require('ethers');

const RPC = process.env.ETH_RPC || 'https://cloudflare-eth.com';
/* Chainlink ETH/USD on Ethereum mainnet. Set ETH_USD_FEED for another chain
   (Base: 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70), or ETH_USD for a fixed
   price with no feed at all. */
const FEED = process.env.ETH_USD_FEED || '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const FIXED_PRICE = Number(process.env.ETH_USD) || 0;

const FEED_ABI = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
                  'function decimals() view returns (uint8)'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)',
                   'function decimals() view returns (uint8)'];

let provider = null;
function rpc() {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true, batchMaxCount: 1 });
  return provider;
}

/** The address in its checksummed form, or null if it is not one. */
function normalize(address) {
  try { return ethers.getAddress(String(address)); } catch { return null; }
}

const isAddress = (a) => normalize(a) !== null;

/** True when `signature` really is `message` signed by `address`. */
function verifySignature(address, message, signature) {
  try {
    const want = normalize(address);
    if (!want || typeof signature !== 'string') return false;
    return ethers.verifyMessage(message, signature) === want;
  } catch {
    return false;
  }
}

/* One call at a time with a short patience: the public RPCs are rate limited
   and a hung request must never stall a round. */
function withTimeout(promise, ms) {
  let timer;
  const clock = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('rpc timeout')), ms); });
  return Promise.race([promise, clock]).finally(() => clearTimeout(timer));
}

/** Wei held by an address, as a bigint, or null when the call did not come back. */
async function balance(address) {
  try {
    return await withTimeout(rpc().getBalance(address), 8000);
  } catch (err) {
    console.error('[chain] getBalance:', err.message);
    return null;
  }
}

/* The price is read at most once a minute; a round asks for it a few times and
   the feed itself only moves every so often. */
let priceCache = { at: 0, usd: 0 };
async function ethUsd() {
  if (FIXED_PRICE > 0) return FIXED_PRICE;
  if (Date.now() - priceCache.at < 60000 && priceCache.usd > 0) return priceCache.usd;
  try {
    const feed = new ethers.Contract(FEED, FEED_ABI, rpc());
    const [decimals, round] = await withTimeout(Promise.all([feed.decimals(), feed.latestRoundData()]), 8000);
    const usd = Number(round[1]) / 10 ** Number(decimals);
    if (usd > 0) priceCache = { at: Date.now(), usd };
    return usd > 0 ? usd : priceCache.usd || 0;
  } catch (err) {
    console.error('[chain] price feed:', err.message);
    return priceCache.usd || 0;
  }
}

/** Dollars for an amount of wei at the current price, to the cent. */
async function weiToUsd(wei) {
  const price = await ethUsd();
  if (!price) return null;
  const eth = Number(ethers.formatEther(wei));
  return Math.round(eth * price * 100) / 100;
}

/** How much of one ERC-20 an owner holds, in whole tokens. */
async function tokenBalance(owner, token) {
  try {
    const c = new ethers.Contract(token, ERC20_ABI, rpc());
    const [raw, decimals] = await withTimeout(Promise.all([c.balanceOf(owner), c.decimals()]), 8000);
    return Number(ethers.formatUnits(raw, decimals));
  } catch (err) {
    console.error('[chain] balanceOf:', err.message);
    return 0;
  }
}

const toEth = (wei) => Math.round(Number(ethers.formatEther(wei)) * 1e6) / 1e6;

module.exports = { normalize, isAddress, verifySignature, balance, ethUsd, weiToUsd, tokenBalance, toEth, RPC, FEED };
