export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://foundry:foundry@localhost:5432/foundry",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  port: Number(process.env.PORT ?? 3000),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  solanaCluster: process.env.SOLANA_CLUSTER ?? "devnet",
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  solanaAuthoritySecret: process.env.SOLANA_AUTHORITY_SECRET ?? "",
  autoExecuteLaunch: process.env.AUTO_EXECUTE_LAUNCH === "1",
  isProd: process.env.NODE_ENV === "production",
};
