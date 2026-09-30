import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <InfoPage label="Legal" title="Terms of Service" intro="Template terms for the pre-launch version of TrailFi. Have them reviewed by counsel before launch.">
      <Section title="Eligibility and accounts">
        <p>You must be of legal age in your jurisdiction. Your account is identified by the public address of your wallet; you are responsible for securing that wallet.</p>
      </Section>
      <Section title="Rewards are not guaranteed">
        <p>
          Rewards depend on eligible platform fees, the configured distribution rules and the verified activity of all
          participants. Estimates shown in the product are projections, not promises. TrailFi may withhold rewards
          associated with manipulated, duplicated or unverifiable activity.
        </p>
      </Section>
      <Section title="Fair use">
        <p>Using devices, scripts or other means to fake activity, or operating multiple accounts, leads to rejected rewards and account suspension.</p>
      </Section>
      <Section title="No financial advice">
        <p>Nothing on TrailFi is investment, legal or tax advice. You are responsible for any taxes on rewards you receive.</p>
      </Section>
    </InfoPage>
  );
}
