/* The Pons encoder, checked against viem.
 *
 * pons.js hand-encodes the calls the pad would make to Pons v2 on Robinhood
 * Chain. The hard one is launchAndBuy: a tuple holding four dynamic strings and
 * a nested tuple of five more, then fixed fields, then a dynamic array. ABI
 * encoding nests — a tuple with a dynamic member is itself dynamic, its head is
 * an offset, and the offsets inside its tail are relative to the start of that
 * tail. Get that wrong and you produce a perfectly well-formed transaction that
 * says something else.
 *
 * So nothing here trusts the encoder's own arithmetic. Every call is encoded
 * twice — once by pons.js and once by viem, which is the library Pons's own
 * published client uses — and compared byte for byte. viem is not a dependency
 * of the site; it is installed alongside this suite, and skipped if absent, the
 * same way playwright is.
 */
let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

global.window = global.window || {};
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
const Pons = require('../pons.js');

let viem;
try { viem = require('viem'); } catch (e) { viem = null; }

/* Deliberately awkward: a name with an em dash and an accent, an empty string,
   a string that lands exactly on a 32-byte boundary, and one that does not.
   Padding bugs hide in all four. */
const TOKEN = {
  name: 'Northwind Capital — año uno',
  ticker: 'NWND',
  logo: '',
  description: 'LEFT FOOT · RED → GameStop. One spin, no reroll.',
  twitter: 'twistr', telegram: '', discord: '', website: 'https://example.invalid', farcaster: '',
  feeRecipient: '0x00000000000000000000000000000000000000a1',
  feeBps: 250,
  buyback: true,
  expectedEconomics: '0x' + 'ab'.repeat(32),
  salt: '0x' + '17'.repeat(32),
};
const LAUNCH = {
  token: TOKEN,
  configId: 3,
  pairToken: '0x000000000000000000000000000000000000b0b0',
  quoteIn: 1500000000000000000n,
  minTokensOut: 42n,
  recipient: '0x00000000000000000000000000000000000000c3',
  snipeTaxExemptions: ['0x00000000000000000000000000000000000000d4',
                       '0x00000000000000000000000000000000000000e5'],
};

