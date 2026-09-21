import { describe, it, expect, beforeAll } from "vitest";
import { useTempDb } from "./setupDb";

useTempDb();

const { getDb, schema } = await import("../lib/db");
type UserRow = typeof schema.users.$inferSelect;
const { hashPassword } = await import("../lib/auth/password");
const ledger = await import("../lib/services/ledger");
const payments = await import("../lib/services/payments");
const merchants = await import("../lib/services/merchants");
const { id } = await import("../lib/ids");

async function makeUser(name: string, handle: string, kycTier = 2) {
  const now = Date.now();
  const row = {
    id: id("usr"),
    email: `${handle}@example.com`,
    name,
    handle,
    passwordHash: await hashPassword("a-decent-passphrase"),
    displayCurrency: "EUR",
    kycTier,
    kycStatus: kycTier > 0 ? "approved" : "not_started",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(schema.users).values(row).run();
  return getDb().select().from(schema.users).where(eq(schema.users.id, row.id)).get()!;
}

const { eq } = await import("drizzle-orm");

/** Fund an account the way a confirmed deposit would. */
async function fund(user: UserRow, asset: "USDC" | "EURC", amount: bigint) {
  return payments.creditDeposit({
    user,
    assetId: asset,
    amount,
    network: "base",
    txHash: "0x" + id("h").slice(2, 66).padEnd(64, "a"),
    address: "0x" + "1".repeat(40),
  });
}

describe("payments", () => {
  let alice: UserRow;
  let bob: UserRow;

  beforeAll(async () => {
    alice = await makeUser("Alice Doe", "alice");
    bob = await makeUser("Bob Roe", "bob");
    await payments.creditDeposit({
      user: alice,
      assetId: "USDC",
      amount: 1_000_000_000n, // 1000 USDC
      network: "base",
      txHash: "0x" + "a".repeat(64),
      address: "0x" + "1".repeat(40),
    });
  });

  it("credits a deposit once, even when replayed", async () => {
    const before = ledger.getBalance({ type: "user", id: alice.id }, "USDC").available;
    await payments.creditDeposit({
      user: alice,
      assetId: "USDC",
      amount: 1_000_000_000n,
      network: "base",
      txHash: "0x" + "a".repeat(64),
      address: "0x" + "1".repeat(40),
    });
    expect(ledger.getBalance({ type: "user", id: alice.id }, "USDC").available).toBe(before);
    expect(before).toBe(1_000_000_000n);
  });

  it("sends between accounts and moves exactly the amount", async () => {
    const res = await payments.sendToUser({
      fromUser: alice,
      toHandleOrEmail: "bob",
      assetId: "USDC",
      amount: 25_000_000n,
      note: "dinner",
      idempotencyKey: id("idem"),
    });
    expect(res.ok).toBe(true);
    expect(ledger.getBalance({ type: "user", id: alice.id }, "USDC").available).toBe(975_000_000n);
    expect(ledger.getBalance({ type: "user", id: bob.id }, "USDC").available).toBe(25_000_000n);
  });

  it("is idempotent on the key: a retry does not send twice", async () => {
    const key = id("idem");
    const a = await payments.sendToUser({ fromUser: alice, toHandleOrEmail: "bob", assetId: "USDC", amount: 5_000_000n, idempotencyKey: key });
    const b = await payments.sendToUser({ fromUser: alice, toHandleOrEmail: "bob", assetId: "USDC", amount: 5_000_000n, idempotencyKey: key });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.transaction.id).toBe(b.transaction.id);
    expect(ledger.getBalance({ type: "user", id: bob.id }, "USDC").available).toBe(30_000_000n);
  });

  it("refuses to overdraw and leaves balances untouched", async () => {
    const before = ledger.getBalance({ type: "user", id: bob.id }, "USDC").available;
    const res = await payments.sendToUser({
      fromUser: bob,
      toHandleOrEmail: "alice",
      assetId: "USDC",
      amount: 10_000_000_000n,
      idempotencyKey: id("idem"),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("INSUFFICIENT_FUNDS");
    expect(ledger.getBalance({ type: "user", id: bob.id }, "USDC").available).toBe(before);
  });

  it("refuses to send to yourself and to an unknown handle", async () => {
    const self = await payments.sendToUser({ fromUser: alice, toHandleOrEmail: "alice", assetId: "USDC", amount: 1_000_000n, idempotencyKey: id("i") });
    expect(self.ok === false && self.code).toBe("SELF_PAYMENT");
    const missing = await payments.sendToUser({ fromUser: alice, toHandleOrEmail: "nobody", assetId: "USDC", amount: 1_000_000n, idempotencyKey: id("i") });
    expect(missing.ok === false && missing.code).toBe("NOT_FOUND");
  });

  it("enforces the tier limit for an unverified user", async () => {
    const carol = await makeUser("Carol", "carol", 0);
    await fund(carol, "USDC", 1_000_000_000n);
    const res = await payments.sendToUser({
      fromUser: carol,
      toHandleOrEmail: "alice",
      assetId: "USDC",
      amount: 900_000_000n, // way over the €150 unverified cap
      idempotencyKey: id("i"),
    });
    expect(res.ok === false && res.code).toBe("LIMIT");
  });

  it("withdraws, charging the network fee and settling the hold", async () => {
    const before = ledger.getBalance({ type: "user", id: alice.id }, "USDC").available;
    const res = await payments.withdraw({
      user: alice,
      assetId: "USDC",
      amount: 10_000_000n,
      network: "base",
      address: "0x" + "b".repeat(40),
      idempotencyKey: id("i"),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.transaction.status).toBe("completed");
      expect(res.transaction.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    }
    const after = ledger.getBalance({ type: "user", id: alice.id }, "USDC");
    expect(after.available).toBe(before - 10_000_000n - 20_000n); // fee 0.02
    expect(after.pending).toBe(0n);
  });

  it("rejects a malformed withdrawal address", async () => {
    const res = await payments.withdraw({
      user: alice,
      assetId: "USDC",
      amount: 1_000_000n,
      network: "base",
      address: "not-an-address",
      idempotencyKey: id("i"),
    });
    expect(res.ok === false && res.code).toBe("INVALID");
  });

  it("converts between assets, charging the conversion fee", async () => {
    // Give the treasury the liquidity a real venue would hold, posted as a
    // balanced pair so the books still net to zero.
    ledger.fundTreasury("EURC", 100_000_000_000n);
    const res = await payments.convertAssets({ user: alice, from: "USDC", to: "EURC", amount: 100_000_000n, idempotencyKey: id("i") });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 100 USDC at 0.92 = 92 EURC, less 0.25% = 91.77
      expect(res.received).toBe(91_770_000n);
      expect(ledger.getBalance({ type: "user", id: alice.id }, "EURC").available).toBe(91_770_000n);
    }
  });
});

describe("merchant payments", () => {
  it("pays a request, credits net of fee, and cannot be paid twice", async () => {
    const shopOwner = await makeUser("Shop Owner", "shopowner");
    const payer = await makeUser("Payer One", "payerone");
    await fund(payer, "USDC", 500_000_000n);
    const merchant = merchants.createMerchant({ ownerUserId: shopOwner.id, name: "Blue Bottle" });
    const pr = merchants.createPaymentRequest({
      merchant,
      kind: "qr",
      priceCurrency: "EUR",
      priceAmount: 1_500n, // €15.00
      description: "Two flat whites",
    });

    const res = await merchants.payRequest({ user: payer, request: pr, assetId: "USDC", idempotencyKey: id("i") });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // €15 at 0.92 EUR/USD -> 16.304347 USDC, fee 0.6% rounded up.
    const charged = BigInt(res.transaction.amount);
    const fee = BigInt(res.transaction.fee);
    expect(charged).toBe(16_304_348n);
    expect(fee).toBe(97_827n);
    expect(ledger.getBalance({ type: "merchant", id: merchant.id }, "USDC").available).toBe(charged - fee);

    const again = await merchants.payRequest({ user: payer, request: merchants.getPaymentRequest(pr.id)!, assetId: "USDC", idempotencyKey: id("i") });
    expect(again.ok === false && again.code).toBe("ALREADY_PAID");
  });

  it("expires a request that has passed its deadline", async () => {
    const owner = await makeUser("Late Shop", "lateshop");
    const payer = await makeUser("Payer Two", "payertwo");
    await fund(payer, "USDC", 100_000_000n);
    const merchant = merchants.createMerchant({ ownerUserId: owner.id, name: "Late Shop" });
    const pr = merchants.createPaymentRequest({ merchant, kind: "qr", priceCurrency: "EUR", priceAmount: 500n, ttlMs: -1000 });
    const res = await merchants.payRequest({ user: payer, request: pr, assetId: "USDC", idempotencyKey: id("i") });
    expect(res.ok === false && res.code).toBe("EXPIRED");
  });

  it("refunds a payment back to the payer and blocks over-refunding", async () => {
    const owner = await makeUser("Refund Shop", "refundshop");
    const payer = await makeUser("Payer Three", "payerthree");
    await fund(payer, "USDC", 200_000_000n);
    const merchant = merchants.createMerchant({ ownerUserId: owner.id, name: "Refund Shop" });
    const pr = merchants.createPaymentRequest({ merchant, kind: "link", priceCurrency: "USDC", priceAmount: 20_000_000n });
    const paid = await merchants.payRequest({ user: payer, request: pr, assetId: "USDC", idempotencyKey: id("i") });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;

    const balanceBefore = ledger.getBalance({ type: "user", id: payer.id }, "USDC").available;
    const refund = await merchants.refundPayment({ merchant, transactionId: paid.transaction.id, amount: 5_000_000n, idempotencyKey: id("i") });
    expect(refund.ok).toBe(true);
    expect(ledger.getBalance({ type: "user", id: payer.id }, "USDC").available).toBe(balanceBefore + 5_000_000n);

    const tooMuch = await merchants.refundPayment({ merchant, transactionId: paid.transaction.id, amount: 100_000_000n, idempotencyKey: id("i") });
    expect(tooMuch.ok === false && tooMuch.code).toBe("INVALID");
  });

  it("refuses payment in an asset the merchant does not accept", async () => {
    const owner = await makeUser("Picky Shop", "pickyshop");
    const payer = await makeUser("Payer Four", "payerfour");
    await fund(payer, "USDC", 50_000_000n);
    const merchant = merchants.createMerchant({ ownerUserId: owner.id, name: "Picky Shop" });
    getDb().update(schema.merchants).set({ acceptedAssets: JSON.stringify(["EURC"]) }).where(eq(schema.merchants.id, merchant.id)).run();
    const fresh = merchants.merchantOf(merchant.id)!;
    const pr = merchants.createPaymentRequest({ merchant: fresh, kind: "qr", priceCurrency: "EUR", priceAmount: 1_000n });
    const res = await merchants.payRequest({ user: payer, request: pr, assetId: "USDC", idempotencyKey: id("i") });
    expect(res.ok === false && res.code).toBe("INVALID");
  });
});

describe("ledger invariants", () => {
  it("every asset in the ledger nets to zero across all owners", () => {
    const rows = getDb().select().from(schema.balances).all();
    const sums = new Map<string, bigint>();
    for (const r of rows) {
      const total = BigInt(r.available) + BigInt(r.pending);
      sums.set(r.asset, (sums.get(r.asset) ?? 0n) + total);
    }
    for (const [, sum] of sums) expect(sum).toBe(0n);
  });
});
