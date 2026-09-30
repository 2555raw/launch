import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <InfoPage label="Legal" title="Privacy Policy" intro="What Stepit stores, why, and what it never touches.">
      <Section title="What we store">
        <ul>
          <li>Your public wallet address, to identify you and send rewards.</li>
          <li>Daily step counts, their source and verification status.</li>
          <li>Reward and payout records, including public transaction hashes.</li>
          <li>A security audit log of sign-ins and administrative actions.</li>
        </ul>
      </Section>
      <Section title="What we never store">
        <p>Seed phrases, private keys, wallet passwords, or detailed health data beyond daily step totals. We never request token approvals.</p>
      </Section>
      <Section title="Public data">
        <p>Blockchain transactions are public by nature. The leaderboard shows shortened wallet addresses only.</p>
      </Section>
      <Section title="Your rights">
        <p>You can request export or deletion of your off-chain data via the contact page. On-chain records cannot be deleted by anyone.</p>
      </Section>
    </InfoPage>
  );
}
