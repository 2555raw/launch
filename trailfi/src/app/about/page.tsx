import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <InfoPage
      label="About Stepit"
      title="Built for people who'd rather be outside."
      intro="Stepit is a Web3 platform that rewards verified real world activity. Walk, hike and explore, and get paid from the $STEPIT token's trading fees in your own wallet."
    >
      <Section title="Why Stepit">
        <p>
          Most move to earn projects paid people in a token that only had value while new users kept buying it. Stepit
          does the opposite: rewards are funded by the <strong>real trading fees</strong> of the $STEPIT token, paid in
          established stablecoins.
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
