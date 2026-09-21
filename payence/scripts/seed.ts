/**
 * Seeds a demo dataset: two people, one merchant with an API key, balances,
 * and a short payment history. Safe to re-run; it clears the database first.
 *
 *   npm run seed
 */
import { rmSync } from "fs";
import { eq } from "drizzle-orm";

async function main() {
  const url = process.env.DATABASE_URL || "./data/payence.db";
  if (process.argv.includes("--fresh") && url !== ":memory:") {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(url + suffix, { force: true });
  }

  const { getDb, schema } = await import("../lib/db");
  const { hashPassword } = await import("../lib/auth/password");
  const { id } = await import("../lib/ids");
  const ledger = await import("../lib/services/ledger");
  const payments = await import("../lib/services/payments");
  const merchants = await import("../lib/services/merchants");

  const db = getDb();
  const password = "payence-demo-2026";

  async function user(name: string, email: string, handle: string, kycTier: number) {
    const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) return existing;
    const now = Date.now();
    const row = {
      id: id("usr"),
      email,
      name,
      handle,
      passwordHash: await hashPassword(password),
      country: "IE",
      displayCurrency: "EUR",
      kycTier,
      kycStatus: kycTier > 0 ? "approved" : "not_started",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.users).values(row).run();
    return db.select().from(schema.users).where(eq(schema.users.id, row.id)).get()!;
  }

  const alex = await user("Alex Moreau", "alex@example.com", "alex", 2);
  const sam = await user("Sam Byrne", "sam@example.com", "sam", 1);

  // Liquidity for conversions, posted as a balanced pair.
  ledger.fundTreasury("USDC", 500_000_000_000n);
  ledger.fundTreasury("EURC", 500_000_000_000n);
  ledger.fundTreasury("USDT", 500_000_000_000n);

  await payments.creditDeposit({
    user: alex,
    assetId: "USDC",
    amount: 1_850_200_000n,
    network: "base",
    txHash: "0x" + "1a".repeat(32),
    address: "0x" + "ab".repeat(20),
  });
  await payments.creditDeposit({
    user: alex,
    assetId: "EURC",
    amount: 150_000_000n,
    network: "base",
    txHash: "0x" + "2b".repeat(32),
    address: "0x" + "ab".repeat(20),
  });
  await payments.creditDeposit({
    user: sam,
    assetId: "USDC",
    amount: 420_000_000n,
    network: "polygon",
    txHash: "0x" + "3c".repeat(32),
    address: "0x" + "cd".repeat(20),
  });

  let merchant = db.select().from(schema.merchants).where(eq(schema.merchants.ownerUserId, sam.id)).get();
  if (!merchant) {
    merchant = merchants.createMerchant({
      ownerUserId: sam.id,
      name: "Roasted Coffee Bar",
      websiteUrl: "https://roasted.example",
      country: "IE",
    });
    db.update(schema.merchants).set({ status: "verified" }).where(eq(schema.merchants.id, merchant.id)).run();
    merchant = merchants.merchantOf(merchant.id)!;
  }

  const key = merchants.createApiKey(merchant.id, "Seed key");

  // A little history, so every list and filter has something to show.
  for (const [amount, description] of [
    [420n, "Flat white"],
    [1_250n, "Lunch"],
    [880n, "Beans, 250g"],
  ] as [bigint, string][]) {
    const pr = merchants.createPaymentRequest({
      merchant,
      kind: "qr",
      priceCurrency: "EUR",
      priceAmount: amount,
      description,
    });
    await merchants.payRequest({ user: alex, request: pr, assetId: "USDC", idempotencyKey: id("seed") });
  }

  await payments.sendToUser({
    fromUser: alex,
    toHandleOrEmail: "sam",
    assetId: "USDC",
    amount: 35_000_000n,
    note: "Tickets",
    idempotencyKey: id("seed"),
  });

  const open = merchants.createPaymentRequest({
    merchant,
    kind: "qr",
    priceCurrency: "EUR",
    priceAmount: 640n,
    description: "Cortado and a pastry",
  });

  console.log(`
Seeded.

  Sign in:      alex@example.com / ${password}   (personal account, funded)
                sam@example.com  / ${password}   (owns the merchant)

  Merchant:     ${merchant.name}
  API key:      ${key.secret}
  Open charge:  /checkout/${open.code}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
