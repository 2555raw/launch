"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { updateUser } from "@/lib/services/users";
import { audit } from "@/lib/services/audit";
import { encrypt, decrypt } from "@/lib/auth/crypto";
import { generateSecret, verifyTotp } from "@/lib/auth/totp";
import { verifyPassword, hashPassword, passwordProblem } from "@/lib/auth/password";
import { revokeOtherSessions, revokeSession, markSessionMfaPassed } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/auth/rateLimit";
import { compliance } from "@/lib/providers/compliance";
import { notify } from "@/lib/services/notifications";
import { isFiat } from "@/lib/assets";

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user } = requireAuth();
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your full name.").max(80),
      displayCurrency: z.string().refine(isFiat, "Pick a currency."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  updateUser(user.id, parsed.data);
  audit({ type: "user", id: user.id }, "profile.updated");
  revalidatePath("/settings");
  return { ok: "Saved." };
}

export async function updateLimitAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user } = requireAuth();
  const raw = String(formData.get("dailyLimit") ?? "").trim();
  if (raw === "") {
    updateUser(user.id, { dailyLimitCents: null });
    audit({ type: "user", id: user.id }, "limit.cleared");
    revalidatePath("/settings/security");
    return { ok: "Your own daily limit was removed. The limit for your level still applies." };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter an amount greater than zero." };
  updateUser(user.id, { dailyLimitCents: Math.round(value * 100) });
  audit({ type: "user", id: user.id }, "limit.set", undefined, { metadata: { dailyLimit: value } });
  revalidatePath("/settings/security");
  return { ok: "Daily limit saved." };
}

export async function changePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user, session } = requireAuth();
  if (!rateLimit(`pwd:${user.id}`, 5, 15 * 60_000).ok) return { error: "Too many attempts. Try again later." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password is not right." };
  const weak = passwordProblem(next, user.email);
  if (weak) return { error: weak };

  updateUser(user.id, { passwordHash: await hashPassword(next) });
  // A password change invalidates every other session: that is the point of it.
  revokeOtherSessions(user.id, session.id);
  audit({ type: "user", id: user.id }, "password.changed");
  notify(user.id, {
    kind: "security",
    title: "Your password was changed",
    body: "Every other signed-in device was signed out. If this was not you, contact support now.",
    href: "/settings/security",
  });
  revalidatePath("/settings/security");
  return { ok: "Password changed. Other devices were signed out." };
}

/** Step one of enabling 2FA: mint a secret, store it encrypted, but not enabled. */
export async function beginTotpAction(): Promise<void> {
  const { user } = requireAuth();
  if (user.totpEnabledAt) return;
  updateUser(user.id, { totpSecret: encrypt(generateSecret(), "totp") });
  revalidatePath("/settings/security");
}

export async function enableTotpAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user, session } = requireAuth();
  if (!rateLimit(`totp:setup:${user.id}`, LIMITS.totp.limit, LIMITS.totp.windowMs).ok) {
    return { error: "Too many codes tried. Wait a few minutes." };
  }
  if (!user.totpSecret) return { error: "Start the setup again." };
  const code = String(formData.get("code") ?? "");
  if (!verifyTotp(decrypt(user.totpSecret, "totp"), code)) {
    return { error: "That code is not right. Check your authenticator app and try again." };
  }
  updateUser(user.id, { totpEnabledAt: Date.now() });
  markSessionMfaPassed(session.id);
  audit({ type: "user", id: user.id }, "mfa.enabled");
  notify(user.id, {
    kind: "security",
    title: "Two-factor authentication is on",
    body: "You will be asked for a code from your authenticator app when you sign in.",
    href: "/settings/security",
  });
  revalidatePath("/settings/security");
  return { ok: "Two-factor authentication is on." };
}

export async function disableTotpAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user } = requireAuth();
  const password = String(formData.get("password") ?? "");
  // Turning off a security control requires the password, not just a session.
  if (!(await verifyPassword(password, user.passwordHash))) return { error: "That password is not right." };
  updateUser(user.id, { totpSecret: null, totpEnabledAt: null });
  audit({ type: "user", id: user.id }, "mfa.disabled");
  notify(user.id, {
    kind: "security",
    title: "Two-factor authentication is off",
    body: "If this was not you, turn it back on and change your password now.",
    href: "/settings/security",
  });
  revalidatePath("/settings/security");
  return { ok: "Two-factor authentication is off." };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const { user, session } = requireAuth();
  const target = String(formData.get("sessionId") ?? "");
  if (target === session.id) redirect("/settings/security");
  revokeSession(user.id, target);
  audit({ type: "user", id: user.id }, "session.revoked", { type: "session", id: target });
  revalidatePath("/settings/security");
}

export async function revokeOthersAction(): Promise<void> {
  const { user, session } = requireAuth();
  revokeOtherSessions(user.id, session.id);
  audit({ type: "user", id: user.id }, "sessions.revoked_all");
  revalidatePath("/settings/security");
}

export async function startKycAction(): Promise<void> {
  const { user } = requireAuth();
  const result = await compliance().startKyc({ userId: user.id, email: user.email });
  updateUser(user.id, { kycStatus: result.status === "approved" ? "approved" : "pending" });
  audit({ type: "user", id: user.id }, "kyc.started");
  revalidatePath("/settings/verification");
  if (result.redirectUrl) redirect(result.redirectUrl);
}
