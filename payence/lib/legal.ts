/**
 * Legal copy.
 *
 * Template text written for a demonstration product. It covers the clauses a
 * payment platform needs, and it has not been reviewed by a lawyer. Every page
 * that renders it carries that notice, and the notice stays until counsel
 * replaces the text.
 */

export type LegalDoc = {
  id: "terms" | "privacy";
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export const TERMS: LegalDoc = {
  id: "terms",
  title: "Terms of Service",
  updated: "Last updated 21 September 2026",
  intro:
    "These terms govern your use of Payence, a platform for holding stablecoins and using them to pay people and businesses.",
  sections: [
    {
      heading: "1. What Payence is, and is not",
      body: [
        "Payence records balances of stablecoins issued by third parties and moves them between accounts on its ledger and on public blockchains. It is not a bank, it does not take deposits, and it does not offer credit, investment or tax advice.",
        "Payence is a demonstration build. It holds no e-money, payment services or crypto-asset service provider authorisation in any jurisdiction, and it must not be used to hold or move real customer funds.",
      ],
    },
    {
      heading: "2. Your account",
      body: [
        "You must be able to enter a binding contract and must give accurate information when you open an account. An account is personal to you; do not let anyone else use it.",
        "You are responsible for your password and your second factor. Payence will never ask you for either. Tell us immediately if you think someone else has access.",
      ],
    },
    {
      heading: "3. Stablecoins and their risks",
      body: [
        "A stablecoin is issued by a third party and is worth what that issuer's reserves make it worth. Payence does not guarantee that any stablecoin keeps its peg, and a balance held here is not covered by any deposit guarantee or investor compensation scheme.",
        "Blockchain transfers are irreversible. Once a withdrawal is confirmed on a public network, neither Payence nor anyone else can undo it, including a transfer to a wrong or hostile address.",
      ],
    },
    {
      heading: "4. Payments",
      body: [
        "A payment to a merchant is final once it settles. Refunds are at the merchant's discretion and are made through Payence back to the account that paid.",
        "A transfer to another Payence account is final once it settles. Only the recipient can return it.",
        "Exchange rates shown for stablecoins are reference rates from an external source, provided so you can read a balance in a familiar currency. They are not an offer to exchange at that rate.",
      ],
    },
    {
      heading: "5. Limits, verification and monitoring",
      body: [
        "Payment limits apply per transaction, per day and per month, and depend on the level of identity verification completed. We may ask for verification before raising a limit, and we may ask for further information at any time where law requires it.",
        "We screen accounts and transactions against internal rules and, where a provider is connected, against sanctions and risk data. We may delay, refuse or reverse an instruction where we are required to, and we will tell you why where we are lawfully permitted to.",
      ],
    },
    {
      heading: "6. Acceptable use",
      body: [
        "Do not use Payence for fraud, money laundering, terrorist financing, sanctions evasion, or any purpose that is unlawful where you are or where the other side is.",
        "Do not attempt to bypass limits, verification or monitoring, whether directly or through another account.",
        "We may suspend or close an account we reasonably believe is being used this way.",
      ],
    },
    {
      heading: "7. Fees",
      body: [
        "Fees are those published on the fees page at the time of the transaction. Network fees for on-chain transfers are passed through at cost and shown before you confirm.",
        "A merchant pays a percentage of each payment received. That rate is shown in the merchant dashboard and is deducted at settlement.",
      ],
    },
    {
      heading: "8. Liability",
      body: [
        "Nothing here excludes liability that cannot lawfully be excluded, including for fraud.",
        "Subject to that, Payence is not liable for loss caused by the failure of a stablecoin issuer, the failure or congestion of a blockchain network, a transfer you authorised to an address you supplied, or your failure to keep your credentials safe.",
      ],
    },
    {
      heading: "9. Closing an account",
      body: [
        "You may close your account at any time once your balance is withdrawn. We may close an account on reasonable notice, or immediately where law or risk requires it, and will return any remaining balance where we are permitted to.",
      ],
    },
    {
      heading: "10. Changes and governing law",
      body: [
        "We may change these terms and will give notice of a material change. Continuing to use the service after a change means you accept it.",
        "These terms are governed by the laws of Ireland, and the courts of Ireland have exclusive jurisdiction.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  updated: "Last updated 21 September 2026",
  intro:
    "This policy explains what Payence collects, why, how long it is kept and what you can ask us to do with it.",
  sections: [
    {
      heading: "1. What we collect",
      body: [
        "Account data: your name, email address, country, and the password hash and second-factor secret used to sign you in. We never store your password itself.",
        "Transaction data: every payment, transfer, deposit, withdrawal and conversion, with amounts, assets, counterparties, fees, rates, networks and transaction hashes.",
        "Technical data: the IP address and browser of each session, kept so you can see and revoke your signed-in devices, and so we can detect suspicious access.",
        "Verification data: where identity verification is used, the result and the provider's reference. Identity documents are handled by that provider, not stored by Payence.",
      ],
    },
    {
      heading: "2. Why we use it",
      body: [
        "To run your account and execute the payments you instruct. That is performance of our contract with you.",
        "To meet legal obligations, including anti-money-laundering record keeping and sanctions compliance.",
        "To keep the service secure: rate limiting, fraud and abuse detection, and the audit log. That is our legitimate interest in a safe payment system.",
      ],
    },
    {
      heading: "3. What we do not do",
      body: [
        "We do not sell your data. We do not run advertising trackers, and this site sets no analytics or marketing cookies.",
        "The only cookie Payence sets is the session cookie that keeps you signed in. It is httpOnly, restricted to this site, and holds a random token, not information about you.",
      ],
    },
    {
      heading: "4. Who we share it with",
      body: [
        "Service providers that make the payment work: blockchain infrastructure, exchange rate data, identity verification, sanctions screening and email delivery. Each receives only what that job needs.",
        "Public blockchains: a deposit or withdrawal is recorded on a public network by design, and that record is permanent and visible to anyone.",
        "Authorities, where we are legally required to report or respond.",
      ],
    },
    {
      heading: "5. How long we keep it",
      body: [
        "Transaction and verification records are kept for the period anti-money-laundering law requires, which is generally five years after the account relationship ends.",
        "Session and technical data is kept for a short period and then deleted.",
      ],
    },
    {
      heading: "6. Your rights",
      body: [
        "You can ask for a copy of your data, ask us to correct it, ask us to delete what we are not required to keep, object to processing based on legitimate interests, and ask for your data in a portable form.",
        "You can also complain to your data protection authority. In Ireland that is the Data Protection Commission.",
      ],
    },
    {
      heading: "7. Security",
      body: [
        "Passwords are stored as salted scrypt hashes. Second-factor secrets are encrypted at rest. Session tokens are stored only as hashes, so a database copy does not yield live sessions.",
        "No system is perfectly secure. If a breach affects your data we will tell you and the relevant authority as the law requires.",
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc["id"], LegalDoc> = { terms: TERMS, privacy: PRIVACY };
