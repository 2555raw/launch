CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE INDEX `api_keys_merchant` ON `api_keys` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`ip` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor` ON `audit_logs` (`actor_type`,`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `balances` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`asset` text NOT NULL,
	`available` text DEFAULT '0' NOT NULL,
	`pending` text DEFAULT '0' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `balances_owner` ON `balances` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `chain_cursor` (
	`network` text PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compliance_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `cr_subject` ON `compliance_reviews` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `deposit_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`network` text NOT NULL,
	`address` text NOT NULL,
	`derivation_index` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dep_user_net` ON `deposit_addresses` (`user_id`,`network`);--> statement-breakpoint
CREATE UNIQUE INDEX `dep_addr` ON `deposit_addresses` (`network`,`address`);--> statement-breakpoint
CREATE TABLE `external_wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`network` text NOT NULL,
	`address` text NOT NULL,
	`label` text NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ew_user` ON `external_wallets` (`user_id`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`balance_id` text NOT NULL,
	`asset` text NOT NULL,
	`amount` text NOT NULL,
	`bucket` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `le_tx` ON `ledger_entries` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `le_bal` ON `ledger_entries` (`balance_id`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`website_url` text,
	`country` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`settlement_asset` text DEFAULT 'USDC' NOT NULL,
	`accepted_assets` text DEFAULT '["USDC","USDT","EURC"]' NOT NULL,
	`pricing_currency` text DEFAULT 'EUR' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_slug` ON `merchants` (`slug`);--> statement-breakpoint
CREATE INDEX `merchants_owner` ON `merchants` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`href` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notif_user` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`merchant_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`price_currency` text NOT NULL,
	`price_amount` text NOT NULL,
	`description` text,
	`reference` text,
	`success_url` text,
	`cancel_url` text,
	`reusable` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`paid_transaction_id` text,
	`payer_user_id` text,
	`refunded_amount` text DEFAULT '0' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_code` ON `payment_requests` (`code`);--> statement-breakpoint
CREATE INDEX `pr_merchant` ON `payment_requests` (`merchant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`mfa_passed` integer DEFAULT false NOT NULL,
	`user_agent` text,
	`ip` text,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE INDEX `tokens_hash` ON `tokens` (`hash`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`asset` text NOT NULL,
	`amount` text NOT NULL,
	`fee` text DEFAULT '0' NOT NULL,
	`from_type` text,
	`from_id` text,
	`to_type` text,
	`to_id` text,
	`counterparty` text,
	`network` text,
	`tx_hash` text,
	`address` text,
	`reference` text,
	`fiat_currency` text,
	`fiat_amount` text,
	`rate` text,
	`idempotency_key` text,
	`payment_request_id` text,
	`failure_reason` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `tx_from` ON `transactions` (`from_type`,`from_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tx_to` ON `transactions` (`to_type`,`to_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_idem` ON `transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `tx_hash` ON `transactions` (`tx_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`country` text,
	`display_currency` text DEFAULT 'EUR' NOT NULL,
	`kyc_status` text DEFAULT 'not_started' NOT NULL,
	`kyc_tier` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`totp_secret` text,
	`totp_enabled_at` integer,
	`daily_limit_cents` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle` ON `users` (`handle`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`last_response_code` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `whd_due` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wh_merchant` ON `webhook_endpoints` (`merchant_id`);