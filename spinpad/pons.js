/* Twistr on Pons v2 — Robinhood Chain (4663).
 *
 * The pad on Base deploys its own ERC-20 and opens a V2 pool. Pons does neither
 * of those things: its factory deploys the token for you, against a pair token
 * it has to have approved, onto a Uniswap V4 curve. So this is a second chain
 * layer rather than a patch to chain.js, and the two do not share an address.
 *
 * WHERE THESE NUMBERS COME FROM. Every address and every signature below was
 * read out of `pons-client` 0.1.1 on npm — the protocol's own published
 * client — not remembered and not copied off a screenshot. The package was the
 * only reachable source of truth from where this was built, and it is a good
 * one: it is what their own front end talks to the chain with.
 *
 * The selectors are hardcoded with the canonical signature beside each, the way
 * chain.js does it, and test/pons.test.js recomputes the lot with keccak and
 * re-encodes every call with viem, byte for byte. A hand-written encoder for a
 * struct this shape — four dynamic strings, a nested struct of five more, then
 * fixed fields and a dynamic array — is exactly the thing that is quietly
 * wrong until it moves somebody's money.
 */
window.TwistrPons = (() => {
  'use strict';

  const CHAIN = {
    id: 4663,
    name: 'Robinhood Chain',
    rpc: 'https://rpc.robinhood.com',
  };

  /* pons-client 0.1.1, src/constants.ts. Only the three this pad touches are
     named here; the protocol has more. */
  const ADDR = {
    factory:     '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    launchAndBuy:'0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
    feeEscrow:   '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  };

  const TOKEN_PARAMS =
    '(string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32)';

  const SIG = {
    launchFee:              'launchFee()',
    canLaunch:              'canLaunch(address)',
    launchConfigCount:      'launchConfigCount()',
    getLaunchConfig:        'getLaunchConfig(uint256)',
    getLaunchFeePolicy:     'getLaunchFeePolicy(address)',
    getLaunchedToken:       'getLaunchedToken(address)',
    approvedPairTokens:     'approvedPairTokens(address)',
    pairTokenEconomics:     'pairTokenEconomics(address)',
    maxCreatorTaxBps:       'maxCreatorTaxBps()',
    previewLaunchEconomics: 'previewLaunchEconomics(uint256,address)',
    launchAndBuy: `launchAndBuy(${TOKEN_PARAMS},uint256,address,uint256,uint256,address,address[])`,
    sweepFees:              'sweepFees(uint256)',
    creatorTaxBalance:      'creatorTaxBalance()',
    quoteFeeBalance:        'quoteFeeBalance()',
    balanceOf:              'balanceOf(address)',
    balanceOfToken:         'balanceOfToken(address,address)',
    claim:                  'claim()',
    claimToken:             'claimToken(address)',
  };

  const SEL = {
    launchFee:              '0xcf3cf573',
    canLaunch:              '0x58373f04',
    launchConfigCount:      '0xae72d871',
    getLaunchConfig:        '0x1cad862d',
    getLaunchFeePolicy:     '0x470ef5fc',
    getLaunchedToken:       '0x3cf28b5a',
    approvedPairTokens:     '0x9831705e',
    pairTokenEconomics:     '0x31082134',
    maxCreatorTaxBps:       '0xf325a5fb',
    previewLaunchEconomics: '0xf718b78c',
    launchAndBuy:           '0xf85f8e41',
    sweepFees:              '0x3729bb9a',
    creatorTaxBalance:      '0xdb2bd533',
    quoteFeeBalance:        '0xed479c47',
    balanceOf:              '0x70a08231',
    balanceOfToken:         '0xf59e38b7',
    claim:                  '0x4e71d92d',
    claimToken:             '0x32f289cf',
  };

  /* ---------- the encoder ----------
   *
   * ABI encoding is head-and-tail, and the only hard part is that it nests: a
   * tuple containing a dynamic member is itself dynamic, its head is an offset,
   * and the offsets inside its tail are relative to the start of that tail, not
   * to the start of the call. Getting that wrong produces a perfectly
   * well-formed transaction that says something else.
   */
  const strip = (h) => String(h || '').replace(/^0x/, '');
  const word = (n) => BigInt(n).toString(16).padStart(64, '0');
  const addrWord = (a) => strip(a).toLowerCase().padStart(64, '0');
  const padRight = (h) => h + '0'.repeat((64 - (h.length % 64)) % 64);
  const utf8 = (s) => {
    const b = new TextEncoder().encode(String(s));
    let h = '';
    b.forEach((v) => { h += v.toString(16).padStart(2, '0'); });
    return { hex: h, length: b.length };
  };

  // is this type encoded in place, or as an offset into a tail?
  const isDynamic = (t) => {
    if (t === 'string' || t === 'bytes') return true;
    if (t.endsWith('[]')) return true;
    if (t.startsWith('(')) return split(t.slice(1, -1)).some(isDynamic);
    return false;
  };

  /* Split a tuple's inner type list on commas that are not inside a nested
     tuple. A plain String.split(',') tears '(string,string)' in half. */
  const split = (inner) => {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of inner) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };

  const encodeOne = (type, value) => {
    if (type === 'address') return addrWord(value);
    if (type === 'bool') return word(value ? 1 : 0);
    if (type === 'bytes32') return strip(value).toLowerCase().padStart(64, '0');
    if (/^uint\d*$/.test(type)) return word(value);
    if (type === 'string') {
      const s = utf8(value);
      return word(s.length) + padRight(s.hex);
    }
    if (type.endsWith('[]')) {
      const item = type.slice(0, -2);
      const arr = value || [];
      return word(arr.length) + encodeTuple(arr.map(() => item), arr);
    }
    if (type.startsWith('(')) return encodeTuple(split(type.slice(1, -1)), value);
    throw new Error('unsupported type: ' + type);
  };

  /* Heads first, one word each — the value itself when it fits, an offset when
     it does not — then every tail in the same order. */
  const encodeTuple = (types, values) => {
    let head = '', tail = '';
    let offset = types.length * 32;
    types.forEach((t, i) => {
      if (!isDynamic(t)) { head += encodeOne(t, values[i]); return; }
      head += word(offset);
      const enc = encodeOne(t, values[i]);
      tail += enc;
      offset += enc.length / 2;
    });
    return head + tail;
  };

  const encodeCall = (name, types, values) => SEL[name] + encodeTuple(types, values);

  /* ---------- the calls ----------
   *
   * `description` is where the draw goes. On Base it is a field in a contract
   * this project wrote, with no function anywhere that can change it. Here the
   * factory writes the token, so the draw goes in the metadata Pons stores and
   * `getTokenInfo()` reads back. That is still on chain and still readable by
   * anyone — but it is Pons's field, not ours, and the README says so rather
   * than repeating a promise that moved house.
   */
  const tokenParams = (t) => [
    t.name,
    t.ticker,
    t.logo || '',
    t.description || '',
    [t.twitter || '', t.telegram || '', t.discord || '', t.website || '', t.farcaster || ''],
    t.feeRecipient,
    t.feeBps,
    !!t.buyback,
    t.expectedEconomics,
    t.salt,
  ];

  const LAUNCH_TYPES = [
    TOKEN_PARAMS, 'uint256', 'address', 'uint256', 'uint256', 'address', 'address[]',
  ];

  const launchAndBuyData = (o) => encodeCall('launchAndBuy', LAUNCH_TYPES, [
    tokenParams(o.token),
    o.configId,
    o.pairToken,
    o.quoteIn,
    o.minTokensOut,
    o.recipient,
    o.snipeTaxExemptions || [],
  ]);

  /* ---------- finding the pair tokens without being told them ----------
   *
     THE WALL THIS GETS AROUND. approvedPairTokens(address) is a lookup, not an
     enumeration: you can ask "is this one approved?" but there is no call that
     hands back the list. So the sixteen addresses the wheel needs looked like
     something that had to come from outside the code, written down by hand,
     which is exactly how a wrong address gets into the one call that moves
     money.

     It does not. Every launch the factory has ever done emits

       TokenLaunched(address indexed token, address indexed curve,
                     address indexed deployer, address pairToken,
                     uint256 launchConfigId, uint256 graduationThreshold)

     with pairToken in the data. Walking that log from the factory's own address
     gives every pair token anyone has actually launched against, and the config
     ids in use with them — discovered from the chain at runtime, in the
     launcher's own browser, rather than transcribed. Each one is then put back
     through approvedPairTokens() before the pad will offer it, so a token that
     appears in an old log but has since been dropped cannot be used.

     Three indexed fields and three static words of data, so the decode is
     simple — which is the point. Nothing here is guessed. */
  const TOPIC = {
    tokenLaunched: '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607',
    // TokenLaunched(address,address,address,address,uint256,uint256)
  };

  const decodeTokenLaunched = (log) => {
    const t = log && log.topics;
    if (!t || t.length < 4 || String(t[0]).toLowerCase() !== TOPIC.tokenLaunched) return null;
    const h = String(log.data || '').replace(/^0x/, '');
    const w = h.match(/.{64}/g) || [];
    if (w.length < 3) return null;
    const addr = (x) => '0x' + String(x).replace(/^0x/, '').padStart(64, '0').slice(24);
    return {
      token: addr(t[1]),
      curve: addr(t[2]),
      deployer: addr(t[3]),
      pairToken: '0x' + w[0].slice(24),
      configId: BigInt('0x' + w[1]).toString(),
      graduationThreshold: BigInt('0x' + w[2]).toString(),
    };
  };

  /* The distinct pair tokens in a batch of logs, commonest first, because the
     one most launches used is the one most likely to still be approved and
     liquid. Zero addresses are kept: a native pair token is a real choice and
     changes what `value` has to carry. */
  const pairTokensFrom = (logs) => {
    const seen = new Map();
    (logs || []).forEach((l) => {
      const d = decodeTokenLaunched(l);
      if (!d) return;
      const k = d.pairToken.toLowerCase();
      const at = seen.get(k) || { pairToken: k, launches: 0, configIds: new Set() };
      at.launches += 1;
      at.configIds.add(d.configId);
      seen.set(k, at);
    });
    return [...seen.values()]
      .map((x) => ({ pairToken: x.pairToken, launches: x.launches, configIds: [...x.configIds] }))
      .sort((a, b) => b.launches - a.launches);
  };

  /* ---------- the fee, and refusing to launch without it ----------
   *
     THE ONE THING THAT MUST NOT BE WRONG. `creatorFeeRecipient` is where the
     creator tax accrues; `creatorTaxBps` is how much. Both are written into the
     token at launch and there is no second chance: the factory exposes
     transferCreatorFeeRecipient, and CreatorFeeRecipientUpdated carries an
     effectiveAt, so changing it later is at best a delayed, permissioned
     operation and at worst not available to you at all.

     So the guard below is not a formality. A launch with a zero or empty
     recipient is a launch whose fees accrue to nobody and cannot be recovered —
     which is precisely the outcome to design against. buildLaunch refuses it
     rather than sending a transaction that looks fine and quietly burns the
     revenue.

     WHAT IS AND IS NOT YOURS TO SET. Two different fees ride on a Pons launch
     and only one of them is this pad's:

       creatorTaxBps      yours. Capped by the factory's maxCreatorTaxBps().
       curveFeeBps        Pons's, and it is a field of the LaunchConfig you
                          pick, not something passed in. FeePolicy splits it
                          via protocolFeeShareBps.

     There is no parameter anywhere in this ABI that assigns a share to Pons,
     because Pons's share is already theirs by the config. Picking a config is
     the whole of the choice. The pad reads curveFeeBps and shows it rather than
     pretending to set it. */
  const MAX_BPS = 10000;

  const feeProblem = (t, maxBps) => {
    const r = String(t.feeRecipient || '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(r)) {
      return 'No fee recipient. The creator tax would accrue to nobody and could not be recovered.';
    }
    if (/^0x0{40}$/i.test(r)) {
      return 'The fee recipient is the zero address. The creator tax would be burned.';
    }
    const bps = Number(t.feeBps);
    if (!Number.isInteger(bps) || bps < 0 || bps > MAX_BPS) {
      return `Creator tax ${t.feeBps} is not a whole number of basis points.`;
    }
    /* The chain's cap, when it has been read. Sending a tax above it does not
       fail quietly — it reverts — but it reverts after the wallet has been
       opened and gas has been estimated, which is a worse way to find out. */
    if (maxBps !== null && maxBps !== undefined && bps > Number(maxBps)) {
      return `Creator tax ${bps} bps is above the protocol maximum of ${maxBps} bps, so the launch would revert.`;
    }
    return null;
  };

  /* Everything the chain has to answer before a launch can be built. None of it
     is optional and none of it can be guessed: expectedEconomics is a hash the
     factory recomputes and compares, and launchFee is paid as value. A pad that
     filled either from a constant would build a transaction that always
     reverts. */
  const PREFLIGHT = [
    ['maxCreatorTaxBps',       'the cap on your own fee'],
    ['launchFee',              'what the factory charges to launch, paid as value'],
    ['canLaunch',              'whether this address is allowed to launch at all'],
    ['approvedPairTokens',     'whether the pair token is one Pons has approved'],
    ['previewLaunchEconomics', 'the economics hash pinned into the params'],
  ];

  /* Build the whole call, or say why not. Nothing here sends anything. */
  const buildLaunch = (o) => {
    const chain = o.chain || {};
    const problem = feeProblem(o.token, chain.maxCreatorTaxBps);
    if (problem) return { ok: false, reason: problem };

    if (!/^0x[0-9a-fA-F]{64}$/.test(String(o.token.expectedEconomics || ''))) {
      return { ok: false, reason: 'No economics hash. previewLaunchEconomics has to be read from the factory first.' };
    }
    if (chain.canLaunch === false) {
      return { ok: false, reason: 'This address is not allowed to launch on Pons.' };
    }
    if (chain.pairApproved === false) {
      return { ok: false, reason: 'That pair token is not approved by Pons, so the launch would revert.' };
    }

    /* value = the launch fee, plus the buy when the pair token is native.
       pons-client does exactly this, and getting it wrong either underpays the
       fee (revert) or sends ether that buys nothing. */
    const native = /^0x0{40}$/i.test(String(o.pairToken || ''));
    const fee = BigInt(chain.launchFee || 0n);
    const value = native ? fee + BigInt(o.quoteIn || 0n) : fee;

    return {
      ok: true,
      to: ADDR.launchAndBuy,
      data: launchAndBuyData(o),
      value: '0x' + value.toString(16),
      fee: { recipient: o.token.feeRecipient, bps: Number(o.token.feeBps) },
    };
  };

  const launchFeeData = () => SEL.launchFee;
  const canLaunchData = (a) => encodeCall('canLaunch', ['address'], [a]);
  const launchConfigCountData = () => SEL.launchConfigCount;
  const getLaunchConfigData = (id) => encodeCall('getLaunchConfig', ['uint256'], [id]);
  const getLaunchFeePolicyData = (t) => encodeCall('getLaunchFeePolicy', ['address'], [t]);
  const getLaunchedTokenData = (t) => encodeCall('getLaunchedToken', ['address'], [t]);

  const approvedPairTokensData = (a) => encodeCall('approvedPairTokens', ['address'], [a]);
  const pairTokenEconomicsData = (a) => encodeCall('pairTokenEconomics', ['address'], [a]);
  const maxCreatorTaxBpsData = () => SEL.maxCreatorTaxBps;
  const previewLaunchEconomicsData = (id, a) =>
    encodeCall('previewLaunchEconomics', ['uint256', 'address'], [id, a]);
  /* ---------- getting the money out ----------
   *
     THE FEE DOES NOT ARRIVE BY ITSELF, and this is the part that surprises
     people. There are three places the creator tax can be sitting and only the
     last one is yours to spend:

       1. ON THE CURVE. Every buy and sell credits the tax to the curve
          contract for that coin. creatorTaxBalance() is what is waiting there.
          It stays there until somebody calls sweepFees().

       2. IN THE ESCROW. sweepFees() moves it to the FeeEscrow and credits it
          to the recipient the token was launched with. balanceOf(you) is the
          native balance; balanceOfToken(you, token) is per pair token.

       3. IN YOUR WALLET, after claim() or claimToken().

     sweepFees is a plain public write with no access control, so anyone can
     call it — but ANYONE has to. Nothing sweeps on a timer. A coin that nobody
     trades much can hold your tax on its curve indefinitely, and the way to
     find that out is to read creatorTaxBalance() per coin rather than to check
     the escrow and conclude there is nothing.

     `minBuybackTokensOut` is a slippage floor: sweeping can perform the
     buyback, which is a swap, so zero accepts any price. Pass zero only when
     the coin has buyback disabled or you do not care. */
  const sweepFeesData = (minBuybackTokensOut) =>
    encodeCall('sweepFees', ['uint256'], [minBuybackTokensOut || 0]);
  const creatorTaxBalanceData = () => SEL.creatorTaxBalance;
  const quoteFeeBalanceData = () => SEL.quoteFeeBalance;

  const escrowBalanceData = (who) => encodeCall('balanceOf', ['address'], [who]);
  const escrowBalanceTokenData = (who, token) =>
    encodeCall('balanceOfToken', ['address', 'address'], [who, token]);
  const claimData = () => SEL.claim;
  const claimTokenData = (token) => encodeCall('claimToken', ['address'], [token]);

  return {
    CHAIN, ADDR, SIG, SEL, TOPIC, TOKEN_PARAMS, LAUNCH_TYPES,
    decodeTokenLaunched, pairTokensFrom,
    isDynamic, split, encodeTuple, encodeCall, tokenParams,
    MAX_BPS, PREFLIGHT, feeProblem, buildLaunch,
    launchFeeData, canLaunchData, launchConfigCountData, getLaunchConfigData,
    getLaunchFeePolicyData, getLaunchedTokenData,
    launchAndBuyData, approvedPairTokensData, pairTokenEconomicsData,
    maxCreatorTaxBpsData, previewLaunchEconomicsData,
    escrowBalanceData, escrowBalanceTokenData, claimData, claimTokenData,
    sweepFeesData, creatorTaxBalanceData, quoteFeeBalanceData,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.TwistrPons;
