import { json, route } from "@/lib/api";
import { vapidPublicKey } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/** Public key browsers need to subscribe to Strydo's reminders. */
export const GET = route(async () => json({ key: await vapidPublicKey() }));
