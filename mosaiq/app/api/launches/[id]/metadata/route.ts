import { NextResponse } from "next/server";
import { originOf, problem } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Token metadata JSON in the Metaplex shape Solana wallets and explorers read. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await store().getLaunch(id);
  if (!l) return problem(404, "Not found.");
  const image = `${originOf(req)}/api/launches/${id}/image`;
  return NextResponse.json(
    {
      name: l.name,
      symbol: l.ticker,
      description: l.description ?? "",
      image,
      external_url: l.website ?? "",
      extensions: { website: l.website ?? "", twitter: l.x ?? "" },
      properties: { category: "image", files: [{ uri: image, type: l.image?.slice(5, l.image.indexOf(";")) ?? "image/webp" }] },
    },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
