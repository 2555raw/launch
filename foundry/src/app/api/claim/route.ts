import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getCurrentProject } from "@/server/project";
import { cluster, explorerUrl, transferFromTreasury } from "@/server/solana";
import { withLock, rateLimit } from "@/server/redis";
import { handler, json, parseBody, fail } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Community allocation: a configurable share of the final supply is claimable
 * by players, pro rata to the burn power they contributed. Paid on-chain from
 * the treasury to the player's linked wallet. One claim per player per launch.
 */
async function claimInfo(userId: string, projectId: string) {
  const [project, launch, token, session, stats, existing] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.launch.findUnique({ where: { projectId } }),
    prisma.token.findUnique({ where: { projectId } }),
    prisma.gameSession.findUnique({ where: { userId_projectId: { userId, projectId } } }),
    prisma.globalStats.findUnique({ where: { projectId } }),
    prisma.blockchainTransaction.findFirst({ where: { projectId, userId, kind: "CLAIM_TRANSFER", status: { in: ["CONFIRMED", "PENDING"] } } }),
  ]);
  const totalBurn = launch?.finalBurnPower ?? stats?.totalBurnPower ?? 0;
  const share = session && totalBurn > 0 ? session.burnPower / totalBurn : 0;
  const pool = launch?.communityAllocation ?? 0;
  const amount = Math.floor(share * pool * 10 ** project.decimals) / 10 ** project.decimals;
  return {
    launched: project.status === "LAUNCHED" && !!token,
    pool,
    share,
    amount,
    burnPower: session?.burnPower ?? 0,
    claimed: existing ? { signature: existing.signature, status: existing.status, url: existing.signature ? explorerUrl("tx", existing.signature) : null } : null,
    token: token ? { mint: token.mintAddress, symbol: token.symbol, decimals: token.decimals } : null,
  };
}

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const p = await getCurrentProject();
  return json(await claimInfo(user.id, p.id));
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  if (!(await rateLimit(`claim:${user.id}`, 3, 60))) return fail(429, "Slow down");
  const { address } = await parseBody(req, z.object({ address: z.string().min(32).max(44) }));
  if (!user.wallets.some((w) => w.address === address)) return fail(403, "Claim to a wallet linked to your account");
  const p = await getCurrentProject();
  return withLock(`claim:${user.id}:${p.id}`, async () => {
    const info = await claimInfo(user.id, p.id);
    if (!info.launched || !info.token) return fail(400, "The token has not launched yet");
    if (info.claimed) return fail(409, "Already claimed");
    if (info.amount <= 0) return fail(400, "No allocation: contribute burn power during the launch to earn a share");
    const tx = await prisma.blockchainTransaction.create({ data: { projectId: p.id, userId: user.id, kind: "CLAIM_TRANSFER", cluster: cluster(), amount: info.amount, detail: `Claim to ${address}` } });
    try {
      const sig = await transferFromTreasury(info.token.mint, address, info.amount, info.token.decimals);
      await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "CONFIRMED", signature: sig, confirmedAt: new Date() } });
      return json({ ok: true, signature: sig, url: explorerUrl("tx", sig), amount: info.amount });
    } catch (e) {
      await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "FAILED", error: (e as Error).message } });
      return fail(500, `Transfer failed: ${(e as Error).message}`);
    }
  }, 60_000, 1);
});
