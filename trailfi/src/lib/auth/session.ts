import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { NONCE_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./constants";

export interface Session {
  userId: string;
  address: `0x${string}`;
  role: "user" | "admin";
}

const key = () => new TextEncoder().encode(env.sessionSecret);

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProd,
  path: "/",
};

export async function createSession(session: Session) {
  const token = await new SignJWT({ addr: session.address, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setAudience("trailfi")
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL_SECONDS });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "trailfi", algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.addr !== "string") return null;
    return {
      userId: payload.sub,
      address: payload.addr as `0x${string}`,
      role: payload.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function issueNonceCookie(nonce: string) {
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setAudience("trailfi-nonce")
    .sign(key());
  (await cookies()).set(NONCE_COOKIE, token, { ...cookieBase, maxAge: 600 });
}

/** Returns the pending nonce and deletes it, so each nonce can be used once. */
export async function consumeNonceCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(NONCE_COOKIE)?.value;
  jar.delete(NONCE_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "trailfi-nonce", algorithms: ["HS256"] });
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}
