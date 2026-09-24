/* The chain layer, checked without a chain.
 *
 * This does not test a copy of the encoder — it loads chain.js exactly as the
 * page loads it, builds the creation code the pad would send, and deploys that
 * in a local EVM. If the constructor encoding is wrong in the shipped file, the
 * deploy fails or a field comes back wrong, here, instead of on Base with
 * somebody's gas.
 *
 * Needs @ethereumjs/evm and ethereum-cryptography, which are not dependencies
 * of the site:
 *   npm i --no-save @ethereumjs/evm @ethereumjs/util ethereum-cryptography
 *   node test/contract.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

/* ---------- load the real files into a fake window ---------- */
const root = path.join(__dirname, '..');
const sandbox = { window: {}, TextEncoder, TextDecoder, setTimeout, Date, console };
sandbox.window.TWISTR_CONFIG = { chain: { explorer: 'https://example.invalid' }, router: {}, liquidity: { slippageBps: 100, deadlineMinutes: 20 } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'contract', 'twistr-coin.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'chain.js'), 'utf8'), sandbox);
const chain = sandbox.window.TwistrChain;
const build = sandbox.window.TWISTR_COIN;

(async () => {
  console.log('\nselectors');
  let keccak256;
  try { ({ keccak256 } = require('ethereum-cryptography/keccak')); }
  catch (e) { console.log('  skipped: ethereum-cryptography is not installed'); }

  if (keccak256) {
    // every selector, recomputed from the signature written beside it in chain.js
    const src = fs.readFileSync(path.join(root, 'chain.js'), 'utf8');
    const lines = [...src.matchAll(/^\s*(\w+):\s*'(0x[0-9a-f]{8})',\s*\/\/\s*(.+?)\s*$/gm)];
    ok('every selector has its signature written down', lines.length >= 12, lines.length + ' found');
    lines.forEach(([, key, hex, sig]) => {
      const want = '0x' + Buffer.from(keccak256(Buffer.from(sig, 'utf8'))).toString('hex').slice(0, 8);
      ok('selector ' + key + ' matches ' + sig, hex === want, 'file says ' + hex + ', keccak says ' + want);
    });

    /* An event topic is a whole 32-byte keccak, not a 4-byte selector, so the
       sweep above does not reach it. It gets its own check because it is the
       entire basis of the public board: a wrong topic matches no log, finds
       nothing, and does so silently and forever — there is no error to notice.
       And it is checked against the SOLIDITY, not just against itself, so the
       two cannot drift if the event is ever changed. */
    const topics = [...src.matchAll(/^\s*(\w+):\s*'(0x[0-9a-f]{64})',\n\s*\/\/\s*(.+?)\s*$/gm)];
    ok('the event topic has its signature written down', topics.length === 1, topics.length + ' found');
    topics.forEach(([, key, hex, sig]) => {
      const want = '0x' + Buffer.from(keccak256(Buffer.from(sig, 'utf8'))).toString('hex');
      ok('topic ' + key + ' matches ' + sig, hex === want, 'file says ' + hex + ', keccak says ' + want);

      // the same signature, as the contract actually declares it
      const sol = fs.readFileSync(path.join(root, 'contract', 'TwistrCoin.sol'), 'utf8');
      const m = sol.match(/event\s+(\w+)\s*\(([^)]*)\)\s*;/g) || [];
      const declared = m.map((e) => {
        const name = e.match(/event\s+(\w+)/)[1];
        const args = e.slice(e.indexOf('(') + 1, e.lastIndexOf(')'))
          .split(',').map((a) => a.trim().split(/\s+/)[0]).filter(Boolean);
        return name + '(' + args.join(',') + ')';
      });
      ok('and the contract really declares that event', declared.includes(sig),
        declared.join(' / '));
    });
  }

  console.log('\ndeploying the real creation code');
  let evmMod, utilMod;
  try {
    evmMod = require('@ethereumjs/evm');
    utilMod = require('@ethereumjs/util');
  } catch (e) {
    console.log('  skipped: @ethereumjs/evm is not installed');
    console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
    process.exit(fails.length ? 1 : 0);
  }

  /* The library renamed both of these between majors — EVM.create became
     createEVM, and the Address constructor became createAddressFromString. The
     contract is what is under test here, not the harness, so take whichever
     one this machine happens to have rather than pinning a version. */
  const makeEvm = evmMod.createEVM || (evmMod.EVM && evmMod.EVM.create);
  if (!makeEvm) {
    console.log('  skipped: @ethereumjs/evm exposes no EVM factory this build knows');
    console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
    process.exit(fails.length ? 1 : 0);
  }
  const evm = await makeEvm();

  const callerHex = '00000000000000000000000000000000000000c0';
  const from = utilMod.createAddressFromString
    ? utilMod.createAddressFromString('0x' + callerHex)
    : new utilMod.Address(Buffer.from(callerHex, 'hex'));
  const bytes = (h) => Buffer.from(String(h).replace(/^0x/, ''), 'hex');

  const SUPPLY = 1000000n * 10n ** 18n;
  const coin = {
    name: 'Northwind Capital', ticker: 'NWND', supplyWei: SUPPLY,
    assetName: 'Amazon', assetTicker: 'AMZN', colour: 'Yellow', position: 'Left hand',
  };

  const creation = chain.creationCode(coin);
  ok('the creation code starts with the compiled bytecode', creation.startsWith(build.bytecode));

  const res = await evm.runCall({ caller: from, to: undefined, data: bytes(creation), gasLimit: 8000000n });
  ok('it deploys', !res.execResult.exceptionError,
    res.execResult.exceptionError && res.execResult.exceptionError.error);
  if (res.execResult.exceptionError) {
    console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
    process.exit(1);
  }
  const addr = res.createdAddress;

  const read = async (sel, args = '') => {
    const r = await evm.runCall({ caller: from, to: addr, data: bytes(sel + args), gasLimit: 2000000n });
    if (r.execResult.exceptionError) throw new Error(sel + ' reverted');
    return '0x' + Buffer.from(r.execResult.returnValue).toString('hex');
  };

  ok('name comes back', chain.decodeString(await read(chain.SEL.name)) === coin.name);
  ok('symbol comes back', chain.decodeString(await read(chain.SEL.symbol)) === coin.ticker);
  ok('total supply is exact', chain.decodeUint(await read(chain.SEL.totalSupply)) === SUPPLY);
  ok('decimals are 18', chain.decodeUint(await read(chain.SEL.decimals)) === 18n);
  ok('the whole supply is the creator’s',
    chain.decodeUint(await read(chain.SEL.balanceOf, callerHex.padStart(64, '0'))) === SUPPLY);

  // the draw, which is the only reason this contract is not a stock ERC-20
  ok('the paired asset is on chain', chain.decodeString(await read('0x39191d7b')) === coin.assetName);
  ok('its ticker is on chain', chain.decodeString(await read('0xbcc49b0c')) === coin.assetTicker);
  ok('the colour is on chain', chain.decodeString(await read('0x3dbc0610')) === coin.colour);
  ok('the position is on chain', chain.decodeString(await read('0x09218e91')) === coin.position);
  ok('the creator is on chain', chain.decodeAddress(await read('0x02d05d3f')).toLowerCase() === '0x' + callerHex);

  // and nothing can rewrite it afterwards
  const writable = build.abi
    .filter((f) => f.type === 'function' && f.stateMutability !== 'view' && f.stateMutability !== 'pure')
    .map((f) => f.name).sort();
  ok('no function can change the draw', writable.join(',') === 'approve,transfer,transferFrom',
    'writable: ' + writable.join(','));

  // an awkward name must survive the encoder
  const odd = { ...coin, name: 'Ñandú & Co — "quoted"', ticker: 'NDU' };
  const oddRes = await evm.runCall({ caller: from, to: undefined, data: bytes(chain.creationCode(odd)), gasLimit: 8000000n });
  ok('a non-ASCII name deploys', !oddRes.execResult.exceptionError);
  if (!oddRes.execResult.exceptionError) {
    const r2 = await evm.runCall({ caller: from, to: oddRes.createdAddress, data: bytes(chain.SEL.name), gasLimit: 2000000n });
    ok('and comes back byte for byte',
      chain.decodeString('0x' + Buffer.from(r2.execResult.returnValue).toString('hex')) === odd.name);
  }

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
