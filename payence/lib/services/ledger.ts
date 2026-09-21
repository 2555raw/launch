import { eq, and, desc, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id } from "@/lib/ids";
import { fromDb, toDb, type Amount } from "@/lib/money";
import type { AssetId } from "@/lib/assets";

/**
 * The ledger. Every movement of value is a transaction with a set of entries
 * that sum to zero per asset, applied atomically. Users and merchants can never
 * go negative; the "external" and "platform" owners can, because they stand
 * for value outside the ledger (on-chain funds, liquidity) and for fee income.
 */

export type OwnerType = "user" | "merchant" | "platform" | "external";
export type Owner = { type: OwnerType; id: string };
export type Bucket = "available" | "pending";

export const PLATFORM_FEES: Owner = { type: "platform", id: "fees" };
export const PLATFORM_TREASURY: Owner = { type: "platform", id: "treasury" };
export const chainOwner = (network: string): Owner => ({ type: "external", id: `chain:${network}` });

export type Entry = { owner: Owner; asset: AssetId; amount: Amount; bucket: Bucket };

export class LedgerError extends Error {
  constructor(public code: "INSUFFICIENT_FUNDS" | "UNBALANCED" | "FROZEN", message: string) {
    super(message);
  }
}

export function balanceId(owner: Owner, asset: AssetId): string {
  return `${owner.type}:${owner.id}:${asset}`;
}

export type BalanceView = { asset: AssetId; available: Amount; pending: Amount };

export function getBalances(owner: Owner): BalanceView[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.balances)
    .where(and(eq(schema.balances.ownerType, owner.type), eq(schema.balances.ownerId, owner.id)))
    .all();
  return rows.map((r) => ({ asset: r.asset as AssetId, available: fromDb(r.available), pending: fromDb(r.pending) }));
}

export function getBalance(owner: Owner, asset: AssetId): BalanceView {
  const row = getDb().select().from(schema.balances).where(eq(schema.balances.id, balanceId(owner, asset))).get();
  return { asset, available: fromDb(row?.available), pending: fromDb(row?.pending) };
}

/**
 * Apply entries atomically. Must be called inside a db.transaction. Throws
 * LedgerError when the entries do not balance or a customer would go negative.
 */
export function applyEntries(tx: ReturnType<typeof getDb>, transactionId: string, entries: Entry[]) {
  const sums = new Map<string, Amount>();
  for (const e of entries) sums.set(e.asset, (sums.get(e.asset) ?? 0n) + e.amount);
  for (const [asset, sum] of sums) {
    if (sum !== 0n) throw new LedgerError("UNBALANCED", `Entries for ${asset} sum to ${sum}, not zero`);
  }
  const now = Date.now();
  for (const e of entries) {
    const bid = balanceId(e.owner, e.asset);
    const row = tx.select().from(schema.balances).where(eq(schema.balances.id, bid)).get();
    const available = fromDb(row?.available);
    const pending = fromDb(row?.pending);
    const next = { available, pending };
    next[e.bucket] += e.amount;
    const customer = e.owner.type === "user" || e.owner.type === "merchant";
    if (customer && (next.available < 0n || next.pending < 0n)) {
      throw new LedgerError("INSUFFICIENT_FUNDS", "Insufficient balance");
    }
    if (row) {
      tx.update(schema.balances)
        .set({ available: toDb(next.available), pending: toDb(next.pending), updatedAt: now })
        .where(eq(schema.balances.id, bid))
        .run();
    } else {
      tx.insert(schema.balances)
        .values({
          id: bid,
          ownerType: e.owner.type,
          ownerId: e.owner.id,
          asset: e.asset,
          available: toDb(next.available),
          pending: toDb(next.pending),
          updatedAt: now,
        })
        .run();
    }
    tx.insert(schema.ledgerEntries)
      .values({ id: id("le"), transactionId, balanceId: bid, asset: e.asset, amount: toDb(e.amount), bucket: e.bucket, createdAt: now })
      .run();
  }
}

export type TxType = "deposit" | "withdrawal" | "transfer" | "payment" | "refund" | "conversion";
export type TxStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "expired";

