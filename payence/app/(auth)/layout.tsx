import Link from "next/link";
import type { ReactNode } from "react";

/** Auth pages are their own frame: no app chrome, one column, centred. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-5 py-6 md:px-10">
        <Link href="/" className="text-[19px] font-extrabold tracking-[-0.04em]">
          PAYENCE
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 md:items-center md:pb-24">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <footer className="px-5 pb-8 text-center text-[12px] text-muted md:px-10">
        <Link href="/legal/terms" className="hover:text-ink">
          Terms
        </Link>
        <span className="px-2">·</span>
        <Link href="/legal/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
