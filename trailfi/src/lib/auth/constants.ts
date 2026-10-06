export const SESSION_COOKIE = "trailfi_session";
export const NONCE_COOKIE = "trailfi_nonce";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Signed during sign-in. It is the consent the user gives for their public
 * address to be used for identification and payouts, and the server refuses
 * any sign-in message whose statement differs.
 */
export const SIWE_STATEMENT =
  "Sign in to Stepit. This free signature only proves you own this address: it is not a transaction and gives no permission to move funds. I agree that Stepit uses this public address to identify me and to send my rewards.";
