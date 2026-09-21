import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { optionalMerchant } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { ProfileForm } from "./ProfileForm";
import { Icon, type IconName } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Status";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Settings · Payence" };

const LINKS: { href: string; label: string; body: string; icon: IconName }[] = [
  { href: "/settings/security", label: "Security", body: "Password, two-factor, devices and limits", icon: "shield" },
  { href: "/settings/verification", label: "Identity", body: "Verify to raise your payment limits", icon: "user" },
  { href: "/notifications", label: "Notifications", body: "Everything the account has told you", icon: "bell" },
  { href: "/settings/support", label: "Support", body: "Report a problem with a payment", icon: "globe" },
];

export default function SettingsPage({ searchParams }: { searchParams: { frozen?: string } }) {
  const { user } = requireAuth();
  const merchant = optionalMerchant(user.id);

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="space-y-5 px-5 md:px-1">
        {searchParams.frozen === "1" && (
          <Alert tone="error" title="This account is frozen.">
            Payments are blocked while a review is open. Contact support to find out what is needed.
          </Alert>
        )}

        <section className="card px-5 py-5">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-canvas">
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold">{user.name}</p>
              <p className="truncate text-[13px] text-muted">
                @{user.handle} · {user.email}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={user.kycTier > 0 ? "positive" : "warning"}>
              {user.kycTier > 0 ? "Identity verified" : "Unverified"}
            </Badge>
            <Badge tone={user.totpEnabledAt ? "positive" : "neutral"}>
              {user.totpEnabledAt ? "Two-factor on" : "Two-factor off"}
            </Badge>
          </div>
        </section>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Profile</h2>
          <div className="mt-4">
            <ProfileForm name={user.name} displayCurrency={user.displayCurrency} />
          </div>
        </section>

        <nav className="card divide-y divide-hair overflow-hidden">
          {LINKS.map((l) => {
            const I = Icon[l.icon];
            return (
              <Link key={l.href} href={l.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-shell/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shell text-ink">
                  <I className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{l.label}</span>
                  <span className="block truncate text-[12.5px] text-muted">{l.body}</span>
                </span>
                <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            );
          })}
        </nav>

        <section className="card px-5 py-5">
          <h2 className="text-[15px] font-semibold">Accepting payments</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {merchant
              ? `You run ${merchant.name} on Payence.`
              : "Take stablecoin payments in a shop or on your website, with settlement into this account."}
          </p>
          <Button href="/merchant" variant="secondary" size="md" className="mt-4">
            {merchant ? "Merchant dashboard" : "Set up a merchant account"}
          </Button>
        </section>

        <form action={logoutAction} className="pb-4">
          <Button type="submit" variant="secondary" size="md" full>
            <Icon.logout className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
