import { json, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { listUserSteps, submitManualSteps } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const me = await requireUser();
  return json({ steps: await listUserSteps(me.id, 60) });
});

/** Demo/manual entry from the browser. Stored unverified — never payable without admin review. */
export const POST = route(async (req) => {
  const me = await requireUser();
  rateLimit(`steps:${me.id}`, 10, 60_000);
  const entry = await submitManualSteps(me.id, await readJson(req));
  return json({ entry }, 201);
});
