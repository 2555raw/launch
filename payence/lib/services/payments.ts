import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id, shortCode } from "@/lib/ids";
import { asset, isAssetId, type AssetId, type FiatCurrency, isFiat } from "@/lib/assets";
import { network, type NetworkId } from "@/lib/networks";
import { convert, feeOf, fromDb, parseAmount, toDb } from "@/lib/money";
import { FEES } from "./fees";
import { checkLimits } from "./limits";
import { fiatRate } from "@/lib/providers/rates";
import { compliance } from "@/lib/providers/compliance";
import { chain } from "@/lib/providers/chain";
import { audit } from "./audit";
import { notify } from "./notifications";
import { emit } from "./webhooks";
import {
  applyEntries,
  chainOwner,
  getBalance,
  LedgerError,
  PLATFORM_FEES,
  PLATFORM_TREASURY,
  postTransaction,
  transitionTransaction,
  type Entry,
  type Owner,
} from "./ledger";

/**
 * Every money movement in the product. Services return a tagged result rather
 * than throwing for expected outcomes (insufficient balance, a limit, an
 * expired request), because those are states the UI has to render, not bugs.
 */
export type Failure = {
  ok: false;
  code:
    | "INSUFFICIENT_FUNDS"
    | "LIMIT"
    | "COMPLIANCE"
    | "NOT_FOUND"
    | "EXPIRED"
    | "ALREADY_PAID"
    | "INVALID"
    | "SELF_PAYMENT"
    | "FROZEN"
    | "NETWORK";
  message: string;
};

export type Success<T> = { ok: true } & T;
export type Result<T> = Success<T> | Failure;

const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });

/** Value of an asset amount in a fiat currency, in cents, at today's rate. */
export async function fiatValue(amount: bigint, assetId: AssetId, currency: FiatCurrency) {
  const quote = await fiatRate(assetId, currency);
  return { cents: convert(amount, asset(assetId).decimals, 2, quote.rate), quote };
}

// --- Transfers between Payence accounts -------------------------------------

export async function sendToUser(input: {
  fromUser: schema.User;
  toHandleOrEmail: string;
  assetId: AssetId;
  amount: bigint;
  note?: string;
  idempotencyKey: string;
}): Promise<Result<{ transaction: schema.Transaction }>> {
  const db = getDb();
  const target = input.toHandleOrEmail.trim().toLowerCase().replace(/^@/, "");
  const recipient = db
    .select()
    .from(schema.users)
    .where(target.includes("@") ? eq(schema.users.email, target) : eq(schema.users.handle, target))
    .get();
  if (!recipient) return fail("NOT_FOUND", "No Payence account matches that handle or email.");
  if (recipient.id === input.fromUser.id) return fail("SELF_PAYMENT", "You cannot send money to yourself.");
  if (recipient.status !== "active") return fail("FROZEN", "That account cannot receive payments right now.");
  if (input.amount <= 0n) return fail("INVALID", "Enter an amount greater than zero.");

  const currency = input.fromUser.displayCurrency as FiatCurrency;
  const { cents, quote } = await fiatValue(input.amount, input.assetId, currency);

  const limit = checkLimits(input.fromUser, cents);
  if (!limit.ok) return fail("LIMIT", limit.message);

  const screen = await compliance().screenTransaction({
    userId: input.fromUser.id,
    kind: "transfer",
    fiatCents: cents,
    currency,
    counterparty: recipient.handle,
  });
  if (screen.outcome === "block") return fail("COMPLIANCE", screen.reason);

  const from: Owner = { type: "user", id: input.fromUser.id };
  const to: Owner = { type: "user", id: recipient.id };
  const fee = feeOf(input.amount, FEES.transferBps);
  const entries: Entry[] = [
    { owner: from, asset: input.assetId, amount: -input.amount, bucket: "available" },
    { owner: to, asset: input.assetId, amount: input.amount - fee, bucket: "available" },
  ];
  if (fee > 0n) entries.push({ owner: PLATFORM_FEES, asset: input.assetId, amount: fee, bucket: "available" });

  try {
    const { tx, replayed } = postTransaction(
      {
        type: "transfer",
        status: "completed",
        asset: input.assetId,
        amount: input.amount,
        fee,
        from,
        to,
        counterparty: recipient.name,
        reference: input.note,
        fiatCurrency: currency,
        fiatAmount: cents,
        rate: quote.rate,
        idempotencyKey: input.idempotencyKey,
        metadata: { recipientHandle: recipient.handle, senderHandle: input.fromUser.handle },
      },
      entries
    );
    if (!replayed) {
      audit({ type: "user", id: input.fromUser.id }, "transfer.sent", { type: "transaction", id: tx.id });
      notify(recipient.id, {
        kind: "payment",
        title: `You received ${fmt(input.amount, input.assetId)}`,
        body: `${input.fromUser.name} sent you money${input.note ? `: ${input.note}` : "."}`,
        href: `/transactions/${tx.id}`,
      });
    }
    return { ok: true, transaction: tx };
  } catch (err) {
    if (err instanceof LedgerError && err.code === "INSUFFICIENT_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", `Not enough ${input.assetId} to cover this transfer.`);
    }
    throw err;
  }
}

