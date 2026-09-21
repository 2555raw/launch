import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Amounts are TEXT holding a base-unit integer (see lib/money.ts). Timestamps
 * are integer milliseconds. The schema is dialect-neutral in spirit: swapping
 * to Postgres is a driver and column-type change, not a data-model change.
 */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerifiedAt: integer("email_verified_at"),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    country: text("country"),
    displayCurrency: text("display_currency").notNull().default("EUR"),
    kycStatus: text("kyc_status").notNull().default("not_started"), // not_started | pending | approved | rejected
    kycTier: integer("kyc_tier").notNull().default(0), // 0 none, 1 basic, 2 verified
    status: text("status").notNull().default("active"), // active | frozen | closed
    totpSecret: text("totp_secret"), // encrypted at rest
    totpEnabledAt: integer("totp_enabled_at"),
    dailyLimitCents: integer("daily_limit_cents"), // user-set, below tier cap
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({ email: uniqueIndex("users_email").on(t.email), handle: uniqueIndex("users_handle").on(t.handle) })
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: text("user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    mfaPassed: integer("mfa_passed", { mode: "boolean" }).notNull().default(false),
    userAgent: text("user_agent"),
    ip: text("ip"),
    revokedAt: integer("revoked_at"),
  },
  (t) => ({ user: index("sessions_user").on(t.userId) })
);

export const tokens = sqliteTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(), // email_verify | password_reset
    hash: text("hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
  },
  (t) => ({ hash: index("tokens_hash").on(t.hash) })
);

export const balances = sqliteTable(
  "balances",
  {
    id: text("id").primaryKey(), // `${ownerType}:${ownerId}:${asset}`
    ownerType: text("owner_type").notNull(), // user | merchant | platform | external
    ownerId: text("owner_id").notNull(),
    asset: text("asset").notNull(),
    available: text("available").notNull().default("0"),
    pending: text("pending").notNull().default("0"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({ owner: index("balances_owner").on(t.ownerType, t.ownerId) })
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // deposit | withdrawal | transfer | payment | refund | conversion
    status: text("status").notNull(), // pending | processing | completed | failed | cancelled | expired
    asset: text("asset").notNull(),
    amount: text("amount").notNull(), // gross, in asset base units
    fee: text("fee").notNull().default("0"),
    fromType: text("from_type"),
    fromId: text("from_id"),
    toType: text("to_type"),
    toId: text("to_id"),
    counterparty: text("counterparty"), // display label for the other side
    network: text("network"),
    txHash: text("tx_hash"),
    address: text("address"),
    reference: text("reference"),
    fiatCurrency: text("fiat_currency"),
    fiatAmount: text("fiat_amount"), // cents, at the time of the transaction
    rate: text("rate"),
    idempotencyKey: text("idempotency_key"),
    paymentRequestId: text("payment_request_id"),
    failureReason: text("failure_reason"),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (t) => ({
    from: index("tx_from").on(t.fromType, t.fromId, t.createdAt),
    to: index("tx_to").on(t.toType, t.toId, t.createdAt),
    idem: uniqueIndex("tx_idem").on(t.idempotencyKey),
    hash: index("tx_hash").on(t.txHash),
  })
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    balanceId: text("balance_id").notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(), // signed
    bucket: text("bucket").notNull(), // available | pending
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ tx: index("le_tx").on(t.transactionId), bal: index("le_bal").on(t.balanceId) })
);

export const depositAddresses = sqliteTable(
  "deposit_addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    derivationIndex: integer("derivation_index").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    user: uniqueIndex("dep_user_net").on(t.userId, t.network),
    addr: uniqueIndex("dep_addr").on(t.network, t.address),
  })
);

export const externalWallets = sqliteTable(
  "external_wallets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    label: text("label").notNull(),
    verifiedAt: integer("verified_at"), // set when ownership was proven by signature
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ user: index("ew_user").on(t.userId) })
);

export const merchants = sqliteTable(
  "merchants",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    websiteUrl: text("website_url"),
    country: text("country"),
    status: text("status").notNull().default("pending"), // pending | verified | suspended
    settlementAsset: text("settlement_asset").notNull().default("USDC"),
    acceptedAssets: text("accepted_assets").notNull().default('["USDC","USDT","EURC"]'),
    pricingCurrency: text("pricing_currency").notNull().default("EUR"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({ slug: uniqueIndex("merchants_slug").on(t.slug), owner: index("merchants_owner").on(t.ownerUserId) })
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(), // first 12 chars, shown in the dashboard
    hash: text("hash").notNull(),
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
  },
  (t) => ({ hash: uniqueIndex("api_keys_hash").on(t.hash), merchant: index("api_keys_merchant").on(t.merchantId) })
);

export const paymentRequests = sqliteTable(
  "payment_requests",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(), // short code for QR / link
    merchantId: text("merchant_id").notNull(),
    kind: text("kind").notNull(), // checkout | qr | link | pos
    status: text("status").notNull(), // open | processing | paid | expired | cancelled | refunded | partially_refunded
    priceCurrency: text("price_currency").notNull(), // EUR | USD | USDC | ...
    priceAmount: text("price_amount").notNull(), // cents for fiat, base units for assets
    description: text("description"),
    reference: text("reference"), // merchant's own order id
    successUrl: text("success_url"),
    cancelUrl: text("cancel_url"),
    reusable: integer("reusable", { mode: "boolean" }).notNull().default(false),
    expiresAt: integer("expires_at"),
    paidTransactionId: text("paid_transaction_id"),
    payerUserId: text("payer_user_id"),
    refundedAmount: text("refunded_amount").notNull().default("0"),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({ code: uniqueIndex("pr_code").on(t.code), merchant: index("pr_merchant").on(t.merchantId, t.createdAt) })
);

export const webhookEndpoints = sqliteTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ merchant: index("wh_merchant").on(t.merchantId) })
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id").notNull(),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull(), // pending | delivered | failed
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"),
    lastResponseCode: integer("last_response_code"),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ due: index("whd_due").on(t.status, t.nextAttemptAt) })
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(), // payment | security | account | merchant
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ user: index("notif_user").on(t.userId, t.createdAt) })
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type").notNull(), // user | merchant | system | api_key
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: text("ip"),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ actor: index("audit_actor").on(t.actorType, t.actorId, t.createdAt) })
);

export const complianceReviews = sqliteTable(
  "compliance_reviews",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").notNull(), // user | merchant | transaction
    subjectId: text("subject_id").notNull(),
    kind: text("kind").notNull(), // kyc | kyb | sanctions | monitoring
    status: text("status").notNull(), // open | cleared | escalated | rejected
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (t) => ({ subject: index("cr_subject").on(t.subjectType, t.subjectId) })
);

export const chainCursor = sqliteTable("chain_cursor", {
  network: text("network").primaryKey(),
  lastBlock: integer("last_block").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Balance = typeof balances.$inferSelect;
export type ExternalWallet = typeof externalWallets.$inferSelect;
export type DepositAddress = typeof depositAddresses.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
