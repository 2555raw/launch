import type { ReactNode } from "react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

export function InfoPage({ label, title, intro, children }: { label: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pb-24 pt-36">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-forest-600/25 blur-[120px]" />
        <div className="container relative max-w-3xl">
          <div className="label !text-lime-300">{label}</div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.02em] sm:text-6xl">{title}</h1>
          {intro && <p className="mt-6 text-lg leading-relaxed text-white/65">{intro}</p>}
          <div className="prose-trail mt-12 space-y-10">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-white/65 [&_code]:rounded-md [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-lime-200 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-white/90">
        {children}
      </div>
    </section>
  );
}
