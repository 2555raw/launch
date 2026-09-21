import { randomBytes, randomUUID } from "crypto";

/** Prefixed identifiers, readable in logs and URLs. */
export function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Short, human-readable codes for QR payloads and payment links. */
export function shortCode(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function token(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
