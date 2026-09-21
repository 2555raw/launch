import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { limitUsage } from "@/lib/services/limits";
import { PageHeader } from "@/components/app/PageHeader";
import { PasswordForm, TotpSection, LimitForm } from "./Forms";
import { revokeSessionAction, revokeOthersAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { FiatAmount } from "@/components/ui/Amount";
import { decrypt } from "@/lib/auth/crypto";
import { otpauthUrl } from "@/lib/auth/totp";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Security · Payence" };

export default async function SecurityPage() {
  const { user, session } = requireAuth();
  const sessions = listSessions(user.id);
  const usage = limitUsage(user);

  // The secret exists only while setup is in progress; it is decrypted here on
  // the server and reaches the browser once, as a QR and a typed key.
  const pendingSecret = user.totpSecret && !user.totpEnabledAt ? decrypt(user.totpSecret, "totp") : null;
  const pendingQr = pendingSecret ? await qrSvg(otpauthUrl(pendingSecret, user.email)) : null;

  return (
    <div>
      <PageHeader title="Security" back="/settings" />
      <div className="space-y-5 px-5 md:px-1">
        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Two-factor authentication</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            A six-digit code from your authenticator app, asked for at sign-in. A stolen password alone is then not
            enough to reach your money.
          </p>
          <div className="mt-4">
            <TotpSection enabled={Boolean(user.totpEnabledAt)} secret={pendingSecret} qr={pendingQr} />
          </div>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Password</h2>
          <div className="mt-4">
            <PasswordForm />
          </div>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Daily limit</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Your level ({usage.tier.label}) allows{" "}
            <FiatAmount cents={usage.tier.daily} currency={user.displayCurrency} /> a day. You can set a lower limit for
            yourself; raising it above the level cap needs identity verification.
          </p>
          <p className="mt-3 text-[13px] text-muted">
            Used today: <FiatAmount cents={usage.dailyUsed} currency={user.displayCurrency} /> of{" "}
            <FiatAmount cents={usage.dailyLimit} currency={user.displayCurrency} />
          </p>
          <div className="mt-4">
            <LimitForm current={usage.selfCap ? Number(usage.selfCap) / 100 : null} />
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-hair px-5 py-4">
            <h2 className="text-[15px] font-semibold">Signed-in devices</h2>
            <form action={revokeOthersAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out others
              </Button>
            </form>
          </div>
          <ul className="divide-y divide-hair">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {describeAgent(s.userAgent)}
                    {s.id === session.id && <span className="ml-2 text-[12px] font-normal text-positive">This device</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-muted">
                    {s.ip ?? "Unknown network"} · last used{" "}
                    {new Date(s.lastSeenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {s.id !== session.id && (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Sign out
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Firefox/.test(ua) ? "Firefox" : /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
