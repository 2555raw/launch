"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/providers/SessionProvider";
import { ButtonLink } from "@/components/ui/Button";
import { AuthGate } from "@/components/wallet/AuthGate";

export function AdminGate({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { status, user } = useSession();
  const last = useRef(status);

  // Re-run the server-side check once the wallet signs in (or switches).
  useEffect(() => {
    if (last.current !== status && status !== "loading") router.refresh();
    last.current = status;
  }, [status, router]);

  return (
    <AppShell>
      <AuthGate
        title="Admin access"
        description="The admin panel is restricted to authorised wallets. Connect and verify an admin wallet to continue."
      >
        <div className="glass-strong mx-auto max-w-xl rounded-[32px] p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Access denied</h1>
          <p className="mt-3 text-white/60">
            {signedIn || user
              ? "This wallet is not authorised for the admin panel. Access is granted only to wallets configured on the server."
              : "Checking access…"}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/dashboard" variant="secondary">
              Go to my dashboard
            </ButtonLink>
          </div>
        </div>
      </AuthGate>
    </AppShell>
  );
}
