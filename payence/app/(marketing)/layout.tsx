import type { ReactNode } from "react";
import { MarketingNav } from "@/components/landing/Nav";
import { MarketingFooter } from "@/components/landing/Footer";
import { currentAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const signedIn = Boolean(currentAuth());
  return (
    <>
      <MarketingNav signedIn={signedIn} />
      <main id="main">{children}</main>
      <MarketingFooter />
    </>
  );
}
