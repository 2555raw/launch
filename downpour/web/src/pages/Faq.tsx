import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { PageHead } from '../components/bits';
import { CORE_FAQ, Faq as FaqList } from '../components/sections';

export default function Faq() {
  const pad = usePad();
  const p = pad.snap?.params;
  const fee = p ? (p.protocolFeeBps + p.creatorFeeBps) / 100 : 1;

  const more: Array<[string, React.ReactNode]> = [
    [
      'Why does the price go up every time someone buys?',
      'The curve prices a coin from the ratio of its two reserves. A buy adds currency and removes coins, so the next coin costs a little more; a sell does the opposite. Big buys move the price more than small ones, which is why Swap shows the price impact before you confirm.',
    ],
    [
      'What is the snipe tax?',
      `For the first ${p?.snipeWindow ?? 15} seconds after a launch, buys pay an extra tax that starts at ${((p?.snipeTaxBps ?? 2000) / 100).toFixed(0)}% and falls to zero in a straight line. It exists to make first-block bots pay for jumping the queue. The creator's own first buy, made in the launch transaction, does not pay it.`,
    ],
    [
      'Who gets the fees, and when?',
      `Every trade pays ${fee}%, split evenly between the coin's creator and the protocol, in the coin's own currency. The fees wait inside the pad until whoever earned them claims them from the Portfolio page.`,
    ],
    [
      'What if the real exchange rate of my coin’s currency moves?',
      'Your coin keeps trading in its currency; nothing about its market changes. The dollar figures shown next to prices follow the desk’s rate, and conversions through Swap use it. The rate only matters to a curve once, at launch, to size it in dollars.',
    ],
    [
      'Why are the currencies test tokens?',
      'On a test network the desk mints stand-in currencies (Test Euro, Test Yen) so anyone can try every pair for free. A production deployment lists real stablecoins instead, and the desk then pays conversions from a reserve rather than by minting.',
    ],
    [
      'How do I get money to try it?',
      'In the playground, connecting gives your address a starting balance in every currency. In live mode on a test network, the currency desk has a faucet for each test currency; you also need a little of the network’s ETH for gas, from that network’s faucet.',
    ],
    [
      'Can someone launch a coin with the same name as mine?',
      'Yes. Names and tickers are not unique, just like on every open launchpad. The address is what identifies a coin; check it, and use Verify when someone sends you one.',
    ],
    [
      'Which wallets work?',
      'Any wallet that runs in your browser and speaks the standard Ethereum wallet protocol: MetaMask, Rabby, Coinbase Wallet, Phantom, OKX, Brave, Trust and others. On a phone, open this page inside your wallet app’s browser.',
    ],
    [
      'Has the code been audited?',
      'No. The contracts are tested (unit tests, fuzzing and invariant tests that hammer the backing rules with random trades), and Verify proves the code on chain matches this repository. That is not an audit. Treat any real-money deployment accordingly.',
    ],
  ];

  return (
    <div className="wrap narrow" style={{ maxWidth: 900 }}>
      <PageHead kicker="Before you trade" title="What a currency coin is, in plain words" />
      <div className="callout warn" style={{ marginBottom: 30 }}>
        <b>Memecoins can go to zero, fast.</b> A coin being paired with a stable currency does not make the coin stable: its price in that currency moves with every
        trade. Nothing here is financial advice, nothing is insured, and on a test network or in the playground nothing has any value.
      </div>

      <div className="kicker">Questions people ask</div>
      <h2 className="h-section">Questions</h2>
      <FaqList items={[...CORE_FAQ, ...more]} />

      <div className="panel" style={{ marginTop: 40 }}>
        <div className="kicker">Where the rates come from</div>
        <h3 className="card-title">Two feeds, and they have to agree</h3>
        <p className="muted small">
          The keeper reads two independent public FX feeds. For each currency it posts a new rate only when the feeds agree within half a percent and the agreed
          rate has drifted from the one on chain. When they disagree, the rate simply holds. The contract adds its own limit: one post can never move a rate more
          than 20%.
        </p>
        <div className="kv">
          <span>Feeds</span>
          <span>open.er-api.com · fawazahmed0 currency-api</span>
        </div>
        <div className="kv">
          <span>Agreement needed</span>
          <span>within 0.5%</span>
        </div>
        <div className="kv">
          <span>Posted when drift exceeds</span>
          <span>0.1%</span>
        </div>
        <div className="kv">
          <span>Largest move per post (on chain)</span>
          <span>20%</span>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          More in <Link to="/how-it-works" className="rain-text">How it works</Link>.
        </p>
      </div>
    </div>
  );
}
