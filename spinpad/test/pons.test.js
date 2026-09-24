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

  console.log('\nthe fee, decoded back out');
  /* The one thing the pad sets that decides where money goes.
     `includes()` was the first version of this check and it was far too weak:
     an address anywhere in 900 bytes of calldata passes it, including in the
     wrong field entirely. So the calldata is DECODED, by viem, and the values
     are read out of the struct by name. That is the only way to know the
     recipient is in the recipient's word and not, say, in `recipient` — which
     is a different parameter of the same type, eight words further along. */
  const d = Pons.launchAndBuyData(LAUNCH);
  const back = viem.decodeFunctionData({ abi, data: d });
  const params = back.args[0];

  ok('it decodes as launchAndBuy at all', back.functionName === 'launchAndBuy');
  ok('creatorFeeRecipient is the address handed in',
    String(params[5]).toLowerCase() === TOKEN.feeRecipient.toLowerCase(),
    String(params[5]));
  ok('creatorTaxBps is the number handed in', Number(params[6]) === TOKEN.feeBps,
    String(params[6]));
  ok('and it did not land in `recipient`, which is a different address',
    String(back.args[5]).toLowerCase() === LAUNCH.recipient.toLowerCase(),
    String(back.args[5]));
  ok('the pair token is where the pair token goes',
    String(back.args[2]).toLowerCase() === LAUNCH.pairToken.toLowerCase());
  ok('the name survived its accents and em dash', params[0] === TOKEN.name, params[0]);

  /* Two hundred basis points is two percent. Worth one check that says so in
     as many words, because it is the number the whole arrangement is about. */
  console.log('\ntwo per cent');
  const TWO = { ...TOKEN, feeBps: 200, feeRecipient: '0x00000000000000000000000000000000000000f7' };
  const twoBack = viem.decodeFunctionData({ abi, data: Pons.launchAndBuyData({ ...LAUNCH, token: TWO }) });
  ok('200 bps rides in creatorTaxBps', Number(twoBack.args[0][6]) === 200);
  ok('and 200 bps of a whole is two per cent', (200 / Pons.MAX_BPS) * 100 === 2);
  ok('the recipient is the one the config names',
    String(twoBack.args[0][5]).toLowerCase() === TWO.feeRecipient.toLowerCase());

  console.log('\nrefusing to launch the money away');
  /* A launch whose fee recipient is missing or zero accrues to nobody, and the
     factory gives no second chance worth relying on. These must be refusals,
     not warnings — the transaction would otherwise look completely fine. */
  const build = (over) => Pons.buildLaunch({ ...LAUNCH, token: { ...TWO, ...over },
    chain: { maxCreatorTaxBps: 500, launchFee: 10n ** 15n, canLaunch: true, pairApproved: true } });

  ok('a launch with no fee recipient is refused',
    build({ feeRecipient: '' }).ok === false, JSON.stringify(build({ feeRecipient: '' })));
  ok('and says why', /accrue to nobody/.test(build({ feeRecipient: '' }).reason || ''));
  ok('the zero address is refused too',
    build({ feeRecipient: '0x' + '0'.repeat(40) }).ok === false);
  ok('and says it would be burned',
    /burned/.test(build({ feeRecipient: '0x' + '0'.repeat(40) }).reason || ''));
  ok('a tax above the protocol cap is refused before the wallet opens',
    build({ feeBps: 900 }).ok === false, JSON.stringify(build({ feeBps: 900 })));
  ok('and names the cap', /maximum of 500/.test(build({ feeBps: 900 }).reason || ''));
  ok('a fractional tax is refused', build({ feeBps: 12.5 }).ok === false);
  ok('a missing economics hash is refused',
    build({ expectedEconomics: '' }).ok === false);
  ok('and says it has to be read from the factory',
    /read from the factory/.test(build({ expectedEconomics: '' }).reason || ''));

  const good = build({});
  ok('a complete launch is allowed through', good.ok === true, JSON.stringify(good).slice(0, 200));
  ok('it goes to the launchAndBuy router, not the factory',
    good.to === Pons.ADDR.launchAndBuy);
  ok('the fee it reports back is the fee in the calldata',
    good.fee.bps === 200 && good.fee.recipient === TWO.feeRecipient);

  /* value: the launch fee on its own for an ERC-20 pair token, and the fee
     plus the buy when the pair token is native. Underpay it and the launch
     reverts; overpay it with a non-native pair and the ether buys nothing. */
  console.log('\nwhat gets sent as value');
  ok('an ERC-20 pair pays only the launch fee', BigInt(good.value) === 10n ** 15n,
    good.value);
  const native = Pons.buildLaunch({ ...LAUNCH, pairToken: '0x' + '0'.repeat(40),
    token: TWO,
    chain: { maxCreatorTaxBps: 500, launchFee: 10n ** 15n, canLaunch: true, pairApproved: true } });
  ok('a native pair pays the fee plus the buy',
    BigInt(native.value) === 10n ** 15n + LAUNCH.quoteIn, native.value);

  console.log('\nwhat the chain has to answer first');
  ok('every preflight read has a selector', Pons.PREFLIGHT.every(([k]) => !!Pons.SEL[k]),
    Pons.PREFLIGHT.map(([k]) => k).join(', '));
  ok('and every one of them is explained', Pons.PREFLIGHT.every(([, why]) => why.length > 10));
};

run();
console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
