import { TopBar } from "@/components/game/TopBar";

export const metadata = { title: "Privacy — FOUNDRY" };

export default function PrivacyPage() {
  return (
    <div>
      <TopBar user={null} />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-slate-300">
        <header>
          <div className="label text-ember">Privacy</div>
          <h1 className="mt-1 font-display text-4xl font-bold text-slate-50">What FOUNDRY stores, and what it never asks for</h1>
        </header>
        <Block title="Account data">
          <p>A player name and a password hash (scrypt). No email is required. Sessions are kept in an HttpOnly cookie that expires after 30 days; signing out deletes the session on the server.</p>
        </Block>
        <Block title="Wallets">
          <p>If you link a Solana wallet we store its public address and the time it was verified. Verification is a signed message with a one-time nonce. We never ask for, receive, or store seed phrases or private keys, and linking sends no transaction.</p>
        </Block>
        <Block title="Gameplay data">
          <p>Your balance, production, clicks (as aggregated batches, never individual clicks), buildings, upgrades, achievements and burn power. Clicks rejected by the anti-cheat limits are counted so the admin can spot automation. Your name and burn power appear on the public leaderboard.</p>
        </Block>
        <Block title="On-chain data">
          <p>The token mint, treasury account, burn, authority changes and claim transfers are public on the Solana blockchain and are shown on the project page together with the wallet addresses involved. Blockchain data cannot be deleted.</p>
        </Block>
        <Block title="Technical data">
          <p>Request IP addresses are used in memory for rate limiting (sign-ups, sign-ins, wallet nonces) and expire within minutes. The browser&apos;s user agent is stored with a session for your own review. We set no advertising or tracking cookies and run no third-party analytics.</p>
        </Block>
        <Block title="Third parties">
          <p>The browser loads fonts from Google Fonts. The project page on mainnet queries DexScreener for market data about the token mint. Wallet extensions you choose to connect act under their own policies.</p>
        </Block>
        <Block title="Your choices">
          <p>You can unlink a wallet from Options at any time. To delete an account and its gameplay data, contact the project team through the links in the top bar.</p>
        </Block>
      </article>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-bold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}
