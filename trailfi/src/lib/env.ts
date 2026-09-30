import "server-only";

const DEV_SESSION_SECRET = "trailfi-dev-only-secret-change-me-0123456789abcdef";

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[0-9a-f]{40}$/.test(s));
}

const isProd = process.env.NODE_ENV === "production";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProd && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("SESSION_SECRET must be set (32+ characters) in production.");
  }
  return DEV_SESSION_SECRET;
}

const adminWallets = list(process.env.ADMIN_WALLETS);

/** Server-only configuration. Nothing here is ever sent to the browser. */
export const env = {
  isProd,
  databaseUrl: process.env.DATABASE_URL || "",
  pgliteDir: process.env.PGLITE_DATA_DIR || ".data/pglite",
  autoMigrate: process.env.DB_AUTO_MIGRATE !== "false",
  get sessionSecret() {
    return sessionSecret();
  },
  adminWallets,
  /** Wallets allowed to send payouts. Defaults to the admin wallets. */
  payoutWallets: process.env.PAYOUT_WALLETS ? list(process.env.PAYOUT_WALLETS) : adminWallets,
  rpcUrl: process.env.RPC_URL || "",
  stepIngestSecret: process.env.STEP_INGEST_SECRET || "",
  demoMode: (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true") === "true",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
};
