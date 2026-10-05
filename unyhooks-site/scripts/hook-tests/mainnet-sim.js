/* Read-only check against Robinhood Chain mainnet: nothing is signed or sent.
   For each recipe: compile exactly as the browser does (solc 0.8.26 + the
   vendored V4 sources), build the CREATE2 deployment the builder would send,
   simulate it with eth_call through the real CREATE2 deployer (the hook's
   constructor runs against the real PoolManager), then simulate
   PoolManager.initialize on the real PoolManager with the hook's code put in
   place through a state override. */
const fs = require('fs');
const { ethers } = require('ethers');
const solc = require('solc');
const B = require('../../builder.js');
const deps = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../vendor/v4-sources.json'), 'utf8')).sources;

const MAIN = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', 4663, { staticNetwork: true });
const LOCAL = new ethers.JsonRpcProvider('http://localhost:8545', 4663, { staticNetwork: true });
const PM = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const PROXY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const PROXY_CODE = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3';
const coder = ethers.AbiCoder.defaultAbiCoder();
const pmIface = new ethers.Interface(['function initialize((address,address,uint24,int24,address),uint160) returns (int24)']);
let ok = 0, all = 0;
const check = (n, c, x = '') => { all++; if (c) ok++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };

(async () => {
  console.log('chain', (await MAIN.getNetwork()).chainId, 'block', await MAIN.getBlockNumber());
  await LOCAL.send('hardhat_setCode', [PROXY, PROXY_CODE]);
  const from = ethers.Wallet.createRandom().address;
  const R = ethers.Wallet.createRandom().address;
  const cases = [
    ['fee', { feePercent: 1, recipient: R }, 3000, 60, [ethers.ZeroAddress, USDG]],
    ['dynamic', {}, 0x800000, 60, [ethers.ZeroAddress, USDG]],
    ['launch', { token: USDG }, 3000, 60, [ethers.ZeroAddress, USDG]],
    ['hours', {}, 3000, 60, [ethers.ZeroAddress, USDG]]
  ];
  for (const [recipe, settings, fee, spacing, pair] of cases) {
    const h = B.generate(recipe, settings);
    const sources = { [h.file]: { content: h.source } };
    for (const [k, v] of Object.entries(deps)) sources[k] = { content: v };
    const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['evm.bytecode.object'] } } } })));
    const errs = (out.errors || []).filter((e) => e.severity === 'error');
    if (errs.length) { check(`${recipe}: compiles from the vendored sources`, false, errs[0].message); continue; }
    const bytecode = '0x' + out.contracts[h.file][h.contract].evm.bytecode.object;
    const init = ethers.concat([bytecode, coder.encode(['address', ...h.args.map((a) => a.type)], [PM, ...h.args.map((a) => a.value)])]);
    const initHash = ethers.keccak256(init);
    let salt, addr;
    for (let i = BigInt(Date.now()) << 20n; ; i++) {
      salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      addr = ethers.getCreate2Address(PROXY, salt, initHash);
      if ((BigInt(addr) & 0x3fffn) === BigInt(h.flags) && (await MAIN.getCode(addr)) === '0x') break;
    }
    const data = ethers.concat([salt, init]);
    const landed = await MAIN.call({ from, to: PROXY, data });
    check(`${recipe}: deployment simulates on mainnet`, landed.toLowerCase() === addr.toLowerCase(), addr);

    // Same deployment on the local chain gives the exact runtime code (immutables included).
    const signer = await LOCAL.getSigner(0);
    await (await signer.sendTransaction({ to: PROXY, data })).wait();
    const runtime = await LOCAL.getCode(addr);
    const key = [pair[0], pair[1], fee, spacing, addr];
    const sqrt = 79228162514264337593543950336n * 1000n; // any valid price
    try {
      const res = await MAIN.send('eth_call', [{ from, to: PM, data: pmIface.encodeFunctionData('initialize', [key, sqrt]) }, 'latest', { [addr]: { code: runtime } }]);
      const tick = pmIface.decodeFunctionResult('initialize', res)[0];
      check(`${recipe}: pool creation simulates on the real PoolManager`, true, `tick ${tick}`);
    } catch (e) {
      check(`${recipe}: pool creation simulates on the real PoolManager`, false, e.shortMessage || e.message);
    }
  }
  console.log(`\n${ok}/${all} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
