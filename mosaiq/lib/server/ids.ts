import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { site } from "@/lib/site";

const alphabet = "0123456789abcdefghijkmnpqrstuvwxyz";

export function newId(prefix: string, length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}_${out}`;
}

/** A fresh agent key. Only its SHA-256 is stored; the key itself is shown once. */
export function newAgentKey(): { key: string; hash: string; prefix: string } {
  const key = site.keyPrefix + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), prefix: key.slice(0, site.keyPrefix.length + 4) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
