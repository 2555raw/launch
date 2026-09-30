import "server-only";
import { decodeEventLog, parseUnits, type Hash } from "viem";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query, tx } from "@/lib/db";
import { env } from "@/lib/env";
import { PAYOUT_CHAIN_ID } from "@/lib/web3/chains";
import { publicClient } from "@/lib/web3/server";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { getSettings } from "./settings";

export interface Payout {
  id: string;
  userId: string;
  userShortId: number;
  walletAddress: `0x${string}`;
  amount: string;
  amountUnits: string;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  chainId: number;
  status: "prepared" | "submitted" | "confirmed" | "failed" | "cancelled";
  simulated: boolean;
  txHash: string | null;
  fromAddress: string | null;
  gasUsed: string | null;
  error: string | null;
  preparedBy: string;
  createdAt: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  rewardCount: number;
}

const COLUMNS = `p.id, p.user_id as "userId", u.short_id as "userShortId", p.wallet_address as "walletAddress",
  p.amount::text as amount, p.token_symbol as "tokenSymbol", p.token_address as "tokenAddress",
  p.token_decimals as "tokenDecimals", p.chain_id as "chainId", p.status, p.simulated, p.tx_hash as "txHash",
  p.from_address as "fromAddress", p.gas_used as "gasUsed", p.error, p.prepared_by as "preparedBy",
  p.created_at as "createdAt", p.submitted_at as "submittedAt", p.confirmed_at as "confirmedAt",
  (select count(*)::int from rewards r where r.payout_id = p.id) as "rewardCount"`;

function withUnits(p: Omit<Payout, "amountUnits">): Payout {
  return { ...p, amountUnits: parseUnits(p.amount, p.tokenDecimals).toString() };
}

export async function getPayout(id: string): Promise<Payout> {
  const row = await one<Omit<Payout, "amountUnits">>(
    `select ${COLUMNS} from payouts p join users u on u.id = p.user_id where p.id = $1`,
    [id],
  );
  if (!row) throw new HttpError(404, "Payout not found.", "not_found");
  return withUnits(row);
}

export async function listPayouts(opts: { userId?: string; status?: string; limit?: number } = {}) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.userId) where.push(`p.user_id = $${params.push(opts.userId)}`);
  if (opts.status && opts.status !== "all") where.push(`p.status = $${params.push(opts.status)}`);
  params.push(opts.limit ?? 100);
  const rows = await query<Omit<Payout, "amountUnits">>(
    `select ${COLUMNS} from payouts p join users u on u.id = p.user_id
     ${where.length ? "where " + where.join(" and ") : ""}
     order by p.created_at desc limit $${params.length}`,
    params,
  );
  return rows.map(withUnits);
}

/**
 * Bundles a user's approved rewards into one payout record. This only
 * prepares: no funds move until an authorised wallet signs the transfer.
 */
