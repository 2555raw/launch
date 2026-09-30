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
      <Section title="3. Reward distribution">
        <p>
          For each distribution period: <code>pool = eligible fees × reward %</code>. A day counts when your verified
          steps reach the daily goal; each counted day adds <code>min(steps, goal × cap multiplier)</code> to your weight.
          Your reward is <code>pool × your weight ÷ total weight</code>, limited by the per-user maximum. Anything cut by
          the cap is shared again among the others (or stays in the treasury, depending on configuration).
        </p>
        <p>
          Example: 100 USDC of eligible fees at 30% gives a 30 USDC pool. Two walkers with 10,000 and 20,000 verified
          steps receive 10 and 20 USDC.
        </p>
      </Section>
      <Section title="4. Payouts">
        <p>
          Rewards are reviewed and approved by an administrator. Approved rewards are bundled into a payout to your public
          address, sent from an authorised Stepit wallet after explicit confirmation, and verified on-chain. You can see
          the transaction hash in your dashboard.
        </p>
      </Section>
    </InfoPage>
  );
}
