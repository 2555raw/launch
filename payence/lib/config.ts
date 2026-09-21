/**
 * Environment, read on the server only. Nothing here is NEXT_PUBLIC_, so no
 * secret can reach the browser.
 */
import "server-only";

const env = process.env;

export const IS_PROD = env.NODE_ENV === "production";

const DEV_SECRET = "dev-only-secret-do-not-use-in-production";

/**
 * The key material behind session and TOTP encryption.
 *
 * The check is a function rather than a module-level throw on purpose: Next
 * evaluates modules during `next build`, where NODE_ENV is already "production"
 * and the real secret is not present. Reading it lazily means a build works
 * without secrets while a running server still refuses to start handling
 * requests with the development key.
 */
function appSecret(): string {
  const value = env.APP_SECRET;
  if (value && value.length >= 16) return value;
  if (IS_PROD && env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("APP_SECRET must be set to at least 16 characters in production");
  }
  return DEV_SECRET;
}

export const config = {
  appUrl: (env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  databaseUrl: env.DATABASE_URL || "./data/payence.db",
  get appSecret() {
    return appSecret();
  },
  chain: {
    provider: (env.CHAIN_PROVIDER || "simulated") as "simulated" | "evm",
    network: env.CHAIN_NETWORK || "base-sepolia",
    rpcUrl: env.CHAIN_RPC_URL || "",
    depositMnemonic: env.DEPOSIT_MNEMONIC || "",
    hotWalletKey: env.HOT_WALLET_PRIVATE_KEY || "",
  },
  rates: { provider: (env.RATE_PROVIDER || "fixed") as "fixed" | "frankfurter" },
  compliance: { provider: env.COMPLIANCE_PROVIDER || "basic" },
  email: {
    provider: (env.EMAIL_PROVIDER || "console") as "console" | "resend",
    resendKey: env.RESEND_API_KEY || "",
    from: env.EMAIL_FROM || "Payence <no-reply@payence.site>",
  },
};

/** True when the blockchain layer is simulated; the app says so on every screen. */
export const SIMULATED_CHAIN = config.chain.provider === "simulated";

/** Called at startup to fail loudly rather than at the first payment. */
export function assertProductionConfig() {
  if (!IS_PROD) return;
  if (config.appSecret === DEV_SECRET) throw new Error("APP_SECRET must be set in production");
  if (!env.APP_URL) throw new Error("APP_URL must be set in production");
}