// --- Deposits ----------------------------------------------------------------

export async function depositAddressFor(userId: string, net: NetworkId) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.depositAddresses)
    .where(and(eq(schema.depositAddresses.userId, userId), eq(schema.depositAddresses.network, net)))
    .get();
  if (existing) return existing;
  const count = db.select().from(schema.depositAddresses).all().length;
  const address = await chain().deriveDepositAddress(net, count + 1);
  const row = { id: id("dep"), userId, network: net, address, derivationIndex: count + 1, createdAt: Date.now() };
  db.insert(schema.depositAddresses).values(row).run();
  return row;
}

/**
 * Credit a confirmed on-chain deposit. Idempotent on the transaction hash, so
 * a chain watcher that re-reads a block cannot double-credit.
 */
export async function creditDeposit(input: {
  user: schema.User;
  assetId: AssetId;
  amount: bigint;
  network: NetworkId;
  txHash: string;
  address: string;
}): Promise<Result<{ transaction: schema.Transaction }>> {
  const currency = input.user.displayCurrency as FiatCurrency;
  const { cents, quote } = await fiatValue(input.amount, input.assetId, currency);
  const to: Owner = { type: "user", id: input.user.id };
  const { tx, replayed } = postTransaction(
    {
      type: "deposit",
      status: "completed",
      asset: input.assetId,
      amount: input.amount,
      from: chainOwner(input.network),
      to,
      counterparty: `${network(input.network).name} deposit`,
      network: input.network,
      txHash: input.txHash,
      address: input.address,
      fiatCurrency: currency,
      fiatAmount: cents,
      rate: quote.rate,
      idempotencyKey: `deposit:${input.network}:${input.txHash}`,
    },
    [
      { owner: chainOwner(input.network), asset: input.assetId, amount: -input.amount, bucket: "available" },
      { owner: to, asset: input.assetId, amount: input.amount, bucket: "available" },
    ]
  );
  if (!replayed) {
    audit({ type: "system", id: "chain-watcher" }, "deposit.credited", { type: "transaction", id: tx.id });
    notify(input.user.id, {
      kind: "payment",
      title: `${fmt(input.amount, input.assetId)} arrived`,
      body: `Your deposit on ${network(input.network).name} confirmed.`,
      href: `/transactions/${tx.id}`,
    });
  }
  return { ok: true, transaction: tx };
}

// --- Withdrawals -------------------------------------------------------------

