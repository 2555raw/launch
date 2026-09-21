"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAuth, requireMerchant } from "@/lib/auth/guard";
import { createMerchant, createPaymentRequest, refundPayment, createApiKey } from "@/lib/services/merchants";
import { createEndpoint, drainDeliveries } from "@/lib/services/webhooks";
import { isAssetId, isFiat, asset, type AssetId } from "@/lib/assets";
import { parseAmount } from "@/lib/money";
import { audit } from "@/lib/services/audit";
import { rateLimit } from "@/lib/auth/rateLimit";

export type MerchantState = { error?: string; ok?: string; secret?: string } | undefined;

export async function createMerchantAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { user } = requireAuth("/merchant");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your business name.").max(80),
      websiteUrl: z.string().trim().url("Enter a valid URL.").optional().or(z.literal("")),
      country: z.string().trim().length(2).optional().or(z.literal("")),
      settlementAsset: z.string().refine(isAssetId, "Pick a settlement asset."),
      pricingCurrency: z.string().refine(isFiat, "Pick a pricing currency."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  createMerchant({
    ownerUserId: user.id,
    name: parsed.data.name,
    websiteUrl: parsed.data.websiteUrl || undefined,
    country: parsed.data.country || undefined,
    settlementAsset: parsed.data.settlementAsset as AssetId,
    pricingCurrency: parsed.data.pricingCurrency as "EUR" | "USD",
  });
  redirect("/merchant/dashboard");
}

export async function createChargeAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { merchant } = requireMerchant();
  if (!rateLimit(`charge:${merchant.id}`, 60, 60_000).ok) return { error: "Too many payment requests. Slow down." };

  const parsed = z
    .object({
      amount: z.string().trim().min(1, "Enter an amount."),
      currency: z.string().min(3),
      description: z.string().trim().max(140).optional(),
      reference: z.string().trim().max(60).optional(),
      kind: z.enum(["qr", "link", "checkout", "pos"]).default("qr"),
      reusable: z.string().optional(),
      minutes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint;
  try {
    amount = isAssetId(parsed.data.currency)
      ? parseAmount(parsed.data.amount, asset(parsed.data.currency as AssetId).decimals)
      : parseAmount(parsed.data.amount, 2);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That amount is not valid." };
  }
  if (amount <= 0n) return { error: "Enter an amount greater than zero." };

  const minutes = Number(parsed.data.minutes ?? "30");
  const pr = createPaymentRequest({
    merchant,
    kind: parsed.data.kind,
    priceCurrency: parsed.data.currency,
    priceAmount: amount,
    description: parsed.data.description,
    reference: parsed.data.reference,
    reusable: parsed.data.reusable === "on",
    ttlMs: Number.isFinite(minutes) ? minutes * 60_000 : 30 * 60_000,
  });
  void drainDeliveries(5).catch(() => undefined);
  redirect(`/merchant/payments/${pr.code}`);
}

export async function refundAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { merchant } = requireMerchant();
  const parsed = z
    .object({
      transactionId: z.string().min(4),
      amount: z.string().trim().optional(),
      reason: z.string().trim().max(140).optional(),
      idempotencyKey: z.string().min(8),
      assetId: z.string().refine(isAssetId),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: bigint | undefined;
  if (parsed.data.amount) {
    try {
      amount = parseAmount(parsed.data.amount, asset(parsed.data.assetId as AssetId).decimals);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "That amount is not valid." };
    }
  }

  const result = await refundPayment({
    merchant,
    transactionId: parsed.data.transactionId,
    amount,
    reason: parsed.data.reason,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!result.ok) return { error: result.message };
  void drainDeliveries(5).catch(() => undefined);
  revalidatePath("/merchant/transactions");
  return { ok: "Refund sent." };
}

export async function updateMerchantAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { merchant } = requireMerchant();
  const accepted = formData.getAll("acceptedAssets").map(String).filter(isAssetId);
  if (!accepted.length) return { error: "Accept at least one asset." };

  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      websiteUrl: z.string().trim().url().optional().or(z.literal("")),
      settlementAsset: z.string().refine(isAssetId),
      pricingCurrency: z.string().refine(isFiat),
    })
    .safeParse({
      name: formData.get("name"),
      websiteUrl: formData.get("websiteUrl"),
      settlementAsset: formData.get("settlementAsset"),
      pricingCurrency: formData.get("pricingCurrency"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  getDb()
    .update(schema.merchants)
    .set({
      name: parsed.data.name,
      websiteUrl: parsed.data.websiteUrl || null,
      settlementAsset: parsed.data.settlementAsset,
      pricingCurrency: parsed.data.pricingCurrency,
      acceptedAssets: JSON.stringify(accepted),
      updatedAt: Date.now(),
    })
    .where(eq(schema.merchants.id, merchant.id))
    .run();
  audit({ type: "merchant", id: merchant.id }, "merchant.updated");
  revalidatePath("/merchant/settings");
  return { ok: "Settings saved." };
}

/** The full API key is returned to the form once and never stored in the clear. */
export async function createApiKeyAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { merchant } = requireMerchant();
  const name = String(formData.get("name") ?? "").trim() || "Untitled key";
  const key = createApiKey(merchant.id, name);
  audit({ type: "merchant", id: merchant.id }, "api_key.created", { type: "api_key", id: key.id });
  revalidatePath("/merchant/developers");
  return { ok: "Key created. Copy it now: it is not shown again.", secret: key.secret };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const { merchant } = requireMerchant();
  const keyId = String(formData.get("keyId") ?? "");
  getDb()
    .update(schema.apiKeys)
    .set({ revokedAt: Date.now() })
    .where(eq(schema.apiKeys.id, keyId))
    .run();
  audit({ type: "merchant", id: merchant.id }, "api_key.revoked", { type: "api_key", id: keyId });
  revalidatePath("/merchant/developers");
}

export async function createWebhookAction(_prev: MerchantState, formData: FormData): Promise<MerchantState> {
  const { merchant } = requireMerchant();
  const url = String(formData.get("url") ?? "").trim();
  const parsed = z.string().url("Enter a valid https URL.").safeParse(url);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
    return { error: "Webhook endpoints must use https." };
  }
  const endpoint = createEndpoint(merchant.id, url);
  audit({ type: "merchant", id: merchant.id }, "webhook.created", { type: "webhook", id: endpoint.id });
  revalidatePath("/merchant/developers");
  return { ok: "Endpoint added.", secret: endpoint.secret };
}
