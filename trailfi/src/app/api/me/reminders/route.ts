import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { reminderStatus, removeSubscription, saveSubscription } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/** Whether this device gets daily reminders. */
export const GET = route(async (req) => {
  const me = await requireUser();
  return json(await reminderStatus(me.id, new URL(req.url).searchParams.get("endpoint")));
});

/** Turns daily reminders on for this device. */
export const POST = route(async (req) => {
  const me = await requireUser();
  await saveSubscription(me.id, await readJson(req));
  return json({ enabled: true });
});

/** Turns them off for this device. */
export const DELETE = route(async (req) => {
  const me = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await readJson(req));
  await removeSubscription(me.id, endpoint);
  return json({ enabled: false });
});
