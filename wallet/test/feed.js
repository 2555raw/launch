/* The launched-coins feed, which reads the chain without a library.
 *
 * The landing page does not load ethers and should not start: someone reading
 * about a wallet has no business downloading one. So feed.js decodes what it
 * needs by hand, and the two things it cannot compute in a browser — the event
 * topic and the function selectors, which need keccak-256 — are written down.
 *
 * Written-down hashes are exactly the kind of thing that is wrong by one digit
 * and fails as "no launches found" rather than as an error. So every one is
 * recomputed here from its signature, and the hand-rolled string decoder is
 * checked against ethers across the cases that break naive decoders: empty,
 * multi-byte, emoji, and strings long enough to span several words.
 *
 *   FEED_MODULES=/path/to/node_modules node test/feed.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MODS = process.env.FEED_MODULES || path.join(__dirname, 'node_modules');
const { ethers: E } = require(path.join(MODS, 'ethers'));

global.window = global;
if (!global.crypto) global.crypto = require('crypto').webcrypto;
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'feed.js'), 'utf8'));
const F = window.WARD_FEED;

let checks = 0;
const step = m => console.log('  ▸ ' + m);

/* ── the hashes nobody can compute in a browser ────────────────────────── */
{
  const sig = 'TokenLaunched(address,address,address,address,uint256,uint256)';
  const want = E.id(sig);
  assert.strictEqual(F.TOPIC_LAUNCHED, want,
    `the event topic is wrong: feed.js has ${F.TOPIC_LAUNCHED}, keccak of the signature is ${want}`);
  checks++;
  step('the TokenLaunched topic matches keccak-256 of its signature');

  for (const [key, sigf] of [['name', 'name()'], ['symbol', 'symbol()'], ['info', 'getTokenInfo()']]) {
    const w = E.id(sigf).slice(0, 10);
    assert.strictEqual(F.SEL[key], w, `selector for ${sigf}: have ${F.SEL[key]}, want ${w}`);
    checks++;
  }
  step('all three selectors match keccak-256 of their signatures');
}

/* ── the event signature is the one Pons actually declares ─────────────── */
const SRC = process.env.PONS_SRC;
if (!SRC) {
  console.log('  ! PONS_SRC not set: the event was NOT checked against Pons\'s source');
} else {
  const sol = fs.readFileSync(
    path.join(SRC, 'contractsV2', 'src', 'v2', 'PonsV2LaunchFactory.sol'), 'utf8');
  const body = sol.slice(sol.indexOf('event TokenLaunched('));
  const decl = body.slice(0, body.indexOf(');'));
  const types = decl.split('\n').slice(1)
    .map(l => (l.trim().match(/^(address|uint256|uint16|bool|bytes32)\b/) || [])[1])
    .filter(Boolean);
  assert.deepStrictEqual(types, ['address', 'address', 'address', 'address', 'uint256', 'uint256'],
    'the TokenLaunched parameters in the deployed source are not the ones feed.js assumes');
  /* The first three are indexed, which is why they arrive as topics. */
  const indexed = (decl.match(/indexed/g) || []).length;
  assert.strictEqual(indexed, 3, 'the number of indexed parameters changed, so the topics move');
  checks += 2;
  step('the event matches Pons\'s source: six parameters, the first three indexed');
}

/* ── an address out of a log topic ─────────────────────────────────────── */
{
  for (let i = 0; i < 50; i++) {
    const a = E.Wallet.createRandom().address;
    const topic = E.zeroPadValue(a.toLowerCase(), 32);
    assert.strictEqual(F.addrOf(topic).toLowerCase(), a.toLowerCase());
    checks++;
  }
  step('50 addresses read back out of padded log topics');
}

/* ── the string decoder, against ethers ────────────────────────────────── */
{
  const CASES = [
    '', 'Proxima', 'PXM',
    'ライオン',                                   // multi-byte
    '🚀🌕 to the moon',                          // outside the basic plane
    'Ünïcödé Çoin',
    'x'.repeat(31), 'y'.repeat(32), 'z'.repeat(33),  // the word boundary
    'w'.repeat(200),                              // several words
    'a description with "quotes", commas and \\ backslashes'
  ];
  const coder = E.AbiCoder.defaultAbiCoder();

  for (const s of CASES) {
    const enc = coder.encode(['string'], [s]);
    assert.strictEqual(F.readString(enc, 0), s, `single string: ${JSON.stringify(s.slice(0, 24))}`);
    checks++;
  }
  step(`${CASES.length} strings decode exactly as ethers encodes them`);

  /* getTokenInfo returns (address, string, string, Socials), and feed.js reads
     the logo and description out of positions 1 and 2. A decoder that assumed
     the payload starts at the first word would read the address as an offset. */
  for (const logo of CASES.slice(0, 6)) {
    for (const desc of ['', 'short', 'q'.repeat(120), '説明です']) {
      const enc = coder.encode(
        ['address', 'string', 'string', 'tuple(string,string,string,string,string)'],
        ['0x' + '11'.repeat(20), logo, desc, ['a', 'b', 'c', 'd', 'e']]);
      assert.strictEqual(F.readString(enc, 1), logo, 'logo at slot 1');
      assert.strictEqual(F.readString(enc, 2), desc, 'description at slot 2');
      checks += 2;
    }
  }
  step('logo and description come back from the right slots of getTokenInfo');
}

/* ── the addresses it reads from ───────────────────────────────────────── */
{
  assert.strictEqual(E.getAddress(F.FACTORY), F.FACTORY,
    'the factory address is not in checksum form, so a typo would go unnoticed');
  assert.ok(F.RPC.startsWith('https://'), 'the RPC must be https');
  assert.ok(F.EXPLORER.startsWith('https://'), 'the explorer must be https');
  checks += 3;
  step('factory checksum valid, RPC and explorer both https');
}

console.log(`\n${checks} checks passed.`);
