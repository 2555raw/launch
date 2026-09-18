/* Validating and checksumming an address, in one place.
 *
 * Both the setter and the publisher need this, and an address check that
 * exists twice is an address check that will disagree with itself.
 */
let keccak_256;
try { ({ keccak_256 } = require("js-sha3")); } catch (e) { keccak_256 = null; }

/* EIP-55: the capitalisation of a hex address is a checksum, so a typo in
   a mixed-case address is visible instead of silent. */
function checksum(addr) {
  const body = addr.slice(2).toLowerCase();
  if (!keccak_256) return "0x" + body;
  const hash = keccak_256(body);
  return "0x" + [...body].map((c, i) =>
    parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join("");
}

/* Returns the checksummed address, or throws with a reason a human can act
   on rather than a boolean. */
function parse(raw) {
  const arg = String(raw || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(arg))
    throw new Error(`"${arg}" is not a 20 byte address: expected 0x and 40 hex characters.`);

  const out = checksum(arg);
  const mixed = /[A-F]/.test(arg.slice(2)) && /[a-f]/.test(arg.slice(2));
  if (keccak_256 && mixed && arg !== out)
    throw new Error("that address is mixed case and fails its EIP-55 checksum.\n" +
                    "  given:    " + arg + "\n  expected: " + out);
  return out;
}

module.exports = { parse, checksum, hasKeccak: Boolean(keccak_256) };
