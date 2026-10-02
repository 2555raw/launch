import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { Footer } from "@/components/landing/Footer";

/**
 * Frame for the walker pages (dashboard, upload steps): navigation in a left
 * sidebar, wallet in a slim top bar. The landing's top menu stays on the
 * main site only.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950">
      <div className="pointer-events-none fixed -left-40 top-0 h-[500px] w-[500px] rounded-full bg-forest-600/15 blur-[140px]" />
      <AppNav />
      <div className="relative overflow-hidden lg:pl-64">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-cover bg-center opacity-[0.16]"
          style={{ backgroundImage: "url(/images/hero-trail-1280.webp)" }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-gradient-to-b from-ink-950/40 via-ink-950/80 to-ink-950" />
        <main className="relative mx-auto max-w-[1240px] px-4 pb-24 pt-8 sm:px-8 lg:pt-10">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