export type NewTransaction = {
  type: TxType;
  status: TxStatus;
  asset: AssetId;
  amount: Amount;
  fee?: Amount;
  from?: Owner;
  to?: Owner;
  counterparty?: string;
  network?: string;
  txHash?: string;
  address?: string;
  reference?: string;
  fiatCurrency?: string;
  fiatAmount?: Amount;
  rate?: string;
  idempotencyKey?: string;
  paymentRequestId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Create a transaction and post its entries in one atomic step. If an
 * idempotency key was seen before, the original transaction is returned and
 * nothing is posted, so a retried request can never move money twice.
 */
export function postTransaction(input: NewTransaction, entries: Entry[]): { tx: schema.Transaction; replayed: boolean } {
  const db = getDb();
  return db.transaction((t) => {
    if (input.idempotencyKey) {
      const existing = t
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.idempotencyKey, input.idempotencyKey))
        .get();
      if (existing) return { tx: existing, replayed: true };
    }
    const now = Date.now();
    const row: typeof schema.transactions.$inferInsert = {
      id: id("txn"),
      type: input.type,
      status: input.status,
      asset: input.asset,
      amount: toDb(input.amount),
      fee: toDb(input.fee ?? 0n),
      fromType: input.from?.type,
      fromId: input.from?.id,
      toType: input.to?.type,
      toId: input.to?.id,
      counterparty: input.counterparty,
      network: input.network,
      txHash: input.txHash,
      address: input.address,
      reference: input.reference,
      fiatCurrency: input.fiatCurrency,
      fiatAmount: input.fiatAmount !== undefined ? toDb(input.fiatAmount) : undefined,
      rate: input.rate,
      idempotencyKey: input.idempotencyKey,
      paymentRequestId: input.paymentRequestId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      createdAt: now,
      updatedAt: now,
      completedAt: input.status === "completed" ? now : undefined,
    };
    t.insert(schema.transactions).values(row).run();
    applyEntries(t, row.id, entries);
    const tx = t.select().from(schema.transactions).where(eq(schema.transactions.id, row.id)).get()!;
    return { tx, replayed: false };
  });
}

/** Move a transaction to a new status and post the entries that go with it. */
export function transitionTransaction(
  transactionId: string,
  status: TxStatus,
  entries: Entry[],
  patch: Partial<Pick<schema.Transaction, "txHash" | "failureReason" | "metadata" | "network" | "address">> = {}
): schema.Transaction {
  const db = getDb();
  return db.transaction((t) => {
    const now = Date.now();
    t.update(schema.transactions)
      .set({ status, updatedAt: now, completedAt: status === "completed" ? now : undefined, ...patch })
      .where(eq(schema.transactions.id, transactionId))
      .run();
    applyEntries(t, transactionId, entries);
    return t.select().from(schema.transactions).where(eq(schema.transactions.id, transactionId)).get()!;
  });
}

export function getTransaction(transactionId: string): schema.Transaction | undefined {
  return getDb().select().from(schema.transactions).where(eq(schema.transactions.id, transactionId)).get();
}

export type TxFilter = {
  q?: string;
  asset?: AssetId;
  status?: TxStatus;
  type?: TxType;
  from?: number;
  to?: number;
  limit?: number;
};

/** Every transaction the owner was on either side of, newest first. */
export function listTransactions(owner: Owner, f: TxFilter = {}): schema.Transaction[] {
  const t = schema.transactions;
  const conds = [
    or(and(eq(t.fromType, owner.type), eq(t.fromId, owner.id)), and(eq(t.toType, owner.type), eq(t.toId, owner.id))),
  ];
  if (f.asset) conds.push(eq(t.asset, f.asset));
  if (f.status) conds.push(eq(t.status, f.status));
  if (f.type) conds.push(eq(t.type, f.type));
  if (f.from) conds.push(sql`${t.createdAt} >= ${f.from}`);
  if (f.to) conds.push(sql`${t.createdAt} <= ${f.to}`);
  if (f.q) {
    const like = `%${f.q.toLowerCase()}%`;
    conds.push(
      or(
        sql`lower(coalesce(${t.counterparty}, '')) like ${like}`,
        sql`lower(coalesce(${t.reference}, '')) like ${like}`,
        sql`lower(coalesce(${t.txHash}, '')) like ${like}`,
        sql`lower(${t.id}) like ${like}`
      )
    );
  }
  return getDb()
    .select()
    .from(t)
    .where(and(...conds))
    .orderBy(desc(t.createdAt))
    .limit(f.limit ?? 100)
    .all();
}

/** Direction of a transaction from the point of view of one owner. */
export function directionFor(tx: schema.Transaction, owner: Owner): "in" | "out" | "internal" {
  const isFrom = tx.fromType === owner.type && tx.fromId === owner.id;
  const isTo = tx.toType === owner.type && tx.toId === owner.id;
  if (isFrom && isTo) return "internal";
  return isFrom ? "out" : "in";
}

/**
 * Fund the platform's conversion treasury the way a real desk would: value
 * arrives from outside the ledger (a liquidity provider), so it is posted as a
 * balanced pair rather than written straight into a balance row.
 */
export function fundTreasury(asset: AssetId, amount: Amount, source = "liquidity-provider") {
  return postTransaction(
    {
      type: "deposit",
      status: "completed",
      asset,
      amount,
      from: { type: "external", id: source },
      to: PLATFORM_TREASURY,
      counterparty: source,
      idempotencyKey: `treasury:${asset}:${source}:${amount}`,
    },
    [
      { owner: { type: "external", id: source }, asset, amount: -amount, bucket: "available" },
      { owner: PLATFORM_TREASURY, asset, amount, bucket: "available" },
    ]
  );
}
