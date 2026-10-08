import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { getCurrentProject, publicProject } from "@/server/project";
import { getGlobalSnapshot } from "@/server/global";
import { cluster, explorerUrl, getAuthority, getAuthorityBalance } from "@/server/solana";
import { clientCount } from "@/server/ws";
import { handler, json } from "@/server/http";
import { describeFormula } from "@/lib/economy";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireAdmin(req);
  const p = await getCurrentProject(true);
  const [global, launch, token, txs, users, sessions, suspicious, projects] = await Promise.all([
    getGlobalSnapshot(p),
    prisma.launch.findUnique({ where: { projectId: p.id } }),
    prisma.token.findUnique({ where: { projectId: p.id } }),
    prisma.blockchainTransaction.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.count(),
    prisma.gameSession.count({ where: { projectId: p.id } }),
    prisma.gameSession.findMany({ where: { projectId: p.id, suspicion: { gt: 0 } }, orderBy: { suspicion: "desc" }, take: 20, include: { user: { select: { username: true } } } }),
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, select: { slug: true, symbol: true, name: true, status: true, isCurrent: true, createdAt: true } }),
  ]);
  const authority = getAuthority().publicKey.toBase58();
  let authorityBalance: number | null = null;
  let rpcError: string | null = null;
  try {
    authorityBalance = await getAuthorityBalance();
  } catch (e) {
    rpcError = (e as Error).message;
  }
  return json({
    project: { ...publicProject(p), revokeMintAuthority: p.revokeMintAuthority },
    formula: describeFormula(p),
    global,
    launch,
    token,
    transactions: txs.map((t) => ({ ...t, url: t.signature ? explorerUrl("tx", t.signature) : null })),
    users,
    sessions,
    wsClients: clientCount(),
    suspicious: suspicious.map((s) => ({ username: s.user.username, suspicion: s.suspicion, rejectedClicks: s.rejectedClicks, totalClicks: s.totalClicks })),
    projects,
    solana: { cluster: cluster(), authority, authorityUrl: explorerUrl("address", authority), authorityBalance, rpcError },
  });
});
