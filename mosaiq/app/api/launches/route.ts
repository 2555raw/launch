import { NextResponse } from "next/server";
import { queryLaunches, type Sort } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const sort = (["newest", "oldest", "marketcap"].includes(p.get("sort") ?? "") ? p.get("sort") : "newest") as Sort;
  const launches = await queryLaunches({
    q: p.get("q") ?? undefined,
    chain: p.get("chain") ?? undefined,
    pad: p.get("pad") ?? undefined,
    sort,
    limit: Math.min(Number(p.get("limit")) || 60, 200),
  });
  return NextResponse.json({ launches });
}
