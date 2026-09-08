import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Showcase } from "@/components/sections/Showcase";
import { Features } from "@/components/sections/Features";
import { Developers } from "@/components/sections/Developers";
import { Infrastructure } from "@/components/sections/Infrastructure";
import { Controls } from "@/components/sections/Controls";
import { Statement } from "@/components/sections/Statement";
import { Monitor } from "@/components/sections/Monitor";
import { Policy } from "@/components/sections/Policy";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { LegalDialogs } from "@/components/ui/LegalModal";
import { TermsGate } from "@/components/ui/TermsGate";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <Showcase />
        <Features />
        <Developers />
        <Infrastructure />
        <Controls />
        <Statement />
        <Monitor />
        <Policy />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <LegalDialogs />
      <TermsGate />
    </>
  );
}
