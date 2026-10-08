import { prisma } from "@/server/db";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/auth";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { token } });
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
