/* Does public/pons.js describe the contract Pons actually deployed?
 *
 * On the Solana side there was a published SDK to compare bytes against. Here
 * there is not, and ethers is the encoder rather than an independent witness,
 * so "ethers agreed with itself" would prove nothing. Three things are checked
 * that ethers cannot fake:
 *
 *   1. The selector, recomputed from the canonical signature with keccak-256
 *      and compared against what ethers derives from the ABI.
 *   2. The struct, read out of Pons's own Solidity source at the path named in
 *      the repository, field by field and in order. Two strings swapped is a
 *      coin whose name is its description, and nothing about that is fixable
 *      afterwards.
 *   3. A round trip: encode a launch, decode it back, and confirm every value
 *      landed in the field it was given to.
 *
 *   PONS_SRC=/path/to/ponsfamily node test/pons.js
 *
 * Without PONS_SRC the source check is skipped and says so, rather than
 * passing quietly.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MODS = process.env.PONS_MODULES || path.join(__dirname, 'node_modules');
const E = require(path.join(MODS, 'ethers')).ethers || require(path.join(MODS, 'ethers'));

global.window = global;
if (!global.crypto) global.crypto = require('crypto').webcrypto;
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'pons.js'), 'utf8'));
const PONS = window.WARD_PONS;

let checks = 0;
const step = m => console.log('  ▸ ' + m);

/* ── 1. the selector, from the signature rather than from the library ──── */
const SIG = 'launchToken((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address)';
{
  const mine = E.keccak256(E.toUtf8Bytes(SIG)).slice(0, 10);
  const theirs = PONS.iface(E).getFunction('launchToken').selector;
  assert.strictEqual(theirs, mine, `selector: ethers says ${theirs}, keccak of the signature says ${mine}`);
  checks++;
  step(`selector ${mine} matches keccak-256 of the canonical signature`);
}

/* ── 2. the struct, against Pons's own source ──────────────────────────── */
const SRC = process.env.PONS_SRC;
if (!SRC) {
  console.log('  ! PONS_SRC not set: the struct was NOT checked against Pons\'s source');
} else {
  const file = path.join(SRC, 'contractsV2', 'src', 'v2', 'PonsV2LaunchFactory.sol');
  const sol = fs.readFileSync(file, 'utf8');
  const body = sol.slice(sol.indexOf('struct TokenParams {'));
  const fields = [];
  for (const line of body.slice(0, body.indexOf('\n    }')).split('\n').slice(1)) {
    const m = line.trim().match(/^([A-Za-z0-9_.]+)\s+([A-Za-z0-9_]+);$/);
    if (m) fields.push([m[1], m[2]]);
  }
  const want = [
    ['string', 'name'], ['string', 'symbol'], ['string', 'logo'], ['string', 'description'],
    ['PonsV2LauncherToken.Socials', 'socials'], ['address', 'creatorFeeRecipient'],
    ['uint16', 'creatorTaxBps'], ['bool', 'buybackEnabled'],
    ['bytes32', 'expectedEconomics'], ['bytes32', 'salt']
  ];
  assert.deepStrictEqual(fields, want,
    'TokenParams in the deployed source is not the struct pons.js encodes');
  checks++;
  step(`TokenParams matches Pons's source, all ${fields.length} fields in order`);

  const soc = fs.readFileSync(path.join(SRC, 'contractsV2', 'src', 'v2', 'PonsV2LauncherToken.sol'), 'utf8');
  const sb = soc.slice(soc.indexOf('struct Socials {'));
  const sf = sb.slice(0, sb.indexOf('\n    }')).split('\n').slice(1)
    .map(l => (l.trim().match(/^string\s+([A-Za-z0-9_]+);$/) || [])[1]).filter(Boolean);
  assert.deepStrictEqual(sf, ['twitter', 'telegram', 'discord', 'website', 'farcaster'],
    'the Socials order in the deployed source is not the order pons.js encodes');
  checks++;
  step('Socials matches too: twitter, telegram, discord, website, farcaster');

  /* The factory address, from the repository's own deployment table. */
  const readme = fs.readFileSync(path.join(SRC, 'README.md'), 'utf8');
  const row = readme.split('\n').find(l => /PonsV2LaunchFactory/.test(l) && /0x[0-9a-fA-F]{40}/.test(l));
  assert.ok(row, 'no V2 factory row in the README');
  const addr = row.match(/0x[0-9a-fA-F]{40}/)[0];
  assert.strictEqual(addr.toLowerCase(), PONS.FACTORY.toLowerCase(),
    `factory address: pons.js has ${PONS.FACTORY}, the repository says ${addr}`);
  assert.strictEqual(E.getAddress(PONS.FACTORY), PONS.FACTORY,
    'the factory address is not in checksum form, so a typo in it would go unnoticed');
  checks += 2;
  step(`factory ${PONS.FACTORY} matches the repository, and its checksum is valid`);
}