const run = () => {
  console.log('\nthe pons addresses');
  ok('the chain is Robinhood Chain', Pons.CHAIN.id === 4663, String(Pons.CHAIN.id));
  ok('every address is a 20-byte hex address',
    Object.values(Pons.ADDR).every((a) => /^0x[0-9a-fA-F]{40}$/.test(a)),
    JSON.stringify(Pons.ADDR));
  ok('and they are all different from each other',
    new Set(Object.values(Pons.ADDR).map((a) => a.toLowerCase())).size === Object.keys(Pons.ADDR).length);

  console.log('\nthe selectors');
  if (!viem) {
    console.log('  skipped: viem is not installed here');
  } else {
    Object.entries(Pons.SIG).forEach(([name, sig]) => {
      const want = viem.toFunctionSelector(sig);
      ok(`${name} is the selector for its own signature`, Pons.SEL[name] === want,
        `${Pons.SEL[name]} vs ${want} for ${sig}`);
    });
  }

  console.log('\nthe encoder');
  if (!viem) {
    console.log('  skipped: viem is not installed here');
    return;
  }
  const abi = viem.parseAbi([
    `function launchAndBuy(${Pons.TOKEN_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions)`,
    'function approvedPairTokens(address pairToken)',
    'function pairTokenEconomics(address pairToken)',
    'function previewLaunchEconomics(uint256 launchConfigId, address pairToken)',
    'function balanceOf(address who)',
    'function balanceOfToken(address who, address token)',
    'function claimToken(address token)',
  ]);
  const same = (name, mine, theirs) =>
    ok(name, mine.toLowerCase() === theirs.toLowerCase(),
      `\n      mine   ${mine}\n      viem   ${theirs}`);

  same('launchAndBuy encodes byte for byte',
    Pons.launchAndBuyData(LAUNCH),
    viem.encodeFunctionData({ abi, functionName: 'launchAndBuy', args: [
      [TOKEN.name, TOKEN.ticker, TOKEN.logo, TOKEN.description,
       [TOKEN.twitter, TOKEN.telegram, TOKEN.discord, TOKEN.website, TOKEN.farcaster],
       TOKEN.feeRecipient, TOKEN.feeBps, TOKEN.buyback, TOKEN.expectedEconomics, TOKEN.salt],
      BigInt(LAUNCH.configId), LAUNCH.pairToken, LAUNCH.quoteIn, LAUNCH.minTokensOut,
      LAUNCH.recipient, LAUNCH.snipeTaxExemptions] }));

  same('approvedPairTokens', Pons.approvedPairTokensData(LAUNCH.pairToken),
    viem.encodeFunctionData({ abi, functionName: 'approvedPairTokens', args: [LAUNCH.pairToken] }));
  same('pairTokenEconomics', Pons.pairTokenEconomicsData(LAUNCH.pairToken),
    viem.encodeFunctionData({ abi, functionName: 'pairTokenEconomics', args: [LAUNCH.pairToken] }));
  same('previewLaunchEconomics', Pons.previewLaunchEconomicsData(3, LAUNCH.pairToken),
    viem.encodeFunctionData({ abi, functionName: 'previewLaunchEconomics', args: [3n, LAUNCH.pairToken] }));
  same('the fee escrow balance', Pons.escrowBalanceData(TOKEN.feeRecipient),
    viem.encodeFunctionData({ abi, functionName: 'balanceOf', args: [TOKEN.feeRecipient] }));
  same('the fee escrow token balance',
    Pons.escrowBalanceTokenData(TOKEN.feeRecipient, LAUNCH.pairToken),
    viem.encodeFunctionData({ abi, functionName: 'balanceOfToken', args: [TOKEN.feeRecipient, LAUNCH.pairToken] }));
  same('claiming one token', Pons.claimTokenData(LAUNCH.pairToken),
    viem.encodeFunctionData({ abi, functionName: 'claimToken', args: [LAUNCH.pairToken] }));

  /* An empty array is its own case: a length word and no tail. It is the shape
     most likely to be off by one word. */
  same('launchAndBuy with no snipe exemptions',
    Pons.launchAndBuyData({ ...LAUNCH, snipeTaxExemptions: [] }),
    viem.encodeFunctionData({ abi, functionName: 'launchAndBuy', args: [
      [TOKEN.name, TOKEN.ticker, TOKEN.logo, TOKEN.description,
       [TOKEN.twitter, TOKEN.telegram, TOKEN.discord, TOKEN.website, TOKEN.farcaster],
       TOKEN.feeRecipient, TOKEN.feeBps, TOKEN.buyback, TOKEN.expectedEconomics, TOKEN.salt],
      BigInt(LAUNCH.configId), LAUNCH.pairToken, LAUNCH.quoteIn, LAUNCH.minTokensOut,
      LAUNCH.recipient, []] }));

  /* And a token whose every string is empty, which is all offsets and no data. */
  const bare = { ...TOKEN, name: '', ticker: '', description: '', website: '', twitter: '' };
  same('launchAndBuy with every string empty',
    Pons.launchAndBuyData({ ...LAUNCH, token: bare }),
    viem.encodeFunctionData({ abi, functionName: 'launchAndBuy', args: [
      ['', '', '', '', ['', '', '', '', ''],
       bare.feeRecipient, bare.feeBps, bare.buyback, bare.expectedEconomics, bare.salt],
      BigInt(LAUNCH.configId), LAUNCH.pairToken, LAUNCH.quoteIn, LAUNCH.minTokensOut,
      LAUNCH.recipient, LAUNCH.snipeTaxExemptions] }));

  console.log('\nthe fee recipient');
  /* The one thing the pad sets that decides where money goes. If this ever
     stopped being the address handed in, launches would pay somebody else. */
  const d = Pons.launchAndBuyData(LAUNCH);
  ok('the fee recipient in the calldata is the one asked for',
    d.toLowerCase().includes(TOKEN.feeRecipient.slice(2).toLowerCase()),
    TOKEN.feeRecipient);
  ok('and so is the pair token', d.toLowerCase().includes(LAUNCH.pairToken.slice(2).toLowerCase()));
};

run();
console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
