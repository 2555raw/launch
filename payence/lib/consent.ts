/**
 * The one thing this page would keep about you: the card you designed.
 *
 * A consent notice that stores nothing is a lie told politely, so this is
 * wired to something real: allow it and the card's name, colour and network
 * come back with you; decline and nothing is written at all. It lives in this
 * browser's own storage, never leaves it, and no third party can read it.
 */

export const CONSENT_KEY = "payence-consent";
export const DESIGN_KEY = "payence-card";

export type Consent = "allowed" | "declined" | null;

export type CardDesign = {
  holder?: string;
  theme?: string;
  network?: string;
};

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "allowed" || v === "declined" ? v : null;
  } catch (_) {
    return null;
  }
}

export function setConsent(value: Exclude<Consent, null>) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === "declined") localStorage.removeItem(DESIGN_KEY);
  } catch (_) {
    /* storage blocked, so the choice is not remembered */
  }
}

export function readDesign(): CardDesign | null {
  if (getConsent() !== "allowed") return null;
  try {
    const raw = localStorage.getItem(DESIGN_KEY);
    return raw ? (JSON.parse(raw) as CardDesign) : null;
  } catch (_) {
    return null;
  }
}

export function saveDesign(design: CardDesign) {
  if (getConsent() !== "allowed") return;
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
  } catch (_) {
    /* storage blocked, so the design is not kept */
  }
}
