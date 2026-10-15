/* Checks the server's staking layer (evm.js) against the real KuaiStaking bytecode:
   deploys it in an in-process EVM, serves eth_call over a tiny JSON-RPC endpoint,
   then reads /api/stake data with stakeInfo() and executes the calls stakeCalls()
   builds (approve + stake, unstake, claim). `node contracts/test/stake-server.js` */
'use strict';
const path = require('path'); const fs = require('fs'); const http = require('http');
const solc = require('solc'); const { ethers } = require('ethers');
const { VM } = require('@ethereumjs/vm'); const { Address, Account, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { Block } = require('@ethereumjs/block'); const { Common, Chain, Hardfork } = require('@ethereumjs/common');
const files = [path.join(__dirname, '..', 'KuaiLaunch.sol'), path.join(__dirname, 'Mocks.sol')]; const sources = {}; for (const f of files) sources[path.basename(f)] = { content: fs.readFileSync(f, 'utf8') };
const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { viaIR: true, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
const C = {}; for (const f of Object.values(out.contracts)) for (const [n, v] of Object.entries(f)) C[n] = { bytecode: '0x' + v.evm.bytecode.object, iface: new ethers.Interface(v.abi) };
const E18 = 10n ** 18n; let passed = 0, failed = 0; const ok = (c, m) => { if (c) { passed++; console.log('  ok  ' + m); } else { failed++; console.log('  FAIL ' + m); } };
(async () => {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun }); const vm = await VM.create({ common }); let now = 1_800_000_000n;
  const block = () => Block.fromBlockData({ header: { timestamp: now, gasLimit: 30_000_000n, baseFeePerGas: 0n, number: 100n } }, { common });
  const DEP = Address.fromString('0x' + '11'.repeat(20)), ALICE = Address.fromString('0x' + '22'.repeat(20));
  for (const a of [DEP, ALICE]) await vm.stateManager.putAccount(a, Account.fromAccountData({ balance: 1000n * E18, nonce: 0n }));
  const run = async (from, to, data, value = 0n) => { const r = await vm.evm.runCall({ caller: from, origin: from, to, data: hexToBytes(data), value, gasLimit: 20_000_000n, block: block() }); if (r.execResult.exceptionError) throw new Error('revert ' + (to ? to.toString() : 'deploy')); return r; };
  const deploy = async (name, args = []) => (await run(DEP, undefined, C[name].bytecode + (args.length ? C[name].iface.encodeDeploy(args).slice(2) : ''))).createdAddress;
  const router = await deploy('MockRouter'); const WBNB = '0x' + 'bb'.repeat(20);
  const staking = await deploy('KuaiStaking', [router.toString(), WBNB]); const kuai = await deploy('MockStock');
  await run(DEP, kuai, C.MockStock.iface.encodeFunctionData('mint', [ALICE.toString(), 500n * E18]));
  await run(DEP, staking, C.KuaiStaking.iface.encodeFunctionData('setStakeToken', [kuai.toString()]));
  // JSON-RPC over the VM: enough for ethers reads
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => b += c); req.on('end', async () => { const reqs = JSON.parse(b); const one = async (r) => { try {
      if (r.method === 'eth_chainId') return { jsonrpc: '2.0', id: r.id, result: '0x61' };
      if (r.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: r.id, result: '0x64' };
      if (r.method === 'eth_getBalance') return { jsonrpc: '2.0', id: r.id, result: '0x' + ((await vm.stateManager.getAccount(Address.fromString(r.params[0])))?.balance ?? 0n).toString(16) };
      if (r.method === 'eth_call') { const p = r.params[0]; const x = await vm.evm.runCall({ caller: Address.fromString(p.from || '0x' + '00'.repeat(20)), to: Address.fromString(p.to), data: hexToBytes(p.data || p.input), gasLimit: 20_000_000n, block: block() }); if (x.execResult.exceptionError) return { jsonrpc: '2.0', id: r.id, error: { code: 3, message: 'execution reverted', data: bytesToHex(x.execResult.returnValue) } }; return { jsonrpc: '2.0', id: r.id, result: bytesToHex(x.execResult.returnValue) }; }
      return { jsonrpc: '2.0', id: r.id, error: { code: -32601, message: 'unsupported ' + r.method } }; } catch (e) { return { jsonrpc: '2.0', id: r.id, error: { code: -32000, message: e.message } }; } };
    const result = Array.isArray(reqs) ? await Promise.all(reqs.map(one)) : await one(reqs); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result)); }); });
  await new Promise((r) => srv.listen(0, r)); process.env.BSC_TESTNET_RPC = `http://127.0.0.1:${srv.address().port}`; process.env.STAKING_97 = staking.toString();
  const evm = require('../../evm'); const store = {}; const me = ALICE.toString(); const exec = async (calls) => { for (const c of calls) await run(ALICE, Address.fromString(c.to), c.data, BigInt(c.value || '0')); };
  let info = await evm.stakeInfo('97', store, me);
  ok(info.deployed && info.token.toLowerCase() === kuai.toString().toLowerCase() && info.tokenSymbol === 'MCDx' && info.you.balance === String(500n * E18), 'stakeInfo reads the contract, the house coin and the wallet balance');
  await exec(evm.stakeCalls('stake', '97', store, info, 200n * E18));
  info = await evm.stakeInfo('97', store, me); // cache: summary is cached for 15 s, the wallet part is fresh
  ok(info.you.staked === String(200n * E18) && info.you.balance === String(300n * E18), 'approve + stake calls built by the server stake 200 tokens');
  await run(DEP, staking, '0x', E18);               // a 1 BNB fee arrives
  info = await evm.stakeInfo('97', store, me);
  ok(info.you.pending === String(E18 * 7n / 10n), 'pending shows 70% of a new fee before it is synced');
  const b0 = (await vm.stateManager.getAccount(ALICE)).balance; await exec(evm.stakeCalls('claim', '97', store, info, 0n)); const b1 = (await vm.stateManager.getAccount(ALICE)).balance;
  ok(b1 - b0 === E18 * 7n / 10n, 'claim call pays 0.7 BNB');
  await exec(evm.stakeCalls('unstake', '97', store, info, 200n * E18)); info = await evm.stakeInfo('97', store, me);
  ok(info.you.staked === '0' && info.you.balance === String(500n * E18), 'unstake call returns the tokens');
  let threw = false; try { evm.stakeCalls('stake', '97', store, { ...info, token: null }, E18); } catch { threw = true; } ok(threw, 'stake is refused before the house coin is set');
  srv.close(); console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