export async function withdraw(input: {
  user: schema.User;
  assetId: AssetId;
  amount: bigint;
  network: NetworkId;
  address: string;
  idempotencyKey: string;
}): Promise<Result<{ transaction: schema.Transaction }>> {
  if (input.amount <= 0n) return fail("INVALID", "Enter an amount greater than zero.");
  if (!network(input.network).tokens[input.assetId]) {
    return fail("INVALID", `${input.assetId} cannot be sent over ${network(input.network).name}.`);
  }
  if (!chain().isValidAddress(input.network, input.address)) {
    return fail("INVALID", `That is not a valid ${network(input.network).name} address.`);
  }

  const currency = input.user.displayCurrency as FiatCurrency;
  const { cents, quote } = await fiatValue(input.amount, input.assetId, currency);
  const limit = checkLimits(input.user, cents);
  if (!limit.ok) return fail("LIMIT", limit.message);

  const screen = await compliance().screenTransaction({
    userId: input.user.id,
    kind: "withdrawal",
    fiatCents: cents,
    currency,
    address: input.address,
    network: input.network,
  });
  if (screen.outcome === "block") return fail("COMPLIANCE", screen.reason);

  const networkFee = await chain().estimateFee(input.network, input.assetId);
  const total = input.amount + networkFee;
  const from: Owner = { type: "user", id: input.user.id };

  // Funds leave `available` and sit in `pending` until the chain confirms.
  let tx: schema.Transaction;
  try {
    const posted = postTransaction(
      {
        type: "withdrawal",
        status: "processing",
        asset: input.assetId,
        amount: input.amount,
        fee: networkFee,
        from,
        to: chainOwner(input.network),
        counterparty: shorten(input.address),
        network: input.network,
        address: input.address,
        fiatCurrency: currency,
        fiatAmount: cents,
        rate: quote.rate,
        idempotencyKey: input.idempotencyKey,
      },
      [
        { owner: from, asset: input.assetId, amount: -total, bucket: "available" },
        { owner: from, asset: input.assetId, amount: total, bucket: "pending" },
      ]
    );
    tx = posted.tx;
    if (posted.replayed) return { ok: true, transaction: tx };
  } catch (err) {
    if (err instanceof LedgerError && err.code === "INSUFFICIENT_FUNDS") {
      return fail(
        "INSUFFICIENT_FUNDS",
        `Not enough ${input.assetId}. This withdrawal needs ${fmt(total, input.assetId)} including the network fee.`
      );
    }
    throw err;
  }

  try {
    const { hash } = await chain().sendTransfer({
      network: input.network,
      asset: input.assetId,
      to: input.address,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    });
    // Broadcast accepted: clear the pending hold against the chain owner.
    const settled = transitionTransaction(
      tx.id,
      "completed",
      [
        { owner: from, asset: input.assetId, amount: -total, bucket: "pending" },
        { owner: chainOwner(input.network), asset: input.assetId, amount: input.amount, bucket: "available" },
        ...(networkFee > 0n
          ? [{ owner: PLATFORM_FEES, asset: input.assetId, amount: networkFee, bucket: "available" as const }]
          : []),
      ],
      { txHash: hash }
    );
    audit({ type: "user", id: input.user.id }, "withdrawal.sent", { type: "transaction", id: tx.id });
    notify(input.user.id, {
      kind: "payment",
      title: `${fmt(input.amount, input.assetId)} sent`,
      body: `Withdrawal to ${shorten(input.address)} broadcast on ${network(input.network).name}.`,
      href: `/transactions/${tx.id}`,
    });
    return { ok: true, transaction: settled };
  } catch (err) {
    // Broadcast failed: give the money back, in full, including the fee.
    transitionTransaction(
      tx.id,
      "failed",
      [
        { owner: from, asset: input.assetId, amount: -total, bucket: "pending" },
        { owner: from, asset: input.assetId, amount: total, bucket: "available" },
      ],
      { failureReason: err instanceof Error ? err.message.slice(0, 200) : "Broadcast failed" }
    );
    return fail("NETWORK", "The network would not accept this transfer. Your balance was not charged.");
  }
}

// --- Conversions -------------------------------------------------------------

export async function convertAssets(input: {
  user: schema.User;
  from: AssetId;
  to: AssetId;
  amount: bigint;
  idempotencyKey: string;
}): Promise<Result<{ transaction: schema.Transaction; received: bigint }>> {
  if (input.from === input.to) return fail("INVALID", "Pick two different assets.");
  if (input.amount <= 0n) return fail("INVALID", "Enter an amount greater than zero.");
  const quote = await fiatRate(input.from, asset(input.to).peg);
  const gross = convert(input.amount, asset(input.from).decimals, asset(input.to).decimals, quote.rate);
  const fee = feeOf(gross, FEES.conversionBps);
  const received = gross - fee;
  const owner: Owner = { type: "user", id: input.user.id };
  try {
    const { tx } = postTransaction(
      {
        type: "conversion",
        status: "completed",
        asset: input.from,
        amount: input.amount,
        fee,
        from: owner,
        to: owner,
        counterparty: `${input.from} → ${input.to}`,
        rate: quote.rate,
        idempotencyKey: input.idempotencyKey,
        metadata: { toAsset: input.to, received: received.toString(), grossReceived: gross.toString() },
      },
      [
        { owner, asset: input.from, amount: -input.amount, bucket: "available" },
        { owner: PLATFORM_TREASURY, asset: input.from, amount: input.amount, bucket: "available" },
        { owner: PLATFORM_TREASURY, asset: input.to, amount: -gross, bucket: "available" },
        { owner, asset: input.to, amount: received, bucket: "available" },
        ...(fee > 0n ? [{ owner: PLATFORM_FEES, asset: input.to, amount: fee, bucket: "available" as const }] : []),
      ]
    );
    audit({ type: "user", id: input.user.id }, "conversion.completed", { type: "transaction", id: tx.id });
    return { ok: true, transaction: tx, received };
  } catch (err) {
    if (err instanceof LedgerError && err.code === "INSUFFICIENT_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", `Not enough ${input.from} to convert.`);
    }
    throw err;
  }
}

function fmt(amount: bigint, assetId: AssetId) {
  const a = asset(assetId);
  const s = (Number(amount) / 10 ** a.decimals).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} ${a.symbol}`;
}

export function shorten(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export { parseAmount, fromDb, toDb, isAssetId, isFiat, getBalance, applyEntries, id, shortCode, emit, desc };
