import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (p: string | Buffer, s: Buffer, k: number, o?: object) => Promise<Buffer>;

// Node's scrypt with parameters in the OWASP range. Argon2id is preferable in
// production; it needs a native dependency, so this is the strong default that
// ships with the runtime.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt") return false;
  const derived = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), KEYLEN, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 96 * 1024 * 1024,
  });
  const expected = Buffer.from(key, "base64");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Rejects the passwords that show up in every breach corpus, plus the basics. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  const lower = password.toLowerCase();
  if (email && lower.includes(email.split("@")[0].toLowerCase())) return "Do not use your email address in your password.";
  const common = ["password", "12345678", "qwertyui", "letmein", "iloveyou", "payence"];
  if (common.some((c) => lower.includes(c))) return "That password is too easy to guess.";
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  return null;
}
