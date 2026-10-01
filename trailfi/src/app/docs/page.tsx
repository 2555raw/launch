import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <InfoPage label="Documentation" title="How Stepit works" intro="The rules behind rewards, verification and payouts.">
      <Section title="1. Connecting a wallet">
        <p>
          Stepit uses <strong>Sign In With Ethereum</strong> (EIP 4361). After you connect Phantom, MetaMask, Coinbase, Rabby or
          another wallet, you sign a plain text message. It is not a transaction: it costs no gas and gives no one
          permission to move your funds. It only proves that you control the address.
        </p>
        <p>Stepit never asks for, and never stores, seed phrases, private keys or wallet credentials.</p>
      </Section>
      <Section title="2. Step data and verification">
        <ul>
          <li>
            <strong>Upload your steps</strong> on the Upload steps page: pick the day, type your total and attach a
            screenshot from your phone&apos;s health app showing the date and the steps.
          </li>
          <li>
            Every upload starts as <strong>unverified</strong>. It only becomes payable after the team checks the
            screenshot and verifies it. You can delete an upload and send it again while it is still waiting for review.
          </li>
          <li>
            One entry per day and source. Entries cannot be overwritten; future dates, stale dates and implausible values
            are rejected, and unusual values are flagged for review.
          </li>
        </ul>
      </Section>
      <Section title="3. Rewards">
        <p>
          Every trade of the <strong>$STEPIT</strong> token pays a small fee, and those fees fund the rewards. Rewards grow
          with your verified daily steps: the more you walk, the more you earn. Days with very little activity earn
          nothing. Amounts are set by the Stepit team and can change over time.
        </p>
      </Section>
      <Section title="4. Requesting a payout">
        <p>
          When you have approved rewards, press <strong>Request payout</strong> in your dashboard. The team reviews the
          request and sends the money to your public address from an authorised Stepit wallet, verified onchain. Your
          dashboard shows every payment with its transaction hash, and the public payouts list shows it with your
          address shortened.
        </p>
      </Section>
    </InfoPage>
  );
}
