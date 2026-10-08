import { z } from "zod";
import { prisma } from "@/server/db";
import { clientIp, createSession, getUser, isValidPublicKey, publicUser, setSessionCookie, verifyWalletSignature } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

const schema = z.object({ address: z.string().min(32).max(44), nonce: z.string().min(8).max(64), signature: z.string().min(16).max(200) });

/**
 * Verifies the signed nonce. Then:
 *   - wallet already linked to an account  -> sign that account in
 *   - caller signed in, wallet unlinked    -> link it to the caller's account
 *   - nobody signed in, wallet unlinked    -> create an account for the wallet
 */
export const POST = handler(async (req) => {
  if (!(await rateLimit(`verify:${clientIp(req)}`, 30, 300))) return fail(429, "Slow down");
  const { address, nonce, signature } = await parseBody(req, schema);
  if (!isValidPublicKey(address)) return fail(400, "Not a valid Solana address");
  if (!(await verifyWalletSignature(address, nonce, signature))) return fail(401, "Signature did not verify");

  const linked = await prisma.wallet.findUnique({ where: { address }, include: { user: { include: { wallets: true } } } });
  const current = await getUser(req);

  if (linked) {
    if (current && current.id !== linked.userId) return fail(409, "That wallet is linked to another account. Sign out first to use it.");
    const s = await createSession(linked.userId, req.headers.get("user-agent"));
    const res = json({ user: publicUser(linked.user), action: "signed_in" });
    setSessionCookie(res, s.token, s.expiresAt);
    return res;
  }

  if (current) {
    await prisma.wallet.create({ data: { address, userId: current.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id }, include: { wallets: true } });
    return json({ user: publicUser(user), action: "linked" });
  }

  // brand new account named after the wallet
  let username = `sol_${address.slice(0, 6)}`;
  let n = 0;
  while (await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })) username = `sol_${address.slice(0, 6)}_${++n}`;
  const user = await prisma.user.create({ data: { username, wallets: { create: { address } } }, include: { wallets: true } });
  const s = await createSession(user.id, req.headers.get("user-agent"));
  const res = json({ user: publicUser(user), action: "created" });
  setSessionCookie(res, s.token, s.expiresAt);
  return res;
});
