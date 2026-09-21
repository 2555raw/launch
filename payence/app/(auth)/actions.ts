"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createUser, userByEmail } from "@/lib/services/users";
import { verifyPassword, passwordProblem } from "@/lib/auth/password";
import { createSession, destroySession, requestIp, requestUserAgent, markSessionMfaPassed, currentAuth } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/auth/rateLimit";
import { verifyTotp } from "@/lib/auth/totp";
import { decrypt } from "@/lib/auth/crypto";
import { audit } from "@/lib/services/audit";

export type FormState = { error?: string; field?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Choose a password."),
  country: z.string().trim().length(2).optional().or(z.literal("")),
});

/** A safe internal redirect target: never an absolute URL an attacker supplied. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = requestIp() ?? "unknown";
  if (!rateLimit(`signup:${ip}`, LIMITS.signup.limit, LIMITS.signup.windowMs).ok) {
    return { error: "Too many sign-ups from this network. Try again later." };
  }
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first.message, field: String(first.path[0]) };
  }
  const weak = passwordProblem(parsed.data.password, parsed.data.email);
  if (weak) return { error: weak, field: "password" };

  const result = await createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
    country: parsed.data.country || undefined,
  });
  if (!result.ok) return { error: result.message, field: result.code === "EXISTS" ? "email" : undefined };

  createSession(result.user.id, { mfaPassed: true, userAgent: requestUserAgent(), ip: requestIp() });
  redirect(safeNext(formData.get("next")));
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = requestIp() ?? "unknown";

  // Limited per address and per account, so neither a spray nor a focused
  // attack on one account gets unlimited attempts.
  if (!rateLimit(`login:${ip}`, LIMITS.login.limit, LIMITS.login.windowMs).ok) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  if (!rateLimit(`login:acct:${email}`, LIMITS.login.limit, LIMITS.login.windowMs).ok) {
    return { error: "Too many attempts on this account. Try again in a few minutes." };
  }

  const user = userByEmail(email);
  // The same message either way: a different one tells an attacker which
  // addresses have accounts.
  const invalid = { error: "That email and password do not match." };
  if (!user) return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) {
    audit({ type: "user", id: user.id }, "login.failed", undefined, { ip });
    return invalid;
  }
  if (user.status === "closed") return { error: "This account is closed." };

  const needsMfa = Boolean(user.totpEnabledAt);
  createSession(user.id, { mfaPassed: !needsMfa, userAgent: requestUserAgent(), ip: requestIp() });
  audit({ type: "user", id: user.id }, needsMfa ? "login.password_ok" : "login.success", undefined, { ip });
  redirect(needsMfa ? "/login/verify" : safeNext(formData.get("next")));
}

export async function verifyMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = currentAuth();
  if (!auth) redirect("/login");
  if (!rateLimit(`totp:${auth.user.id}`, LIMITS.totp.limit, LIMITS.totp.windowMs).ok) {
    return { error: "Too many codes tried. Wait a few minutes." };
  }
  const code = String(formData.get("code") ?? "");
  if (!auth.user.totpSecret || !verifyTotp(decrypt(auth.user.totpSecret, "totp"), code)) {
    audit({ type: "user", id: auth.user.id }, "mfa.failed");
    return { error: "That code is not right. Check your authenticator app." };
  }
  markSessionMfaPassed(auth.session.id);
  audit({ type: "user", id: auth.user.id }, "mfa.passed");
  redirect("/dashboard");
}

export async function logoutAction() {
  const auth = currentAuth();
  if (auth) audit({ type: "user", id: auth.user.id }, "logout");
  destroySession();
  redirect("/");
}
