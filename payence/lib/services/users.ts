import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id } from "@/lib/ids";
import { hashPassword } from "@/lib/auth/password";
import { compliance } from "@/lib/providers/compliance";
import { audit } from "./audit";
import { notify } from "./notifications";

/** A handle is how one user finds another: unique, lowercase, readable. */
export function handleFrom(email: string, name: string): string {
  const base = (name || email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16) || "user";
  const db = getDb();
  let handle = base;
  let n = 0;
  while (db.select().from(schema.users).where(eq(schema.users.handle, handle)).get()) {
    handle = `${base}${++n}`;
  }
  return handle;
}

export async function createUser(input: { email: string; password: string; name: string; country?: string }) {
  const email = input.email.trim().toLowerCase();
  const db = getDb();
  if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
    return { ok: false as const, code: "EXISTS" as const, message: "An account already uses that email address." };
  }
  const screen = await compliance().screenUser({ userId: "pending", name: input.name, country: input.country });
  if (screen.outcome === "block") {
    return { ok: false as const, code: "COMPLIANCE" as const, message: screen.reason };
  }
  const now = Date.now();
  const row: typeof schema.users.$inferInsert = {
    id: id("usr"),
    email,
    name: input.name.trim(),
    handle: handleFrom(email, input.name),
    passwordHash: await hashPassword(input.password),
    country: input.country,
    displayCurrency: "EUR",
    kycStatus: "not_started",
    kycTier: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.users).values(row).run();
  const user = db.select().from(schema.users).where(eq(schema.users.id, row.id)).get()!;
  audit({ type: "user", id: user.id }, "user.created", { type: "user", id: user.id });
  notify(user.id, {
    kind: "account",
    title: "Welcome to Payence",
    body: "Add a stablecoin balance to start paying. Verify your identity to raise your limits.",
    href: "/wallet/deposit",
  });
  return { ok: true as const, user };
}

export function userById(userId: string) {
  return getDb().select().from(schema.users).where(eq(schema.users.id, userId)).get();
}

export function userByEmail(email: string) {
  return getDb().select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase())).get();
}

export function updateUser(userId: string, patch: Partial<typeof schema.users.$inferInsert>) {
  getDb()
    .update(schema.users)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(schema.users.id, userId))
    .run();
}
