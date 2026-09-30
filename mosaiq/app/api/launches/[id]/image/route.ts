import { problem } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** The token image, served as a file so launchpads and wallets can link to it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const launch = await store().getLaunch(id);
  const m = launch?.image && /^data:(image\/[a-z]+);base64,(.+)$/.exec(launch.image);
  if (!m) return problem(404, "No image.");
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" },
  });
}
