import { isAddress, verifyMessage, type Hex } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { z } from "zod";
import { HttpError, clientIp, json, rateLimit, readJson, route } from "@/lib/api";
import { SIWE_STATEMENT } from "@/lib/auth/constants";
import { consumeNonceCookie, createSession } from "@/lib/auth/session";
import { upsertOnLogin } from "@/lib/services/users";
import { publicClient } from "@/lib/web3/server";
import { SUPPORTED_CHAINS } from "@/lib/web3/chains";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/**
 * Sign-In With Ethereum (EIP-4361). The user signs a plain-text message — no
 * transaction, no gas, no token approval — which proves they control the
 * address. The address is then registered and a session cookie issued.
 */
export const POST = route(async (req) => {
  rateLimit(`verify:${clientIp(req)}`, 20, 60_000);
  const { message, signature } = bodySchema.parse(await readJson(req));
  const nonce = await consumeNonceCookie();
  if (!nonce) throw new HttpError(401, "Sign-in request expired. Please try again.", "nonce_expired");

  const parsed = parseSiweMessage(message);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!parsed.address || !isAddress(parsed.address)) throw new HttpError(400, "Invalid sign-in message.", "bad_message");
  if (parsed.statement !== SIWE_STATEMENT) throw new HttpError(400, "Unexpected sign-in statement.", "bad_statement");
  if (!parsed.chainId || !SUPPORTED_CHAINS[parsed.chainId]) throw new HttpError(400, "Unsupported network.", "bad_chain");
  const valid = validateSiweMessage({ message: parsed, domain: host, nonce });
  if (!valid) throw new HttpError(401, "Sign-in message is invalid or expired.", "bad_message");

  // EOAs verify locally; smart-contract wallets (ERC-1271 / ERC-6492) fall back to an RPC check.
  let ok = await verifyMessage({ address: parsed.address, message, signature: signature as Hex }).catch(() => false);
  if (!ok) {
    ok = await publicClient()
      .verifyMessage({ address: parsed.address, message, signature: signature as Hex })
      .catch(() => false);
  }
  if (!ok) throw new HttpError(401, "Signature does not match the wallet.", "bad_signature");

  const user = await upsertOnLogin(parsed.address);
  if (user.status !== "active") throw new HttpError(403, "This account is suspended.", "suspended");
  await createSession({ userId: user.id, address: user.walletAddress, role: user.role });
  return json({ user: { id: user.id, walletAddress: user.walletAddress, role: user.role } });
});
