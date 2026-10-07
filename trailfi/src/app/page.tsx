import { PayoutTicker } from "@/components/landing/PayoutTicker";
import { CallToAction } from "@/components/landing/CallToAction";
import { DemoLoop } from "@/components/landing/DemoLoop";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Leaderboard } from "@/components/landing/Leaderboard";
import { Navbar } from "@/components/landing/Navbar";
import { RewardsSection } from "@/components/landing/RewardsSection";
import { WeeklyRanking } from "@/components/landing/WeeklyRanking";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <PayoutTicker />
        <DemoLoop />
        <HowItWorks />
        <RewardsSection />
        <WeeklyRanking />
        <Leaderboard />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
