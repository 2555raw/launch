import { z } from "zod";
import { clientIp, isValidPublicKey, issueWalletNonce } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  if (!(await rateLimit(`nonce:${clientIp(req)}`, 30, 300))) return fail(429, "Slow down");
  const { address } = await parseBody(req, z.object({ address: z.string().min(32).max(44) }));
  if (!isValidPublicKey(address)) return fail(400, "Not a valid Solana address");
  return json(await issueWalletNonce(address));
});
