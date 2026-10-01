import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <InfoPage label="Documentation" title="How Stepit works" intro="The rules behind rewards, verification and payouts.">
      <Section title="1. Connecting a wallet">
        <p>
          Stepit uses <strong>Sign-In With Ethereum</strong> (EIP-4361). After you connect MetaMask, WalletConnect or
          another wallet, you sign a plain-text message. It is not a transaction: it costs no gas and gives no one
          permission to move your funds. It only proves that you control the address.
        </p>
        <p>Stepit never asks for, and never stores, seed phrases, private keys or wallet credentials.</p>
      </Section>
      <Section title="2. Step data and verification">
        <ul>
          <li>
            <strong>Apple Health</strong> and <strong>Google Health Connect</strong> are read on your phone by the Stepit
            companion app and sent to Stepit signed. These entries start as verified.
          </li>
          <li>
            <strong>Manual entries</strong> from the browser exist for demonstration. They are stored as unverified and
            only become payable if an administrator reviews and verifies them.
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
          request and sends the money to your public address from an authorised Stepit wallet, verified on-chain. Your
          dashboard shows every payment with its transaction hash, and the public payouts list shows it with your
          address shortened.
        </p>
      </Section>
    </InfoPage>
  );
}
