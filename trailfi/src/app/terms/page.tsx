import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <InfoPage label="Legal" title="Terms of Service" intro="The rules for using Strydo. Last updated October 5, 2026.">
      <Section title="Eligibility and accounts">
        <p>
          You must be of legal age in your jurisdiction. Your account is identified by the public address of your wallet;
          you are responsible for securing that wallet. Joining is free and does not require holding any token.
          Strydo only reads that balance and never moves it.
        </p>
      </Section>
      <Section title="Uploading steps">
        <p>
          Each day you may upload one step total with a screenshot from your phone&apos;s health or fitness app showing the
          date and the steps. Uploads are reviewed by the Strydo team, and only verified days can earn. The screenshot
          must be your own, unedited and for the day you select.
        </p>
      </Section>
      <Section title="Rewards">
        <p>
          A verified day earns a dollar amount based on its steps, according to Strydo&apos;s current rates, up to a daily
          maximum. Rates, the daily maximum, referral bonuses and any budget limits are set by Strydo and can change or be
          paused at any time; changes apply to days verified after the change. Estimates shown in the product are
          projections, not promises. Rewards are not guaranteed.
        </p>
      </Section>
      <Section title="Referrals">
        <p>
          When someone joins with your invite link and their first upload is verified, both of you receive the referral
          bonus in force at that time. Each new walker can count once. Inviting yourself or fake accounts is not allowed.
        </p>
      </Section>
      <Section title="Payouts">
        <p>
          Credited rewards can be requested from your dashboard. Each request is reviewed and paid in ETH, at the ETH price when the payout is sent, to the wallet
          you signed in with, on Robinhood Chain. Payments are final once confirmed onchain; Strydo cannot reverse a
          transfer or recover funds sent to a wallet you no longer control.
        </p>
      </Section>
      <Section title="Fair use">
        <p>
          Faking activity with devices, scripts or edited images, reusing screenshots, or operating multiple accounts
          leads to rejected uploads, withheld rewards and account suspension.
        </p>
      </Section>
      <Section title="No financial advice">
        <p>Nothing on Strydo is investment, legal or tax advice. You are responsible for any taxes on rewards you receive.</p>
      </Section>
      <Section title="Changes and contact">
        <p>
          Strydo may update these terms or end the program; the date above shows the latest version. Questions go to the
          address on the contact page.
        </p>
      </Section>
    </InfoPage>
  );
}
