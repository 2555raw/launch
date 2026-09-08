/**
 * Legal copy for the Terms and Privacy dialogs.
 *
 * Written for a fictional product. It reads like the real thing and covers the
 * clauses a payments platform actually needs, but it has not been reviewed by a
 * lawyer — every dialog says so at the top, and that note should stay until real
 * counsel replaces this text.
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
  updated: "Last updated 1 January 2026",
  intro:
    "These terms govern your use of Nexora, a platform that issues virtual payment credentials to software agents you operate.",
  sections: [
    {
      heading: "1. Agreement",
      body: [
        "By creating an account, issuing a card or calling the API, you agree to these terms on behalf of yourself and any organisation you represent. If you do not agree, do not use the service.",
        "You must be able to enter a binding contract, and the organisation you bind must be lawfully constituted.",
      ],
    },
    {
      heading: "2. What the service does",
      body: [
        "Nexora issues virtual cards, evaluates the spending policies you configure, authorises or declines transactions against them, and records the result. Funds are held and settled by our regulated banking and card-network partners, not by Nexora.",
        "We are the authorisation and record layer. We are not a bank, and we do not provide credit, investment or tax advice.",
      ],
    },
    {
      heading: "3. Your account and your agents",
      body: [
        "You are responsible for your API keys, for the agents you authorise, and for the policies you set for them. An agent acting inside the limits you configured is acting with your authority, and the resulting charges are yours.",
        "Keep credentials out of prompts, model context and public repositories. Tell us without delay if a key is exposed, and rotate it.",
      ],
    },
    {
      heading: "4. Acceptable use",
      body: [
        "Do not use the service for fraud, money laundering, sanctions evasion, or any purpose prohibited by the card networks or by applicable law.",
        "Do not attempt to circumvent merchant restrictions, spending ceilings or approval thresholds, whether directly or by instructing an agent to do so. Do not use cards issued to another party without authority.",
        "We may suspend an agent, a card or an account that we reasonably believe is being used this way, and we will tell you why when we lawfully can.",
      ],
    },
    {
      heading: "5. Fees",
      body: [
        "The paid plan is charged as a percentage of settled volume, at the rate shown on the pricing page at the time the transaction settles. There is no per-seat fee and no minimum commitment.",
        "Fees are billed monthly in arrears and are exclusive of tax. Network and interchange costs passed through by our partners are itemised separately.",
      ],
    },
    {
      heading: "6. Availability",
      body: [
        "We aim for high availability on the authorisation plane and publish our status page, but the service is provided without a guarantee of uninterrupted operation unless a separate service level agreement is signed.",
        "We may perform maintenance, and will give notice of planned work that affects authorisation.",
      ],
    },
    {
      heading: "7. Suspension and termination",
      body: [
        "You may close your account at any time. We may terminate for material breach, for legal or network-compliance reasons, or on notice if we discontinue the service.",
        "On termination, cards are frozen, pending authorisations are allowed to settle, and your records remain available for export for thirty days.",
      ],
    },
    {
      heading: "8. Liability",
      body: [
        "Neither party is liable for indirect or consequential loss, or for lost profit or lost data. Our total liability in any twelve-month period is limited to the fees you paid us in that period.",
        "Nothing here limits liability that cannot lawfully be limited, including for fraud or death and personal injury caused by negligence.",
      ],
    },
    {
      heading: "9. Changes",
      body: [
        "We may change these terms. Material changes take effect thirty days after we notify you by email or in the console; continuing to use the service after that means you accept them.",
      ],
    },
    {
      heading: "10. Governing law",
      body: [
        "These terms are governed by the laws of the jurisdiction named in your order form, and the courts of that jurisdiction have exclusive jurisdiction over any dispute.",
        "Questions about these terms: legal@nexora.example.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  updated: "Last updated 1 January 2026",
  intro:
    "This policy explains what Nexora collects when you and your agents use the platform, why we hold it, and what you can ask us to do with it.",
  sections: [
    {
      heading: "1. What we collect",
      body: [
        "Account data: the name, work email and billing details of the people who administer your organisation.",
        "Transaction data: the agent identifier, the card, the amount, the merchant, the policy applied, the decision and its reason, and the timestamp.",
        "Technical data: API request metadata, IP address, and diagnostic logs needed to run and secure the service.",
      ],
    },
    {
      heading: "2. What we do not collect",
      body: [
        "We do not receive your agents' prompts, model context, retrieved documents or reasoning. An agent sends us an authorisation request, not its transcript.",
        "We do not sell personal data, and we do not use your transaction data to train models.",
      ],
    },
    {
      heading: "3. Why we hold it",
      body: [
        "To authorise payments and enforce the policies you configured; to prevent fraud and abuse; to bill you; to provide support; and to meet the financial record-keeping obligations that apply to payments.",
        "The lawful bases we rely on are performance of our contract with you, our legitimate interest in operating and securing the service, and compliance with legal obligations.",
      ],
    },
    {
      heading: "4. Who we share it with",
      body: [
        "Our issuing bank, card networks and settlement partners, to the extent needed to move the money. Infrastructure providers who host the service under written data-processing terms. Authorities, where the law requires it.",
        "A current list of subprocessors is available on request.",
      ],
    },
    {
      heading: "5. How long we keep it",
      body: [
        "Transaction records are retained for the period required of regulated payment records, currently seven years. Diagnostic logs are retained for ninety days. Account data is deleted within thirty days of account closure, except where we must keep it.",
      ],
    },
    {
      heading: "6. Your rights",
      body: [
        "Depending on where you live, you may ask for a copy of your personal data, ask us to correct or delete it, object to or restrict processing, or receive it in a portable format.",
        "Write to privacy@nexora.example and we will respond within thirty days. You may also complain to your local data protection authority.",
      ],
    },
    {
      heading: "7. Security",
      body: [
        "Data is encrypted in transit and at rest. Card credentials are held in a segregated environment and are never returned in full through the API. Access is scoped, logged and reviewed, and we test the platform independently.",
      ],
    },
    {
      heading: "8. Cookies",
      body: [
        "We use strictly necessary cookies to keep you signed in, and analytics cookies to understand how the console is used. You can refuse analytics cookies without losing any functionality.",
      ],
    },
    {
      heading: "9. International transfers",
      body: [
        "Where we move personal data across borders, we do so under an adequacy decision or standard contractual clauses, with the additional measures those clauses require.",
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<"terms" | "privacy", LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
};
