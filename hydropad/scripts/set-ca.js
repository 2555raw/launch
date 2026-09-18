/* Publish the contract address the header carries.
 *
 *   node scripts/set-ca.js 0x…            # set it
 *   node scripts/set-ca.js --clear        # back to "pending"
 *   node scripts/set-ca.js --show         # what is published right now
 *
 * One address, the same for every visitor. It is checksummed before it goes
 * in, because an address with one character wrong is an address that sends
 * somebody's money to nobody, and the header is exactly where people copy it
 * from.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const FILE = path.join(__dirname, "..", "app.js");
const FIELD = /(\n  address:\s*)"([^"]*)"/;

const read = () => fs.readFileSync(FILE, "utf8");
const current = src => (FIELD.exec(src) || [, , ""])[2];

function write(src, value) {
  if (!FIELD.test(src)) {
    console.error("SITE_CA.address is not where it was. Fix scripts/set-ca.js before shipping.");
    process.exit(1);
  }
  fs.writeFileSync(FILE, src.replace(FIELD, `$1"${value}"`));
}

const arg = process.argv[2];
const src = read();

if (!arg || arg === "--show") {
  const a = current(src);
  console.log(a ? `published: ${a}` : "published: nothing — the header reads \"pending\"");
  process.exit(0);
}

if (arg === "--clear") {
  write(src, "");
  console.log("cleared — the header reads \"pending\" again");
  process.exit(0);
}

if (!ethers.isAddress(arg)) {
  console.error(`\n"${arg}" is not an address.\n\n` +
    "It has to be 42 characters starting 0x, and if it carries capitals they have to\n" +
    "be the right ones: a mixed-case address is its own checksum, and this refuses a\n" +
    "wrong one rather than putting it in the header for people to copy.\n");
  process.exit(1);
}

const addr = ethers.getAddress(arg);           // checksummed, whatever came in
write(src, addr);
console.log(`\npublished ${addr}`);
if (addr !== arg) console.log(`(checksummed from ${arg})`);
console.log(`
The header now carries it on every page, with the copy button and the link to
  https://robinhoodchain.blockscout.com/token/${addr}

Next: npm test && npm run e2e, then commit and push.
`);
