import { z } from "zod";
import { prisma } from "@/server/db";
import { publicUser, requireUser } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const { address } = await parseBody(req, z.object({ address: z.string() }));
  if (!user.passwordHash && user.wallets.length <= 1) return fail(400, "This account has no password; keep at least one wallet linked or you could not sign in again.");
  await prisma.wallet.deleteMany({ where: { userId: user.id, address } });
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { wallets: true } });
  return json({ user: publicUser(fresh) });
});
