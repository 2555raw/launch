import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query } from "@/lib/db";
import { env } from "@/lib/env";
import { isAdminWallet } from "@/lib/auth/guard";
import { listPayouts } from "./payouts";
import { listRewards, rewardSummary } from "./rewards";
import { listUserSteps } from "./steps";

export interface UserRow {
  id: string;
  shortId: number;
  walletAddress: `0x${string}`;
  role: "user" | "admin";
  status: "active" | "suspended";
  payoutConsentAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const USER_COLUMNS = `id, short_id as "shortId", wallet_address as "walletAddress", role, status,
  payout_consent_at as "payoutConsentAt", created_at as "createdAt", last_login_at as "lastLoginAt"`;

/** Called after a verified sign-in. Registers the public address on first login. */
export async function upsertOnLogin(address: string): Promise<UserRow> {
  const wallet = address.toLowerCase();
  const role = isAdminWallet(wallet) ? "admin" : "user";
  const row = await one<UserRow>(
    `insert into users (wallet_address, role, payout_consent_at, last_login_at)
     values ($1, $2, now(), now())
     on conflict (wallet_address) do update
       set last_login_at = now(), role = excluded.role,
           payout_consent_at = coalesce(users.payout_consent_at, now())
     returning ${USER_COLUMNS}`,
    [wallet, role],
  );
  if (!row) throw new Error("user upsert failed");
  await audit(wallet, "auth.sign_in", "user", row.id, { role });
  return row;
}

export async function getUser(id: string): Promise<UserRow> {
  const row = await one<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [id]);
  if (!row) throw new HttpError(404, "User not found.", "not_found");
  return row;
}

export const listUsersSchema = z.object({
  search: z.string().trim().max(64).optional(),
  status: z.enum(["all", "pending", "approved", "processing", "paid", "none"]).default("all"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Admin table: one row per user with today's steps and reward totals. */
export async function listUsers(input: unknown) {
  const { search, status, limit } = listUsersSchema.parse(input);
  const params: unknown[] = [];
  const where: string[] = [];
  if (search) {
    const s = search.toLowerCase().replace(/^#/, "");
    params.push(`%${s}%`);
    where.push(`(u.wallet_address like $${params.length} or u.short_id::text = $${params.push(s)})`);
  }
  params.push(limit);
  const rows = await query<{
    id: string;
    shortId: number;
    walletAddress: string;
    role: string;
    status: string;
    createdAt: string;
    dailySteps: number;
    todayVerification: string | null;
    totalRewards: number;
    pendingRewards: number;
    approvedRewards: number;
    processingRewards: number;
    paidRewards: number;
    openPayout: string | null;
  }>(
    `select u.id, u.short_id as "shortId", u.wallet_address as "walletAddress", u.role, u.status, u.created_at as "createdAt",
       coalesce(t.steps, 0) as "dailySteps", t.verification as "todayVerification",
       coalesce(r.total, 0)::float8 as "totalRewards", coalesce(r.pending, 0)::float8 as "pendingRewards",
       coalesce(r.approved, 0)::float8 as "approvedRewards", coalesce(r.processing, 0)::float8 as "processingRewards",
       coalesce(r.paid, 0)::float8 as "paidRewards",
       (select p.status from payouts p where p.user_id = u.id and p.status in ('prepared', 'submitted') limit 1) as "openPayout"
     from users u
     left join lateral (
       select max(steps) as steps,
              (array_agg(verification order by steps desc))[1] as verification
         from step_entries where user_id = u.id and day = current_date and verification <> 'rejected'
     ) t on true
     left join lateral (
       select sum(amount) filter (where status <> 'rejected') as total,
              sum(amount) filter (where status = 'pending') as pending,
              sum(amount) filter (where status = 'approved') as approved,
              sum(amount) filter (where status = 'processing') as processing,
              sum(amount) filter (where status = 'paid') as paid
         from rewards where user_id = u.id
     ) r on true
     ${where.length ? "where " + where.join(" and ") : ""}
     order by u.short_id asc limit $${params.length}`,
    params,
  );

  const withStatus = rows.map((r) => ({
    ...r,
    dailySteps: Number(r.dailySteps),
    paymentStatus: r.openPayout
      ? ("processing" as const)
      : r.approvedRewards > 0
        ? ("approved" as const)
        : r.pendingRewards > 0
          ? ("pending" as const)
          : r.paidRewards > 0
            ? ("paid" as const)
            : ("none" as const),
  }));
  return status === "all" ? withStatus : withStatus.filter((r) => r.paymentStatus === status);
}

export async function getUserProfile(id: string) {
  const [user, steps, rewards, summary, payouts] = await Promise.all([
    getUser(id),
    listUserSteps(id, 90),
    listRewards({ userId: id, status: "all", limit: 100 }),
    rewardSummary(id),
    listPayouts({ userId: id, limit: 50 }),
  ]);
  return { user, steps, rewards, summary, payouts };
}

export const userUpdateSchema = z.object({ status: z.enum(["active", "suspended"]) });

export async function updateUser(id: string, input: unknown, actor: string) {
  const { status } = userUpdateSchema.parse(input);
  const user = await getUser(id);
  if (env.adminWallets.includes(user.walletAddress) && status === "suspended") {
    throw new HttpError(409, "Admin wallets cannot be suspended from the panel.", "protected");
  }
  await query("update users set status = $2 where id = $1", [id, status]);
  await audit(actor, `user.${status}`, "user", id, {});
  return getUser(id);
}
