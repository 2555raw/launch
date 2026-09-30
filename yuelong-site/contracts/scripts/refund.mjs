// Sends what is left in the deployer wallet back to REFUND_TO, keeping only the gas for this
// transfer. Same RPC_URL / PRIVATE_KEY settings as deploy.mjs.
//   REFUND_TO=0x… node scripts/refund.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, getAddress, formatEther } from 'ethers';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dotenv = path.join(ROOT, '.env');
if (fs.existsSync(dotenv)) for (const line of fs.readFileSync(dotenv, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { RPC_URL, PRIVATE_KEY, REFUND_TO } = process.env;
if (!RPC_URL || !PRIVATE_KEY || !REFUND_TO) { console.error('Set RPC_URL, PRIVATE_KEY and REFUND_TO.'); process.exit(1); }
const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
const to = getAddress(REFUND_TO);
const [bal, fee] = await Promise.all([provider.getBalance(wallet.address), provider.getFeeData()]);
const gasPrice = fee.maxFeePerGas ?? fee.gasPrice;
const gas = 21000n;
const value = bal - gas * gasPrice * 2n;   // twice the gas price as headroom; the unused part stays behind
if (value <= 0n) { console.log(`nothing to refund (balance ${formatEther(bal)})`); process.exit(0); }
const tx = await wallet.sendTransaction({ to, value, gasLimit: gas, ...(fee.maxFeePerGas ? { maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas } : { gasPrice }) });
await tx.wait();
console.log(`sent ${formatEther(value)} to ${to}: ${tx.hash}`);
