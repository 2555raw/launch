"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guard";
import { requestIp } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/auth/rateLimit";
import { isAssetId, asset, type AssetId } from "@/lib/assets";
import { isNetworkId, type NetworkId } from "@/lib/networks";
import { parseAmount } from "@/lib/money";
import { sendToUser, withdraw, convertAssets, creditDeposit } from "@/lib/services/payments";
import { payRequest, getPaymentRequest, effectiveStatus } from "@/lib/services/merchants";
import { markAllRead } from "@/lib/services/notifications";
import { SIMULATED_CHAIN } from "@/lib/config";
import { drainDeliveries } from "@/lib/services/webhooks";

export type ActionState = { error?: string; code?: string } | undefined;

/**
 * Every money action goes through here: authenticate, rate limit, validate,
 * then call the service. The idempotency key comes from the form, minted once
 * when the form rendered, so a double submit cannot post twice.
 */
function guardMoney(): { user: ReturnType<typeof requireActiveUser>["user"] } | { error: string } {
  const { user } = requireActiveUser();
  const key = `pay:${user.id}`;
  if (!rateLimit(key, LIMITS.payment.limit, LIMITS.payment.windowMs).ok) {
    return { error: "Too many payment attempts in a short time. Wait a moment and try again." };
  }
  return { user };
}

const amountField = z.string().trim().min(1, "Enter an amount.");

export async function sendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = guardMoney();
  if ("error" in guard) return { error: guard.error };

  const parsed = z
    .object({
      recipient: z.string().trim().min(1, "Enter a handle or email address."),
      assetId: z.string().refine(isAssetId, "Pick an asset."),
      amount: amountField,
      note: z.string().trim().max(140).optional(),
      idempotencyKey: z.string().min(8),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint;
  try {
    amount = parseAmount(parsed.data.amount, asset(parsed.data.assetId as AssetId).decimals);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That amount is not valid." };
  }

  const result = await sendToUser({
    fromUser: guard.user,
    toHandleOrEmail: parsed.data.recipient,
    assetId: parsed.data.assetId as AssetId,
    amount,
    note: parsed.data.note,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!result.ok) return { error: result.message, code: result.code };

  revalidatePath("/dashboard");
  revalidatePath("/wallet");
  redirect(`/transactions/${result.transaction.id}?new=1`);
}

export async function withdrawAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = guardMoney();
  if ("error" in guard) return { error: guard.error };

  const parsed = z
    .object({
      assetId: z.string().refine(isAssetId, "Pick an asset."),
      network: z.string().refine(isNetworkId, "Pick a network."),
      address: z.string().trim().min(10, "Enter the destination address."),
      amount: amountField,
      idempotencyKey: z.string().min(8),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint;
  try {
    amount = parseAmount(parsed.data.amount, asset(parsed.data.assetId as AssetId).decimals);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That amount is not valid." };
  }

  const result = await withdraw({
    user: guard.user,
    assetId: parsed.data.assetId as AssetId,
    network: parsed.data.network as NetworkId,
    address: parsed.data.address,
    amount,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!result.ok) return { error: result.message, code: result.code };

  revalidatePath("/wallet");
  redirect(`/transactions/${result.transaction.id}?new=1`);
}

export async function convertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = guardMoney();
  if ("error" in guard) return { error: guard.error };

  const parsed = z
    .object({
      from: z.string().refine(isAssetId, "Pick an asset."),
      to: z.string().refine(isAssetId, "Pick an asset."),
      amount: amountField,
      idempotencyKey: z.string().min(8),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint;
  try {
    amount = parseAmount(parsed.data.amount, asset(parsed.data.from as AssetId).decimals);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That amount is not valid." };
  }

  const result = await convertAssets({
    user: guard.user,
    from: parsed.data.from as AssetId,
    to: parsed.data.to as AssetId,
    amount,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!result.ok) return { error: result.message, code: result.code };

  revalidatePath("/wallet");
  redirect(`/transactions/${result.transaction.id}?new=1`);
}

export async function payRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = guardMoney();
  if ("error" in guard) return { error: guard.error };

  const parsed = z
    .object({
      code: z.string().trim().min(4),
      assetId: z.string().refine(isAssetId, "Pick an asset."),
      idempotencyKey: z.string().min(8),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const request = getPaymentRequest(parsed.data.code);
  if (!request) return { error: "That payment request no longer exists.", code: "NOT_FOUND" };

  const result = await payRequest({
    user: guard.user,
    request,
    assetId: parsed.data.assetId as AssetId,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!result.ok) return { error: result.message, code: result.code };

  // Webhooks are queued by the service; flush opportunistically here. In
  // production a worker owns this, so delivery never rides on a user request.
  void drainDeliveries(5).catch(() => undefined);

  revalidatePath("/dashboard");
  redirect(`/checkout/${request.code}/done?tx=${result.transaction.id}`);
}

/**
 * Demo-only: credit a deposit without a real chain. Refuses outright when a
 * real chain provider is configured, so it cannot mint balance in production.
 */
export async function simulateDepositAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = requireActiveUser();
  if (!SIMULATED_CHAIN) return { error: "Simulated deposits are disabled when a real chain provider is configured." };
  if (!rateLimit(`sim:${user.id}`, 10, 60_000).ok) return { error: "Slow down a moment." };

  const parsed = z
    .object({
      assetId: z.string().refine(isAssetId, "Pick an asset."),
      network: z.string().refine(isNetworkId, "Pick a network."),
      amount: amountField,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint;
  try {
    amount = parseAmount(parsed.data.amount, asset(parsed.data.assetId as AssetId).decimals);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That amount is not valid." };
  }
  if (amount > 10_000_000_000n) return { error: "Demo deposits are capped at 10,000." };

  const { createHash } = await import("crypto");
  const hash =
    "0x" + createHash("sha256").update(`${user.id}:${Date.now()}:${Math.random()}`).digest("hex");

  await creditDeposit({
    user,
    assetId: parsed.data.assetId as AssetId,
    amount,
    network: parsed.data.network as NetworkId,
    txHash: hash,
    address: "0x" + "0".repeat(40),
  });
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
  return undefined;
}

export async function markNotificationsReadAction() {
  const { user } = requireActiveUser();
  markAllRead(user.id);
  revalidatePath("/notifications");
}

export { requestIp };
