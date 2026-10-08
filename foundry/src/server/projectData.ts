/**
 * Everything the public project page needs, with the on-chain reads cached in
 * Redis for 30 seconds so a popular page does not hammer the RPC.
 */
import { prisma } from "./db";
import { redis } from "./redis";
import { getGlobalSnapshot } from "./global";
import { publicProject } from "./project";
import { explorerUrl, readMarket, readToken, type MarketData, type OnChainToken } from "./solana";
import { describeFormula } from "@/lib/economy";

export async function getProjectData(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      launch: true,
      token: true,
      transactions: { orderBy: { createdAt: "asc" }, where: { kind: { not: "CLAIM_TRANSFER" } } },
      burnEvents: { orderBy: { createdAt: "asc" }, take: 500 },
    },
  });
  if (!project) return null;
  const global = await getGlobalSnapshot(project);
  const claims = await prisma.blockchainTransaction.count({ where: { projectId: project.id, kind: "CLAIM_TRANSFER", status: "CONFIRMED" } });

  let onchain: OnChainToken | null = null;
  let onchainError: string | null = null;
  let market: MarketData | null = null;
  if (project.token) {
    const key = `onchain:${project.token.mintAddress}`;
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as { onchain: OnChainToken | null; market: MarketData | null; error: string | null };
      onchain = parsed.onchain;
      market = parsed.market;
      onchainError = parsed.error;
    } else {
      try {
        onchain = await readToken(project.token.mintAddress);
        market = await readMarket(project.token.mintAddress);
      } catch (e) {
        onchainError = (e as Error).message;
      }
      await redis.set(key, JSON.stringify({ onchain, market, error: onchainError }), "EX", 30);
    }
  }

  return {
    project: publicProject(project),
    formula: describeFormula(project),
    global,
    launch: project.launch
      ? { ...project.launch, finalizedAt: project.launch.finalizedAt.toISOString(), launchedAt: project.launch.launchedAt?.toISOString() ?? null }
      : null,
    token: project.token
      ? {
          ...project.token,
          createdAt: project.token.createdAt.toISOString(),
          explorer: explorerUrl("address", project.token.mintAddress),
          mintTxUrl: project.token.mintTx ? explorerUrl("tx", project.token.mintTx) : null,
          burnTxUrl: project.token.burnTx ? explorerUrl("tx", project.token.burnTx) : null,
          revokeTxUrl: project.token.revokeTx ? explorerUrl("tx", project.token.revokeTx) : null,
          creatorUrl: explorerUrl("address", project.token.creator),
        }
      : null,
    transactions: project.transactions.map((t) => ({
      id: t.id, kind: t.kind, status: t.status, signature: t.signature, amount: t.amount, detail: t.detail, error: t.error,
      createdAt: t.createdAt.toISOString(), url: t.signature ? explorerUrl("tx", t.signature) : null,
    })),
    burnHistory: project.burnEvents.map((b) => ({ t: b.createdAt.getTime(), burned: b.burnedSupply, pct: b.burnPercent, reason: b.reason })),
    onchain,
    onchainError,
    market,
    claims,
  };
}
export type ProjectData = NonNullable<Awaited<ReturnType<typeof getProjectData>>>;