export async function preparePayout(userId: string, actor: string): Promise<Payout> {
  const settings = await getSettings();
  const id = await tx(async (q) => {
    const [user] = await q.query<{ wallet_address: string; status: string }>(
      "select wallet_address, status from users where id = $1 for update",
      [userId],
    );
    if (!user) throw new HttpError(404, "User not found.", "not_found");
    if (user.status !== "active") throw new HttpError(409, "This user is suspended.", "suspended");

    const [open] = await q.query<{ id: string }>(
      "select id from payouts where user_id = $1 and status in ('prepared', 'submitted') limit 1",
      [userId],
    );
    if (open) throw new HttpError(409, "This user already has a payout in progress.", "payout_in_progress");

    const rewards = await q.query<{ id: string; amount: string; token_symbol: string }>(
      "select id, amount::text as amount, token_symbol from rewards where user_id = $1 and status = 'approved' and payout_id is null for update",
      [userId],
    );
    if (!rewards.length) throw new HttpError(409, "No approved rewards waiting for payment.", "nothing_to_pay");
    const mismatched = rewards.find((r) => r.token_symbol !== settings.payoutTokenSymbol);
    if (mismatched) {
      throw new HttpError(409, `Some approved rewards are denominated in ${mismatched.token_symbol}, not the current payout token.`, "token_mismatch");
    }

    const [{ total }] = await q.query<{ total: string }>(
      "select sum(amount)::text as total from rewards where id = any($1::uuid[])",
      [rewards.map((r) => r.id)],
    );
    const [payout] = await q.query<{ id: string }>(
      `insert into payouts (user_id, wallet_address, amount, token_symbol, token_address, token_decimals, chain_id, prepared_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [userId, user.wallet_address, total, settings.payoutTokenSymbol, settings.payoutTokenAddress, settings.payoutTokenDecimals, PAYOUT_CHAIN_ID, actor],
    );
    await q.query("update rewards set status = 'processing', payout_id = $2 where id = any($1::uuid[])", [
      rewards.map((r) => r.id),
      payout.id,
    ]);
    await audit(actor, "payout.prepare", "payout", payout.id, { userId, amount: total, rewards: rewards.length }, q);
    return payout.id;
  });
  return getPayout(id);
}

export const submitSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a transaction hash"),
  from: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

/** Records the hash returned by the admin's wallet after they signed the transfer. */
export async function markSubmitted(id: string, input: unknown, actor: string): Promise<Payout> {
  const { txHash, from } = submitSchema.parse(input);
  if (!env.payoutWallets.includes(from.toLowerCase())) {
    throw new HttpError(403, "This wallet is not authorised to send payouts.", "unauthorised_wallet");
  }
  const row = await one<{ id: string }>(
    `update payouts set status = 'submitted', tx_hash = $2, from_address = $3, submitted_at = now()
      where id = $1 and status = 'prepared' returning id`,
    [id, txHash.toLowerCase(), from.toLowerCase()],
  );
  if (!row) throw new HttpError(409, "Only a prepared payout can be submitted.", "bad_state");
  await audit(actor, "payout.submitted", "payout", id, { txHash, from });
  return getPayout(id);
}

/**
 * Verifies the transfer on-chain from the server's own RPC before marking the
 * payout confirmed: successful receipt, right token contract, an authorised
 * sender, the user's address as recipient and the exact amount.
 */
export async function confirmOnChain(id: string, actor: string): Promise<{ payout: Payout; pending: boolean }> {
  const payout = await getPayout(id);
  if (payout.status === "confirmed") return { payout, pending: false };
  if (payout.status !== "submitted" || !payout.txHash) {
    throw new HttpError(409, "Only a submitted payout can be confirmed.", "bad_state");
  }
  if (payout.chainId !== PAYOUT_CHAIN_ID) throw new HttpError(409, "Payout was prepared for another network.", "wrong_chain");

  const client = publicClient();
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: payout.txHash as Hash });
  } catch {
    return { payout, pending: true };
  }

  const fail = async (reason: string, releaseRewards: boolean) => {
    await tx(async (q) => {
      await q.query("update payouts set status = 'failed', error = $2 where id = $1", [id, reason]);
      if (releaseRewards) {
        await q.query("update rewards set status = 'approved', payout_id = null where payout_id = $1", [id]);
      }
      await audit(actor, "payout.failed", "payout", id, { reason, txHash: payout.txHash }, q);
    });
    return { payout: await getPayout(id), pending: false };
  };

  if (receipt.status !== "success") return fail("Transaction reverted on-chain. No funds moved.", true);

  const expected = BigInt(payout.amountUnits);
  const match = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== payout.tokenAddress.toLowerCase()) return false;
    try {
      const ev = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
      return (
        ev.eventName === "Transfer" &&
        ev.args.from.toLowerCase() === payout.fromAddress &&
        env.payoutWallets.includes(ev.args.from.toLowerCase()) &&
        ev.args.to.toLowerCase() === payout.walletAddress.toLowerCase() &&
        ev.args.value === expected
      );
    } catch {
      return false;
    }
  });
  if (!match) {
    // The transaction succeeded but did not do what the payout describes: keep the
    // rewards locked until an admin looks at it, to rule out paying twice.
    return fail("Transaction found but it does not match this payout (token, sender, recipient or amount). Review manually.", false);
  }

  await tx(async (q) => {
    await q.query(
      "update payouts set status = 'confirmed', confirmed_at = now(), gas_used = $2, error = null where id = $1",
      [id, receipt.gasUsed.toString()],
    );
    await q.query("update rewards set status = 'paid' where payout_id = $1", [id]);
    await audit(actor, "payout.confirmed", "payout", id, { txHash: payout.txHash, block: receipt.blockNumber.toString() }, q);
  });
  return { payout: await getPayout(id), pending: false };
}

/** Cancels a payout that never went out (or failed) and returns its rewards to "approved". */
export async function cancelPayout(id: string, actor: string): Promise<Payout> {
  await tx(async (q) => {
    const [row] = await q.query<{ id: string }>(
      "update payouts set status = 'cancelled' where id = $1 and status in ('prepared', 'failed') returning id",
      [id],
    );
    if (!row) throw new HttpError(409, "Only prepared or failed payouts can be cancelled.", "bad_state");
    await q.query("update rewards set status = 'approved', payout_id = null where payout_id = $1", [id]);
    await audit(actor, "payout.cancel", "payout", id, {}, q);
  });
  return getPayout(id);
}

/** Demo mode only: marks a payout as paid without any transfer, clearly flagged as simulated. */
export async function simulatePayout(id: string, actor: string): Promise<Payout> {
  if (!env.demoMode) throw new HttpError(403, "Simulated payouts are disabled outside demo mode.", "demo_only");
  await tx(async (q) => {
    const [row] = await q.query<{ id: string }>(
      `update payouts set status = 'confirmed', simulated = true, confirmed_at = now(), submitted_at = now()
        where id = $1 and status = 'prepared' returning id`,
      [id],
    );
    if (!row) throw new HttpError(409, "Only a prepared payout can be simulated.", "bad_state");
    await q.query("update rewards set status = 'paid' where payout_id = $1", [id]);
    await audit(actor, "payout.simulated", "payout", id, {}, q);
  });
  return getPayout(id);
}
