/**
 * The fee schedule, in one place so the landing page, the checkout and the
 * merchant dashboard cannot disagree about what a payment costs.
 */
export const FEES = {
  /** Wallet-to-wallet between Payence accounts. */
  transferBps: 0,
  /** Charged to the merchant on a completed payment. */
  merchantBps: 60, // 0.6%
  /** Charged on converting between assets. */
  conversionBps: 25, // 0.25%
  /** Deposits are free; the sender pays their own network fee. */
  depositBps: 0,
  /** Withdrawal: platform charges nothing, the network fee is passed through. */
  withdrawalBps: 0,
} as const;

export const FEE_COPY = {
  transfer: "Free",
  merchant: "0.6% per payment",
  conversion: "0.25%",
  deposit: "Free",
  withdrawal: "Network fee only",
} as const;
