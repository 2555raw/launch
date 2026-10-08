import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { handler, json, fail } from "@/server/http";

export const dynamic = "force-dynamic";

/** Off-chain token metadata referenced by the on-chain `uri` field. */
export const GET = handler(async (_req, { params }: { params: { slug: string } }) => {
  const p = await prisma.project.findUnique({ where: { slug: params.slug }, include: { launch: true, token: true } });
  if (!p) return fail(404, "Project not found");
  return json({
    name: p.name,
    symbol: p.symbol,
    description: `${p.name} ($${p.symbol}) is a ${p.commodity.toLowerCase()} commodity token whose supply was decided by the FOUNDRY community. ` +
      (p.launch ? `${p.launch.burnedSupply.toLocaleString("en-US")} of ${p.launch.initialSupply.toLocaleString("en-US")} tokens (${p.launch.burnPercent.toFixed(2)}%) were burned at launch.` : "The launch is still in progress."),
    image: `${env.appUrl}/coin/${p.commodity.toLowerCase()}.svg`,
    external_url: `${env.appUrl}/project/${p.slug}`,
    attributes: [
      { trait_type: "Commodity", value: p.commodity },
      { trait_type: "Initial Supply", value: p.launch?.initialSupply ?? p.initialSupply },
      { trait_type: "Burned Supply", value: p.launch?.burnedSupply ?? null },
      { trait_type: "Final Supply", value: p.launch?.finalSupply ?? null },
      { trait_type: "Mint", value: p.token?.mintAddress ?? null },
    ],
  });
});
