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
    'function sweepFees(uint256 minBuybackTokensOut)',
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

  console.log('\ngetting the money out');
  /* Three places the tax can sit, and only the last is spendable: on the
     curve until somebody sweeps, in the escrow until you claim, then in your
     wallet. Each step is a different contract and a different call. */
  same('sweepFees, which moves it off the curve', Pons.sweepFeesData(0),
    viem.encodeFunctionData({ abi, functionName: 'sweepFees', args: [0n] }));
  same('sweepFees with a slippage floor', Pons.sweepFeesData(1234n),
    viem.encodeFunctionData({ abi, functionName: 'sweepFees', args: [1234n] }));
  ok('an omitted floor is zero rather than undefined',
    Pons.sweepFeesData() === Pons.sweepFeesData(0), Pons.sweepFeesData());
  ok('creatorTaxBalance is a bare selector', Pons.creatorTaxBalanceData() === Pons.SEL.creatorTaxBalance
    && /^0x[0-9a-f]{8}$/.test(Pons.creatorTaxBalanceData()), Pons.creatorTaxBalanceData());
  ok('and so is claim', Pons.claimData() === '0x4e71d92d', Pons.claimData());
  ok('claim and claimToken are different calls',
    Pons.claimData() !== Pons.claimTokenData(LAUNCH.pairToken));
  /* The escrow reads take the RECIPIENT, not the token, in the first slot.
     Swapping them reads somebody else's balance and reports zero. */
  const bal = Pons.escrowBalanceTokenData(TOKEN.feeRecipient, LAUNCH.pairToken);
  const words = bal.slice(10).match(/.{64}/g);
  ok('balanceOfToken puts the recipient first and the token second',
    words[0].endsWith(TOKEN.feeRecipient.slice(2)) && words[1].endsWith(LAUNCH.pairToken.slice(2)),
    words.join(' / '));

  console.log('\nfinding the pair tokens from the chain');
  /* The log is built by viem's encodeEventTopics/encodeAbiParameters, so the
     decoder is checked against a reference encoder rather than against the
     shape I imagined. Three indexed fields go in topics, three static words in
     data, and mixing those two up is the whole failure mode. */
  const launchedAbi = viem.parseAbi([
    'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
  ]);
  const mkLog = (token, curve, deployer, pairToken, configId, grad) => ({
    topics: viem.encodeEventTopics({ abi: launchedAbi, eventName: 'TokenLaunched',
      args: { token, curve, deployer } }),
    data: viem.encodeAbiParameters(
      viem.parseAbiParameters('address, uint256, uint256'),
      [pairToken, BigInt(configId), BigInt(grad)]),
  });

  const A = '0x00000000000000000000000000000000000000a1';
  const B = '0x00000000000000000000000000000000000000b2';
  const TSLA = '0x000000000000000000000000000000000000dead';
  const AMZN = '0x000000000000000000000000000000000000beef';

  const one = Pons.decodeTokenLaunched(mkLog(A, B, A, TSLA, 3, 99));
  ok('a TokenLaunched log decodes', !!one, JSON.stringify(one));
  ok('the pair token comes out of the data, not a topic',
    one && one.pairToken.toLowerCase() === TSLA, one && one.pairToken);
  ok('the token comes out of a topic, not the data',
    one && one.token.toLowerCase() === A, one && one.token);
  ok('the deployer is the third topic, not the first',
    one && one.deployer.toLowerCase() === A && one.curve.toLowerCase() === B,
    one && one.curve);
  ok('the config id survives as a number', one && one.configId === '3', one && one.configId);
  ok('and so does the graduation threshold', one && one.graduationThreshold === '99');

  ok('a log with the wrong topic is ignored',
    Pons.decodeTokenLaunched({ topics: ['0x' + '11'.repeat(32), A, B, A], data: '0x' }) === null);
  ok('and so is a truncated one',
    Pons.decodeTokenLaunched({ topics: [Pons.TOPIC.tokenLaunched, A, B, A], data: '0x1234' }) === null);

  /* The whole point: sixteen addresses nobody had to type in. */
  const found = Pons.pairTokensFrom([
    mkLog(A, B, A, TSLA, 3, 99),
    mkLog(B, A, B, AMZN, 4, 99),
    mkLog(A, A, B, TSLA, 5, 99),
  ]);
  ok('the distinct pair tokens are discovered', found.length === 2, JSON.stringify(found));
  ok('and the commonest comes first',
    found[0].pairToken === TSLA && found[0].launches === 2, JSON.stringify(found[0]));
  ok('with the config ids seen with it',
    found[0].configIds.sort().join(',') === '3,5', found[0].configIds.join(','));
  ok('rubbish in the batch is skipped rather than throwing',
    Pons.pairTokensFrom([{ topics: [], data: '0x' }, mkLog(A, B, A, TSLA, 1, 1)]).length === 1);

  console.log('\nthe shipped pons config');
  /* Read off disk, not a stub. The fee recipient is the one value in the whole
     project that decides where revenue goes, and it cannot be derived from
     anything — so the only useful check is that it is either genuinely empty
     (and the pad therefore refuses to launch) or a real address. A
     half-filled, plausible-looking value is the failure mode. */
  const fs2 = require('fs');
  const path2 = require('path');
  const cfg = fs2.readFileSync(path2.join(__dirname, '..', 'config.js'), 'utf8');
  const ponsBlock = cfg.slice(cfg.indexOf('  pons: {'));
  const feeBlock = ponsBlock.slice(0, ponsBlock.indexOf('pairTokens'));

  const bpsM = feeBlock.match(/bps:\s*(\d+)/);
  const recM = feeBlock.match(/recipient:\s*'([^']*)'/);
  ok('the pons block names a fee in basis points', !!bpsM, String(bpsM));
  ok('and it is the 2% asked for', bpsM && Number(bpsM[1]) === 200, bpsM && bpsM[1]);
  ok('the fee is within what any protocol could allow',
    bpsM && Number(bpsM[1]) <= Pons.MAX_BPS);
  ok('the recipient is either empty or a real address',
    recM && (recM[1] === '' || /^0x[0-9a-fA-F]{40}$/.test(recM[1])), recM && recM[1]);
  ok('and if it is empty, the pad refuses to launch',
    recM[1] !== '' || Pons.buildLaunch({ ...LAUNCH,
      token: { ...TOKEN, feeRecipient: recM[1] },
      chain: { maxCreatorTaxBps: 500, launchFee: 0n, canLaunch: true, pairApproved: true } }).ok === false);
  ok('no pair token was transcribed into the file by hand',
    /pairTokens:\s*\[\s*\]/.test(ponsBlock),
    'pairTokens should stay empty and be discovered from the chain');

  console.log('\nwhat the chain has to answer first');
  ok('every preflight read has a selector', Pons.PREFLIGHT.every(([k]) => !!Pons.SEL[k]),
    Pons.PREFLIGHT.map(([k]) => k).join(', '));
  ok('and every one of them is explained', Pons.PREFLIGHT.every(([, why]) => why.length > 10));
};

run();
console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
