import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Assets } from "@/components/landing/Assets";
import { UseCases } from "@/components/landing/UseCases";
import { Merchants } from "@/components/landing/Merchants";
import { Security } from "@/components/landing/Security";
import { Fees } from "@/components/landing/Fees";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export const metadata: Metadata = {
  title: "Payence — Spend stablecoins like money",
  description:
    "Hold digital euros and dollars, and pay in shops and online with them. Payments settle in seconds for a fraction of a cent, on any device.",
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Assets />
      <UseCases />
      <Merchants />
      <Fees />
      <Security />
      <Faq />
      <FinalCta />
    </>
  );
}
