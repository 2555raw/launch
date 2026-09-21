import "server-only";
import { cookies, headers } from "next/headers";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { id, token } from "@/lib/ids";
import { sha256 } from "./crypto";
import { IS_PROD } from "@/lib/config";

export const SESSION_COOKIE = "payence_session";
const SESSION_TTL = 30 * 24 * 60 * 60_000; // 30 days
const IDLE_TTL = 12 * 60 * 60_000; // re-auth after half a day idle

/**
 * Sessions are opaque random tokens in an httpOnly, SameSite=Lax, Secure cookie.
 * Only the SHA-256 of the token is stored, so a database leak does not hand an
 * attacker live sessions. SameSite=Lax plus Next's server actions (which carry
 * their own origin check) is what defends against CSRF.
 */
export function createSession(userId: string, opts: { mfaPassed: boolean; userAgent?: string; ip?: string }) {
  const raw = token(32);
  const now = Date.now();
  getDb()
    .insert(schema.sessions)
    .values({
      id: sha256(raw),
      userId,
      createdAt: now,
      expiresAt: now + SESSION_TTL,
      lastSeenAt: now,
      mfaPassed: opts.mfaPassed,
      userAgent: opts.userAgent?.slice(0, 300),
      ip: opts.ip,
    })
    .run();
  cookies().set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: SESSION_TTL / 1000,
  });
  return raw;
}

export type Auth = { user: schema.User; session: schema.Session };

/** Per-request memo: several server components ask for the user on one render. */
export const currentAuth = cache((): Auth | null => {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const db = getDb();
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sha256(raw))).get();
  if (!session || session.revokedAt) return null;
  const now = Date.now();
  if (session.expiresAt <= now || now - session.lastSeenAt > IDLE_TTL) return null;
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
  if (!user || user.status === "closed") return null;
  // Touch at most once a minute: a write on every render is wasteful.
  if (now - session.lastSeenAt > 60_000) {
    db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, session.id)).run();
  }
  return { user, session };
});

export function currentUser(): schema.User | null {
  return currentAuth()?.user ?? null;
}

export function destroySession() {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (raw) {
    getDb()
      .update(schema.sessions)
      .set({ revokedAt: Date.now() })
      .where(eq(schema.sessions.id, sha256(raw)))
      .run();
  }
  cookies().delete(SESSION_COOKIE);
}

export function listSessions(userId: string) {
  return getDb()
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)))
    .orderBy(desc(schema.sessions.lastSeenAt))
    .all()
    .filter((s) => s.expiresAt > Date.now());
}

export function revokeSession(userId: string, sessionId: string) {
  getDb()
    .update(schema.sessions)
    .set({ revokedAt: Date.now() })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)))
    .run();
}

export function revokeOtherSessions(userId: string, keepSessionId: string) {
  getDb()
    .update(schema.sessions)
    .set({ revokedAt: Date.now() })
    .where(and(eq(schema.sessions.userId, userId), sql`${schema.sessions.id} != ${keepSessionId}`))
    .run();
}

export function markSessionMfaPassed(sessionId: string) {
  getDb().update(schema.sessions).set({ mfaPassed: true }).where(eq(schema.sessions.id, sessionId)).run();
}

export function requestIp(): string | undefined {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || undefined;
}

export function requestUserAgent(): string | undefined {
  return headers().get("user-agent") || undefined;
}
