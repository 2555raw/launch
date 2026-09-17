const fs = require('fs');
const vm = require('vm');
const ganache = require('ganache');
const { ethers } = require('ethers');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'contract.js'), 'utf8') + '\nglobalThis.__ART = HYDROPAD;', ctx);
const { Hydropad, HydropadToken } = ctx.__ART;

// ethers caches eth_getBalance briefly, which hides same-block changes: ask the node.
const balanceOf = async (provider, addr) => BigInt(await provider.send('eth_getBalance', [addr, 'latest']));

const eq = (a, b, msg) => { if (a !== b) { console.error('FAIL', msg, a, b); process.exitCode = 1; } else console.log('ok  ', msg); };
const E = ethers.parseEther;

(async () => {
  const gp = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3, defaultBalance: 100 }, chain: { hardfork: 'merge' } });
  const provider = new ethers.BrowserProvider(gp);
  const [a, b] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);

  const factory = new ethers.ContractFactory(Hydropad.abi, Hydropad.bytecode, a);
  const sw = await factory.deploy();
  await sw.waitForDeployment();
  console.log('launcher at', await sw.getAddress());

  // launch with a first buy of 0.5 ETH
  const supply = E('1000000000');
  const tx = await sw.launch('Raw Water', 'H2O', 'MEAD', supply, { value: E('0.5') });
  const rc = await tx.wait();
  const iface = new ethers.Interface(Hydropad.abi);
  const launched = rc.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(x => x && x.name === 'Launched');
  const token = launched.args.token;
  console.log('token at', token);

  const erc = new ethers.Contract(token, HydropadToken.abi, a);
  eq(await erc.symbol(), 'H2O', 'token symbol');
  eq(await erc.source(), 'MEAD', 'token records its source');
  eq(await erc.totalSupply(), supply, 'supply minted');

  let p = await sw.pairings(token);
  const creatorBal = await erc.balanceOf(await a.getAddress());
  console.log('   creator got', ethers.formatEther(creatorBal), 'tokens for 0.5 ETH');
  eq(creatorBal > 0n, true, 'launch buy delivered tokens');
  eq(p.raised, E('0.5') - E('0.5') * 300n / 10000n, 'raised is net of the 3% fee');
  eq(p.vault, E('0.5') * 300n / 10000n, 'vault took the fee');
  eq(p.ethReserve, E('1.2') + p.raised, 'eth reserve = virtual + raised');

  // price rises as the curve is bought
  const price1 = await sw.price(token);
  const swB = sw.connect(b);
  await (await swB.buy(token, 0, { value: E('1') })).wait();
  const price2 = await sw.price(token);
  eq(price2 > price1, true, 'price rises after a buy');
  const bBal = await erc.balanceOf(await b.getAddress());
  console.log('   second buyer got', ethers.formatEther(bBal), 'tokens for 1 ETH');
  eq(bBal < creatorBal * 2n, true, 'second buyer pays more per token than the first');

  // quote matches what a buy actually delivers
  const quoted = await sw.quoteBuy(token, E('0.25'));
  const before = await erc.balanceOf(await b.getAddress());
  await (await swB.buy(token, quoted, { value: E('0.25') })).wait();
  eq((await erc.balanceOf(await b.getAddress())) - before, quoted, 'quoteBuy matches the fill');

  // slippage guard
  try {
    await (await swB.buy(token, E('100000000000'), { value: E('0.1') })).wait();
    eq(true, false, 'slippage guard should revert');
  } catch { console.log('ok   slippage guard reverts'); }

  // sell round trip
  const ercB = erc.connect(b);
  const sellAmount = (await erc.balanceOf(await b.getAddress())) / 2n;
  await (await ercB.approve(await sw.getAddress(), sellAmount)).wait();
  const ethBefore = await balanceOf(provider, await b.getAddress());
  const sellRc = await (await swB.sell(token, sellAmount, 0)).wait();
  const ethAfter = await balanceOf(provider, await b.getAddress());
  const gas = sellRc.gasUsed * sellRc.gasPrice;
  eq(ethAfter + gas > ethBefore, true, 'seller received ETH');
  console.log('   sold for', ethers.formatEther(ethAfter - ethBefore + gas), 'ETH net');

  // vault: only the creator can claim, and it pays out
  try {
    await (await swB.claimVault(token)).wait();
    eq(true, false, 'non-creator claim should revert');
  } catch { console.log('ok   only the creator can claim the vault'); }
  p = await sw.pairings(token);
  const vaultBefore = p.vault;
  eq(vaultBefore > 0n, true, 'vault accrued fees');
  const cBefore = await balanceOf(provider, await a.getAddress());
  const cRc = await (await sw.claimVault(token)).wait();
  const cAfter = await balanceOf(provider, await a.getAddress());
  eq(cAfter + cRc.gasUsed * cRc.gasPrice - cBefore, vaultBefore, 'creator received the whole vault');
  eq((await sw.pairings(token)).vault, 0n, 'vault emptied');

  // graduation
  await (await swB.buy(token, 0, { value: E('5') })).wait();
  p = await sw.pairings(token);
  eq(p.graduated, true, 'graduates past the target');
  eq(p.raised >= E('4.2'), true, 'raised past target');

  // listing
  await (await sw.launch('Glacier Melt', 'MELT', 'GRN', supply)).wait();
  eq(await sw.pairingCount(), 2n, 'two pairings');
  const list = await sw.listPairings(0, 10);
  eq(list.length, 2, 'listPairings returns both');
  eq(list[0].source, 'GRN', 'newest first');

  // the launcher keeps every buyer whole: contract balance covers raised + vaults
  const bal = await balanceOf(provider, await sw.getAddress());
  const p0 = await sw.pairings(token);
  const p1 = await sw.pairings(list[0].token);
  eq(bal >= p0.raised + p0.vault + p1.raised + p1.vault, true, 'contract holds what it owes');

  await gp.disconnect();
  console.log(process.exitCode ? '\nFAILURES' : '\nall good');
})();
