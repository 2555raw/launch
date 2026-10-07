import { sendDueReminders } from "@/lib/services/reminders";

// The daily reminder clock: every 10 minutes, each device is reminded at most once a day, in its own evening.
const g = globalThis as { __stepitReminders?: boolean };
if (!g.__stepitReminders) {
  g.__stepitReminders = true;
  const tick = () => sendDueReminders().catch((e) => console.error("[reminders]", (e as Error).message));
  setTimeout(tick, 60_000);
  setInterval(tick, 10 * 60_000);
}
