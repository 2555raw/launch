"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * The top-level error boundary. It never shows a stack trace or an error
 * message from the server: that can leak internals, and it means nothing to
 * the person holding the phone.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this is where an error reporter (Sentry) receives it.
    console.error("Unhandled error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[19px] font-extrabold tracking-[-0.045em]">PAYENCE</p>
      <h1 className="mt-8 text-[30px] font-extrabold tracking-[-0.035em] md:text-[38px]">Something went wrong.</h1>
      <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-muted">
        This page could not be loaded. If you were making a payment, nothing was charged unless you saw a confirmation.
        Your activity page shows what actually happened.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <Button href="/transactions" variant="secondary" size="lg">
          Check your activity
        </Button>
      </div>
      {error.digest && <p className="mt-8 font-mono text-[12px] text-faint">Reference {error.digest}</p>}
    </main>
  );
}
