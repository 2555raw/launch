import { CallToAction } from "@/components/landing/CallToAction";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Leaderboard } from "@/components/landing/Leaderboard";
import { Navbar } from "@/components/landing/Navbar";
import { RewardsSection } from "@/components/landing/RewardsSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <RewardsSection />
        <Leaderboard />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
