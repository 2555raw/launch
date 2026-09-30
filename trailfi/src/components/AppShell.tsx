import type { ReactNode } from "react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

/** Frame for the authenticated product pages: forest-tinted backdrop with a hint of the trail photo. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-cover bg-center opacity-[0.22]"
          style={{ backgroundImage: "url(/images/hero-trail.jpg)" }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-ink-950/40 via-ink-950/80 to-ink-950" />
        <div className="pointer-events-none absolute -left-40 top-40 -z-10 h-[400px] w-[400px] rounded-full bg-forest-600/20 blur-[120px]" />
        <main className="container relative pb-24 pt-28 sm:pt-32">{children}</main>
      </div>
      <Footer />
    </>
  );
}
