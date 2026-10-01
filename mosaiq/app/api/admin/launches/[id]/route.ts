import { NextResponse } from "next/server";
import { authorized } from "@/lib/server/admin";
import { problem } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Remove a launch from the ledger so it no longer shows on the site. Admin only. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return problem(401, "Unauthorized.");
  const { id } = await params;
  return (await store().deleteLaunch(id)) ? NextResponse.json({ deleted: id }) : problem(404, "Not found.");
}