/* ── 3. every value lands in the field it was given to ─────────────────── */
{
  const creator = '0x' + '11'.repeat(20);
  const pair = '0x' + '22'.repeat(20);
  const given = {
    name: 'Proxima', symbol: 'PXM', logo: 'https://a.io/p.png',
    description: 'A coin with a description that is not its name.',
    twitter: 'x.com/proxima', telegram: 't.me/proxima', website: 'proxima.io',
    creator, creatorTaxBps: 125, buybackEnabled: true,
    launchConfigId: 3n, pairToken: pair, launchFee: 7n
  };
  const call = PONS.launchCall(E, given);
  assert.strictEqual(call.to, PONS.FACTORY);
  assert.strictEqual(call.value, 7n);

  const [p, id, pt] = PONS.iface(E).decodeFunctionData('launchToken', call.data);
  assert.strictEqual(p.name, 'Proxima', 'name');
  assert.strictEqual(p.symbol, 'PXM', 'symbol');
  assert.strictEqual(p.logo, 'https://a.io/p.png', 'logo');
  assert.strictEqual(p.description, given.description, 'description');
  assert.strictEqual(p.socials.twitter, 'x.com/proxima', 'twitter');
  assert.strictEqual(p.socials.telegram, 't.me/proxima', 'telegram');
  assert.strictEqual(p.socials.discord, '', 'discord defaults to empty, not to another field');
  assert.strictEqual(p.socials.website, 'proxima.io', 'website');
  assert.strictEqual(p.socials.farcaster, '', 'farcaster');
  assert.strictEqual(E.getAddress(p.creatorFeeRecipient), E.getAddress(creator), 'creatorFeeRecipient');
  assert.strictEqual(Number(p.creatorTaxBps), 125, 'creatorTaxBps');
  assert.strictEqual(p.buybackEnabled, true, 'buybackEnabled');
  assert.strictEqual(p.expectedEconomics, '0x' + '0'.repeat(64), 'expectedEconomics waived');
  assert.strictEqual(id, 3n, 'launchConfigId');
  assert.strictEqual(E.getAddress(pt), E.getAddress(pair), 'pairToken');
  checks += 16;
  step('a launch encodes and decodes back with every value in its own field');

  /* Unicode survives, and the salt is not a constant. */
  const jp = PONS.launchCall(E, { ...given, name: 'ライオン', symbol: '🚀' });
  const [q] = PONS.iface(E).decodeFunctionData('launchToken', jp.data);
  assert.strictEqual(q.name, 'ライオン');
  assert.strictEqual(q.symbol, '🚀');
  const salts = new Set(Array.from({ length: 200 }, () => PONS.salt()));
  assert.strictEqual(salts.size, 200, 'the CREATE2 salt repeated, which would collide a launch');
  checks += 3;
  step('multi-byte names survive, and 200 salts are 200 different values');
}

console.log(`\n${checks} checks passed.`);
