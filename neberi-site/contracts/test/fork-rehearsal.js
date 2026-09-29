// Dress rehearsal on a local fork of Robinhood Chain mainnet (hardhat.fork.config.js on :8546):
// deploys the factory and router against the real Uniswap v4 PoolManager, then launches, trades,
// collects and claims against native ETH and against the real TSLA stock token.
const fs = require('fs'); const path = require('path');
const { ethers } = require('ethers');
const w = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'))(w); const C = w.NEBARI_CONFIG;
const build = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.json'), 'utf8'));
const RPC = process.env.FORK || 'http://127.0.0.1:8546';
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ok  ', m); } else { failed++; console.log('  FAIL', m); } };
const ZERO = ethers.ZeroAddress;

(async () => {
  const p = new ethers.JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
  const [deployer, creator, buyer, treasury] = await Promise.all([0, 1, 2, 3].map((i) => p.getSigner(i)));
  const dep = async (n, ...a) => { const b = build(n); const c = await new ethers.ContractFactory(b.abi, b.bytecode, deployer).deploy(...a); await c.waitForDeployment(); return c; };
  console.log('fork block', await p.getBlockNumber(), 'chain', (await p.getNetwork()).chainId.toString());
  const factory = await dep('NebariFactory', C.poolManager, treasury.address, 1000n);
  const router = await dep('NebariRouter', C.poolManager);
  ok(true, 'factory and router deployed against the real PoolManager');
  const tokAbi = build('NebariToken').abi;
  const erc = new ethers.Interface(['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)', 'event Transfer(address indexed from, address indexed to, uint256 value)']);

  async function round(label, pairAddr, startPrice, amountIn, fund) {
    console.log(`\n${label}`);
    const isEth = pairAddr === ZERO;
    const pair = isEth ? null : new ethers.Contract(pairAddr, erc, p);
    const bal = async (a) => isEth ? p.getBalance(a) : pair.balanceOf(a);
    const rc = await (await factory.connect(creator).launch(label + ' Test', label.slice(0, 3) + 'T', '', pairAddr, startPrice)).wait();
    const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'Launched');
    const token = new ethers.Contract(ev.args.token, tokAbi, p);
    ok(!!ev, `launched ${await token.symbol()} against ${label}`);
    const L = await factory.getLaunch(ev.args.token);
    const key = [L.key.currency0, L.key.currency1, L.key.fee, L.key.tickSpacing, L.key.hooks];
    const tokenIsZero = L.key.currency0.toLowerCase() === ev.args.token.toLowerCase();
    if (fund) await fund(buyer.address);
    if (!isEth) await (await pair.connect(buyer).approve(await router.getAddress(), ethers.MaxUint256)).wait();
    const q = await router.connect(buyer).quoteExactIn.staticCall(key, !tokenIsZero, amountIn);
    await (await router.connect(buyer).swapExactIn(key, !tokenIsZero, amountIn, q, buyer.address, { value: isEth ? amountIn : 0n })).wait();
    const got = await token.balanceOf(buyer.address);
    ok(got === q && got > 0n, `buy: ${ethers.formatEther(got)} tokens`);
    await (await token.connect(buyer).approve(await router.getAddress(), ethers.MaxUint256)).wait();
    const b0 = await bal(buyer.address);
    await (await router.connect(buyer).swapExactIn(key, tokenIsZero, got / 3n, 0n, buyer.address)).wait();
    ok((await bal(buyer.address)) > b0 - (isEth ? ethers.parseEther('0.001') : 0n), `sell: ${label} came back to the seller`);
    const t0 = await bal(treasury.address), c0 = await bal(creator.address);
    const rc2 = await (await factory.collectFees(ev.args.token)).wait();
    const fe = rc2.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'FeesCollected');
    ok(fe && fe.args.pairAmount > 0n, `fees collected: ${ethers.formatEther(fe.args.pairAmount)} ${label}`);
    ok((await bal(treasury.address)) - t0 === fe.args.toProtocol, `treasury got its ${label} share`);
    ok((await bal(creator.address)) - c0 >= fe.args.toCreator - (isEth ? ethers.parseEther('0.001') : 0n), `creator got its ${label} share`);
    const cl = await token.claimable(buyer.address);
    const b1 = await bal(buyer.address);
    const crc = await (await token.connect(buyer).claim()).wait();
    const gas = isEth ? crc.gasUsed * crc.gasPrice : 0n;
    ok(cl > 0n && (await bal(buyer.address)) - b1 + gas === cl, `holder claimed ${ethers.formatEther(cl)} ${label}`);
  }

  await round('ETH', ZERO, 1_000_000_000n, ethers.parseEther('0.01'));

  // TSLA: borrow a real holder's balance on the fork
  const tsla = C.quickPicks.find((q) => q.symbol === 'TSLA').address;
  const latest = await p.getBlockNumber();
  const logs = await p.getLogs({ address: tsla, topics: [ethers.id('Transfer(address,address,uint256)')], fromBlock: Math.max(0, latest - 200000), toBlock: latest });
  const T = new ethers.Contract(tsla, erc, p);
  let holder = null;
  for (const l of logs.reverse()) { const to = ethers.getAddress('0x' + l.topics[2].slice(26)); if (to !== ZERO && (await T.balanceOf(to)) >= ethers.parseEther('0.01')) { holder = to; break; } }
  console.log('\nTSLA holder on the fork:', holder, 'transfers seen', logs.length);
  if (!holder) { ok(false, 'found a TSLA holder to borrow from'); }
  else {
    await p.send('hardhat_impersonateAccount', [holder]);
    await p.send('hardhat_setBalance', [holder, '0x' + (10n ** 18n).toString(16)]);
    const h = new ethers.JsonRpcSigner(p, holder);
    const amt = (await T.balanceOf(holder)) / 4n;
    await round('TSLA', tsla, 1_000_000_000_000_000n, amt / 2n, async (to) => { await (await T.connect(h).transfer(to, amt)).wait(); });
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.shortMessage || e.message, e.info?.error?.message || ''); process.exit(2); });
