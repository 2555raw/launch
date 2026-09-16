/* Put the coin's contract address on the landing page.
 *
 *   node set-ca.js 0xAbC...                 sets it
 *   node set-ca.js --clear                  puts it back to PENDING
 *   node set-ca.js 0xAbC... --early         also counts it as a Ward launch
 *
 * This exists instead of editing the attribute by hand because a wrong
 * contract address on the front page is not a typo, it is people buying
 * somebody else's token on our say-so. So the address is checked before it
 * goes anywhere:
 *
 *   - the shape, which catches a truncated paste
 *   - the EIP-55 checksum, which catches a single wrong character, and which
 *     a regular expression cannot do because it needs keccak-256
 *   - the zero address and the dead address, which are never a launch
 *
 * A checksummed address that fails the checksum is refused outright. An
 * all-lowercase or all-uppercase one carries no checksum to verify, so it is
 * accepted with a warning that says exactly what was not checked, and written
 * in its checksummed form.
 *
 * --early is for a coin launched from Ward before Ward began marking its own
 * launches in the CREATE2 salt. There is no rule that can find those on chain,
 * so they are named in feed.js, and the flag adds it there in the same pass.
 */
const fs = require('fs');
const path = require('path');

let E;
try {
  E = require('ethers');
} catch {
  console.error('This needs ethers. From wallet/:  npm i ethers@6 --no-save');
  process.exit(1);
}

const PUBLIC = path.join(__dirname, 'public');
const INDEX = path.join(PUBLIC, 'index.html');
const FEED = path.join(PUBLIC, 'feed.js');

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const early = args.includes('--early');
const raw = args.find(a => !a.startsWith('--'));

if (!clear && !raw) {
  console.error('Usage: node set-ca.js 0x<40 hex> [--early]   |   node set-ca.js --clear');
  process.exit(1);
}

const DEAD = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dEaD'
].map(a => a.toLowerCase()));

function check(input) {
  const s = input.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
    fail('that is not a 20-byte address', [
      'expected 0x followed by exactly 40 hex characters',
      'got ' + s.length + ' characters' + (/^0x/.test(s) ? '' : ', and it does not start with 0x')
    ]);
  }
  if (DEAD.has(s.toLowerCase())) fail('that is the zero or burn address, not a launch', []);

  const mixed = /[a-f]/.test(s.slice(2)) && /[A-F]/.test(s.slice(2));
  let addr;
  try {
    addr = E.getAddress(s);            // throws on a bad EIP-55 checksum
  } catch {
    fail('the checksum does not match that address', [
      'one character is wrong: the capitals in an address encode a checksum',
      'paste it again from the explorer, or pass it all in lower case to skip this check'
    ]);
  }
  return { addr, checked: mixed };
}

function fail(why, notes) {
  console.error('\nRefused: ' + why);
  notes.forEach(n => console.error('  ' + n));
  console.error('\nNothing was written.\n');
  process.exit(1);
}

function edit(file, re, next, what) {
  const before = fs.readFileSync(file, 'utf8');
  if (!re.test(before)) fail('could not find ' + what + ' in ' + path.basename(file), [
    'the markup moved; set it by hand and fix this script'
  ]);
  const after = before.replace(re, next);
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

if (clear) {
  edit(INDEX, /data-ca="[^"]*"/, 'data-ca=""', 'the data-ca attribute');
  console.log('\nCleared. The chip reads PENDING again and does nothing when pressed.\n');
  process.exit(0);
}

const { addr, checked } = check(raw);

edit(INDEX, /data-ca="[^"]*"/, `data-ca="${addr}"`, 'the data-ca attribute');

let earlyDone = false;
if (early) {
  const before = fs.readFileSync(FEED, 'utf8');
  if (before.toLowerCase().includes(addr.toLowerCase())) {
    console.log('  already in the EARLY list, left alone');
    earlyDone = true;
  } else {
    const re = /(const EARLY = \[\n)/;
    if (!re.test(before)) fail('could not find the EARLY list in feed.js', []);
    fs.writeFileSync(FEED, before.replace(re, `$1    '${addr}',\n`));
    earlyDone = true;
  }
}

console.log('\nContract address set.\n');
console.log('  ' + addr);
console.log('  checksum   ' + (checked
  ? 'verified against EIP-55'
  : 'NOT verified: the address carries no capitals, so there was no checksum to check'));
console.log('  page       chip shows ' + addr.slice(0, 6) + '···' + addr.slice(-4) + ', copies the full address when pressed');
console.log('  From Ward  ' + (earlyDone
  ? 'listed by hand in feed.js, for a launch older than the salt mark'
  : 'found on chain by the WARD salt, nothing to do'));
console.log('\nNext:  node test/ca.js      then commit and push\n');
