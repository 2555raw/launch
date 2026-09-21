import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** The checkout is its own surface: no app chrome, nothing to click away to. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-shell">{children}</div>;
}
