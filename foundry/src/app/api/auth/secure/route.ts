import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, publicUser, requireUser } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_ ]+$/, "letters, numbers, spaces and _ only"),
  password: z.string().min(8).max(200),
});

/** Turns a guest account into a named account with a password. Keeps all progress. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  if (user.passwordHash) return fail(400, "This account already has a password");
  const { username, password } = await parseBody(req, schema);
  const taken = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" }, NOT: { id: user.id } } });
  if (taken) return fail(409, "That name is taken");
  const updated = await prisma.user.update({ where: { id: user.id }, data: { username, passwordHash: await hashPassword(password) }, include: { wallets: true } });
  return json({ user: publicUser(updated) });
});
