import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { SIMULATED_CHAIN, config } from "@/lib/config";
import { chain } from "@/lib/providers/chain";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness in one. It touches the database, because a process
 * that cannot read its ledger is not healthy no matter what it answers.
 */
export function GET() {
  try {
    getDb().select().from(schema.chainCursor).limit(1).all();
    return NextResponse.json({
      status: "ok",
      chain: { provider: chain().name, simulated: SIMULATED_CHAIN },
      rates: config.rates.provider,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", reason: err instanceof Error ? err.message.slice(0, 120) : "unknown" },
      { status: 503 }
    );
  }
}
