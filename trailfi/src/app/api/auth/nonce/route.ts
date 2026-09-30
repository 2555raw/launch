import { generateSiweNonce } from "viem/siwe";
import { clientIp, json, rateLimit, route } from "@/lib/api";
import { issueNonceCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  rateLimit(`nonce:${clientIp(req)}`, 30, 60_000);
  const nonce = generateSiweNonce();
  await issueNonceCookie(nonce);
  return json({ nonce });
});
