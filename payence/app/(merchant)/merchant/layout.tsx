import type { ReactNode } from "react";
import { requireAuth, optionalMerchant } from "@/lib/auth/guard";
import { MerchantShell } from "@/components/app/MerchantShell";

/**
 * Without a merchant account there is nothing to frame, so onboarding renders
 * bare; every other page under /merchant calls requireMerchant() and is sent
 * to onboarding if there is none.
 */
export default function MerchantLayout({ children }: { children: ReactNode }) {
  const { user } = requireAuth("/merchant");
  const merchant = optionalMerchant(user.id);
  if (!merchant) return <>{children}</>;
  return <MerchantShell merchant={{ name: merchant.name, status: merchant.status }}>{children}</MerchantShell>;
}
