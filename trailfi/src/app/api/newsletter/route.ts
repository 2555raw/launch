import { z } from "zod";
import { clientIp, json, rateLimit, readJson, route } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address.") });

/** Footer newsletter signup. Subscribing twice is not an error. */
export const POST = route(async (req) => {
  rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000);
  const { email } = schema.parse(await readJson(req));
  await query("insert into newsletter_subscribers (email) values ($1) on conflict do nothing", [email]);
  return json({ ok: true }, 201);
});
