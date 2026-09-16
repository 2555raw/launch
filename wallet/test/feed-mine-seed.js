/* Puts the launches feed-mine.js reads onto a local chain.
 *
 * The stand-in factory has to answer at the real Pons address, because that
 * address is written into feed.js and is the whole point of not mocking the
 * reader. So it is deployed wherever the chain puts it and its runtime code is
 * then copied to that address with hardhat_setCode.
 *
 * Three groups go on, in this order:
 *   Ward Sentinel   launched from Ward, salt begins "WARD"
 *   Rando Coin      somebody else's, random salt
 *   Filler NN       enough of somebody else's to bury the first one
 *
 * The filler is the part worth explaining. The Ward tab used to fetch a fixed
 * pile of recent launches and sieve it afterwards, so a Ward coin with enough
 * strangers stacked on top of it fell off the bottom of the pile and the tab
 * read empty. Burying it here is what makes that a test failure rather than a
 * thing someone notices on the live site.
 *
 *   npx hardhat node --port 8545          (chainId 4663)
 *   node test/feed-mine-mock.js           (compiles the stand-in)
 *   node test/feed-mine-seed.js
 */
const { ethers } = require('ethers');
const j = require(process.env.PONS_MOCK || './feed-mine.json');

const A = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
const FILL = Number(process.env.FILL || 110);

const rnd = () => '0x' + require('crypto').randomBytes(32).toString('hex');
const ward = () => '0x57415244' + require('crypto').randomBytes(28).toString('hex');
const P = (n, sy, d, salt) => ({
  name: n, symbol: sy, logo: '', description: d,
  socials: { twitter: '', telegram: '', discord: '', website: '', farcaster: '' },
  creatorFeeRecipient: '0x' + '11'.repeat(20), creatorTaxBps: 0, buybackEnabled: false,
  expectedEconomics: '0x' + '0'.repeat(64), salt
});

(async () => {
  const p = new ethers.JsonRpcProvider(RPC);
  const me = new ethers.Wallet(KEY, p);

  const f = await new ethers.ContractFactory(j.fac.abi, j.fac.evm.bytecode.object, me).deploy();
  await f.waitForDeployment();
  const code = await p.getCode(await f.getAddress());
  await p.send('hardhat_setCode', [A, code]);
  console.log('stand-in serving at', A);

  const c = new ethers.Contract(A, j.fac.abi, me);

  /* The nonce is counted here rather than looked up per transaction. Dozens of
     launches go out back to back and the library asks the node for the count
     each time, but that answer is cached for the block it was asked in, so two
     transactions in a row are handed the same number and the seeding stops
     halfway with the chain in a state no test can read. */
  let nonce = await p.getTransactionCount(me.address, 'latest');
  const ZERO = '0x' + '00'.repeat(20);
  const go = async (n, sy, d, salt) =>
    (await (await c.launchToken(P(n, sy, d, salt), 1, ZERO, { nonce: nonce++ })).wait());

  await go('Ward Sentinel', 'WSNT', 'Lanzada desde Ward.', ward());
  await go('Rando Coin', 'RND', 'Lanzada por otra persona.', rnd());
  for (let i = 0; i < FILL; i++) await go('Filler ' + i, 'FIL' + i, 'Ruido.', rnd());
  console.log('launches on chain: 1 from Ward, ' + (FILL + 1) + ' from others');
  console.log('head block', await p.getBlockNumber());
})().catch(e => { console.error(e.message || e); process.exit(1); });
