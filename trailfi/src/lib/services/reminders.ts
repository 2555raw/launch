import "server-only";
import webpush from "web-push";
import { z } from "zod";
import { one, query } from "@/lib/db";

/** The VAPID key pair that signs push messages, created on first use and kept in the database. */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const row = await one<{ publicKey: string; privateKey: string }>(
    `select public_key as "publicKey", private_key as "privateKey" from app_keys where name = 'vapid'`,
  );
  if (row) return row;
  const keys = webpush.generateVAPIDKeys();
  await query("insert into app_keys (name, public_key, private_key) values ('vapid', $1, $2) on conflict (name) do nothing", [
    keys.publicKey,
    keys.privateKey,
  ]);
  return (await one<{ publicKey: string; privateKey: string }>(
    `select public_key as "publicKey", private_key as "privateKey" from app_keys where name = 'vapid'`,
  ))!;
}

export async function vapidPublicKey() {
  return (await vapidKeys()).publicKey;
}

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000).startsWith("https://"),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  timezone: z.string().max(64).refine(validZone, "Unknown timezone").default("UTC"),
  hour: z.number().int().min(0).max(23).default(19),
});

/** Saves (or moves to this walker) a device's push subscription. */
export async function saveSubscription(userId: string, input: unknown) {
  const { subscription, timezone, hour } = subscribeSchema.parse(input);
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth, timezone, remind_hour)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (endpoint) do update set user_id = $1, p256dh = $3, auth = $4, timezone = $5, remind_hour = $6`,
    [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, timezone, hour],
  );
}

export async function removeSubscription(userId: string, endpoint: string) {
  await query("delete from push_subscriptions where user_id = $1 and endpoint = $2", [userId, endpoint]);
}

export async function reminderStatus(userId: string, endpoint: string | null) {
  const row = endpoint
    ? await one<{ hour: number }>("select remind_hour as hour from push_subscriptions where user_id = $1 and endpoint = $2", [userId, endpoint])
    : null;
  return { enabled: Boolean(row), hour: row?.hour ?? 19 };
}

/** Local date (YYYY-MM-DD) and hour for a timezone. */
function localNow(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/**
 * Sends today's reminder to every device whose evening hour has come, unless the walker already
 * uploaded steps for that local day or was reminded today. Safe to run as often as you like.
 */
export async function sendDueReminders(now = new Date()) {
  const subs = await query<{ id: string; userId: string; endpoint: string; p256dh: string; auth: string; timezone: string; hour: number; lastSent: string | null }>(
    `select p.id, p.user_id as "userId", p.endpoint, p.p256dh, p.auth, p.timezone, p.remind_hour as hour, p.last_sent_day::text as "lastSent"
       from push_subscriptions p join users u on u.id = p.user_id where u.status = 'active'`,
  );
  if (!subs.length) return { sent: 0 };
  const { publicKey, privateKey } = await vapidKeys();
  webpush.setVapidDetails(process.env.NEXT_PUBLIC_APP_URL || "https://stepit.site", publicKey, privateKey);
  let sent = 0;
  for (const s of subs) {
    const local = localNow(s.timezone, now);
    if (local.hour < s.hour || s.lastSent === local.day) continue;
    const uploaded = await one<{ id: string }>("select id from step_entries where user_id = $1 and day = $2::date limit 1", [s.userId, local.day]);
    // Mark the day first so a slow or failed push is never retried into a second reminder.
    await query("update push_subscriptions set last_sent_day = $2::date where id = $1", [s.id, local.day]);
    if (uploaded) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "Did you upload today's steps? 👟",
          body: "Snap your health app and upload it before midnight to get paid for today.",
          url: "/steps",
          tag: `reminder-${local.day}`,
        }),
        { TTL: 60 * 60 * 4 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The device unsubscribed or the subscription expired: forget it.
      if (status === 404 || status === 410) await query("delete from push_subscriptions where id = $1", [s.id]);
    }
  }
  return { sent };
}
