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
    approvedPairTokens:     'approvedPairTokens(address)',
    pairTokenEconomics:     'pairTokenEconomics(address)',
    maxCreatorTaxBps:       'maxCreatorTaxBps()',
    previewLaunchEconomics: 'previewLaunchEconomics(uint256,address)',
    launchAndBuy: `launchAndBuy(${TOKEN_PARAMS},uint256,address,uint256,uint256,address,address[])`,
    balanceOf:              'balanceOf(address)',
    balanceOfToken:         'balanceOfToken(address,address)',
    claim:                  'claim()',
    claimToken:             'claimToken(address)',
  };

  const SEL = {
    approvedPairTokens:     '0x9831705e',
    pairTokenEconomics:     '0x31082134',
    maxCreatorTaxBps:       '0xf325a5fb',
    previewLaunchEconomics: '0xf718b78c',
    launchAndBuy:           '0xf85f8e41',
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

  const approvedPairTokensData = (a) => encodeCall('approvedPairTokens', ['address'], [a]);
  const pairTokenEconomicsData = (a) => encodeCall('pairTokenEconomics', ['address'], [a]);
  const maxCreatorTaxBpsData = () => SEL.maxCreatorTaxBps;
  const previewLaunchEconomicsData = (id, a) =>
    encodeCall('previewLaunchEconomics', ['uint256', 'address'], [id, a]);
  const escrowBalanceData = (who) => encodeCall('balanceOf', ['address'], [who]);
  const escrowBalanceTokenData = (who, token) =>
    encodeCall('balanceOfToken', ['address', 'address'], [who, token]);
  const claimData = () => SEL.claim;
  const claimTokenData = (token) => encodeCall('claimToken', ['address'], [token]);

  return {
    CHAIN, ADDR, SIG, SEL, TOKEN_PARAMS, LAUNCH_TYPES,
    isDynamic, split, encodeTuple, encodeCall, tokenParams,
    launchAndBuyData, approvedPairTokensData, pairTokenEconomicsData,
    maxCreatorTaxBpsData, previewLaunchEconomicsData,
    escrowBalanceData, escrowBalanceTokenData, claimData, claimTokenData,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.TwistrPons;
