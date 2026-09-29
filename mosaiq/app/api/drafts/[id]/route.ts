import { NextResponse } from "next/server";
import { problem } from "@/lib/server/http";
import { toPublic } from "@/lib/server/launches";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const launch = await store().getLaunch(id);
  if (!launch) return problem(404, "Draft not found.");
  return NextResponse.json(toPublic(launch));
}
