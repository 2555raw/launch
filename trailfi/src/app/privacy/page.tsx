import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <InfoPage label="Legal" title="Privacy Policy" intro="What Strydo stores, why, and what it never touches. Last updated October 5, 2026.">
      <Section title="What we store">
        <ul>
          <li>Your public wallet address, to identify you and send rewards.</li>
          <li>The daily step totals you upload, the screenshot attached to each one, and its review status.</li>
          <li>A fingerprint of each screenshot, used only to spot the same image uploaded twice.</li>
          <li>Reward, referral and payout records, including public transaction hashes.</li>
          <li>Your email address, only if you subscribe to the newsletter.</li>
          <li>A security audit log of sign-ins and administrative actions.</li>
        </ul>
      </Section>
      <Section title="Who sees your screenshots">
        <p>Only the Strydo team, to verify your uploads. Screenshots are never shown publicly.</p>
      </Section>
      <Section title="What we never store">
        <p>
          Seed phrases, private keys, wallet passwords, or health data beyond what your screenshot shows. We never request
          token approvals.
        </p>
      </Section>
      <Section title="Cookies">
        <p>
          A session cookie keeps you signed in, and a referral cookie remembers who invited you for 30 days. No advertising
          trackers.
        </p>
      </Section>
      <Section title="Public data">
        <p>
          Blockchain transactions are public by nature. The weekly ranking and the payouts list show shortened wallet
          addresses with step totals or amounts. A step card you choose to share shows that day&apos;s steps, never your
          wallet.
        </p>
      </Section>
      <Section title="Your rights">
        <p>
          You can request export or deletion of your offchain data, screenshots included, via the contact page. Onchain
          records cannot be deleted by anyone.
        </p>
      </Section>
    </InfoPage>
  );
}
