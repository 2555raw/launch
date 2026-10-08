import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "./db";
import { redis } from "./redis";
import { env } from "./env";

const scrypt = promisify(scryptCb);
export const SESSION_COOKIE = "foundry_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.authSession.create({ data: { token, userId, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  return { token, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", expires: expiresAt });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: 0 });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function getUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.authSession.findUnique({ where: { token }, include: { user: { include: { wallets: true } } } });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.user;
}

export async function requireUser(req: NextRequest) {
  const u = await getUser(req);
  if (!u) throw new HttpError(401, "Sign in to play");
  return u;
}

export async function requireAdmin(req: NextRequest) {
  const u = await requireUser(req);
  if (u.role !== "ADMIN") throw new HttpError(403, "Admin only");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

// ---------------------------------------------------------------------------
// Sign-In-With-Solana style wallet authentication
// ---------------------------------------------------------------------------

export function isValidPublicKey(address: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(address).toBytes());
  } catch {
    return false;
  }
}

export async function issueWalletNonce(address: string) {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const host = new URL(env.appUrl).host;
  const message =
    `FOUNDRY wants you to sign in with your Solana account:\n${address}\n\n` +
    `Signing this message proves you control the wallet. It costs nothing and sends no transaction.\n\n` +
    `Domain: ${host}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
  await redis.set(`walletnonce:${address}:${nonce}`, message, "EX", 300);
  return { nonce, message };
}

export async function verifyWalletSignature(address: string, nonce: string, signatureB58: string): Promise<boolean> {
  const key = `walletnonce:${address}:${nonce}`;
  const message = await redis.get(key);
  if (!message) return false;
  await redis.del(key); // one-time use
  try {
    const sig = bs58.decode(signatureB58);
    const pub = new PublicKey(address).toBytes();
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch {
    return false;
  }
}

export function publicUser(u: { id: string; username: string; role: string; passwordHash?: string | null; wallets: { address: string }[] }) {
  return { id: u.id, username: u.username, role: u.role, hasPassword: !!u.passwordHash, wallets: u.wallets.map((w) => w.address) };
}
