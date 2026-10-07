import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <InfoPage
      label="About Strydo"
      title="Built for people who'd rather be outside."
      intro="Strydo is a Web3 platform that rewards verified real world activity. Walk, hike and explore, and get paid in ETH in your own wallet."
    >
      <Section title="Why Strydo">
        <p>
          Most move to earn projects paid people in a token that only had value while new users kept buying it. Strydo
          does the opposite: every verified day earns a dollar amount, paid in <strong>ETH</strong>, so what you earn
          is worth something real the day it lands in your wallet.
        </p>
      </Section>
      <Section title="Principles">
        <ul>
          <li>Your wallet is your account. We only ever see your public address.</li>
          <li>Activity must be verified before it can be paid.</li>
          <li>Every payout is reviewed and authorised by a human, and recorded onchain.</li>
          <li>Estimates are estimates. Rewards are variable and never guaranteed.</li>
        </ul>
      </Section>
    </InfoPage>
  );
}
