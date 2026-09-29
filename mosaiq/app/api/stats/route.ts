import { NextResponse } from "next/server";
import { stats } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range");
  const days = range === "7d" ? 7 : range === "all" ? "all" : 30;
  return NextResponse.json(await stats(days));
}
