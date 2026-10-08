/**
 * Launch lifecycle:
 *   DRAFT -> ACTIVE (countdown) -> FROZEN -> FINALIZED -> MINTING -> LAUNCHED
 * Each on-chain step is recorded before and after it runs so a crash or a
 * failed RPC call can be retried without repeating a step that succeeded.
 */
import type { Project } from "@prisma/client";
import { prisma } from "./db";
import { flushAll, settleAllSessions } from "./engine";
import { flushGlobal, getGlobalTotals } from "./global";
import { getCurrentProject, invalidateProjectCache } from "./project";
import { burnSummary } from "@/lib/economy";
import { env } from "./env";
import { burnFromTreasury, createTokenWithSupply, ensureFunded, getAuthority, revokeMintAuthority, cluster as solCluster } from "./solana";
import { HttpError } from "./auth";

export async function startLaunch(projectId: string, durationHours?: number): Promise<Project> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.status !== "DRAFT") throw new HttpError(400, `Cannot start a launch from status ${p.status}`);
  const hours = durationHours && durationHours > 0 ? durationHours : p.launchDurationHours;
  const now = new Date();
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { status: "ACTIVE", startedAt: now, endsAt: new Date(now.getTime() + hours * 3600_000), launchDurationHours: hours },
  });
  invalidateProjectCache();
  return updated;
}

export async function extendLaunch(projectId: string, hours: number): Promise<Project> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.status !== "ACTIVE" || !p.endsAt) throw new HttpError(400, "Launch is not active");
  const updated = await prisma.project.update({ where: { id: projectId }, data: { endsAt: new Date(p.endsAt.getTime() + hours * 3600_000) } });
  invalidateProjectCache();
  return updated;
}

/** Stop the game. Flushes every session and the global counters first so the DB holds the final numbers. */
export async function freezeProject(projectId: string, reason: string): Promise<Project> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.status !== "ACTIVE" && p.status !== "DRAFT") throw new HttpError(400, `Cannot freeze from status ${p.status}`);
  const frozenAt = p.endsAt && p.endsAt.getTime() < Date.now() ? p.endsAt : new Date();
  // Mark frozen first so no sync can credit time past frozenAt, then flush.
  const frozen = await prisma.project.update({ where: { id: projectId }, data: { status: "FROZEN", frozenAt } });
  invalidateProjectCache();
  await settleAllSessions(frozen);
  await flushAll();
  const { totals, summary } = await flushGlobal(frozen);
  await prisma.burnEvent.create({ data: { projectId, totalBurnPower: totals.totalBurnPower, burnedSupply: summary.burnedSupply, burnPercent: summary.burnPercent, reason: `freeze:${reason}` } });
  return frozen;
}

/** Lock the final tokenomics from the value-of-record totals. Idempotent. */
export async function finalizeProject(projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { launch: true } });
  if (p.launch) return p.launch;
  if (p.status !== "FROZEN") throw new HttpError(400, `Cannot finalize from status ${p.status}`);
  await flushAll();
  const { totals } = await flushGlobal(p);
  const s = burnSummary(p, totals.totalBurnPower);
  // Invariants the chain will rely on.
  if (s.burnedSupply < 0 || s.burnedSupply > s.initialSupply || s.finalSupply < 0) throw new Error("Burn invariant violated");
  const communityAllocation = Math.floor(s.finalSupply * Math.min(100, Math.max(0, p.communityAllocationPercent)) / 100);
  const launch = await prisma.launch.create({
    data: { projectId, finalBurnPower: totals.totalBurnPower, initialSupply: s.initialSupply, burnedSupply: s.burnedSupply, finalSupply: s.finalSupply, burnPercent: s.burnPercent, communityAllocation, step: "FINALIZED" },
  });
  await prisma.project.update({ where: { id: projectId }, data: { status: "FINALIZED" } });
  await prisma.burnEvent.create({ data: { projectId, totalBurnPower: totals.totalBurnPower, burnedSupply: s.burnedSupply, burnPercent: s.burnPercent, reason: "finalize" } });
  invalidateProjectCache();
  return launch;
}

let executing = false;

/** Run the on-chain steps. Safe to call again after a failure; completed steps are skipped. */
export async function executeLaunch(projectId: string) {
  if (executing) throw new HttpError(409, "A launch is already executing");
  executing = true;
  try {
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { launch: true, token: true } });
    if (!p.launch) throw new HttpError(400, "Finalize the project first");
    if (!["FINALIZED", "FAILED", "MINTING"].includes(p.status)) throw new HttpError(400, `Cannot execute from status ${p.status}`);
    await prisma.project.update({ where: { id: projectId }, data: { status: "MINTING" } });
    await prisma.launch.update({ where: { projectId }, data: { error: null } });
    invalidateProjectCache();
    const clusterName = solCluster();
    const authority = getAuthority().publicKey.toBase58();
    const launch = p.launch;

    try {
      await ensureFunded(0.05);

      let token = p.token;
      if (!token) {
        const tx = await prisma.blockchainTransaction.create({ data: { projectId, kind: "CREATE_MINT", cluster: clusterName, amount: launch.initialSupply, detail: `Create ${p.symbol} mint and mint initial supply` } });
        try {
          const uri = `${env.appUrl}/api/project/${p.slug}/metadata.json`;
          const res = await createTokenWithSupply({
            name: p.name, symbol: p.symbol, uri, decimals: p.decimals, initialSupply: launch.initialSupply,
            additional: [
              ["commodity", p.commodity],
              ["initial_supply", String(launch.initialSupply)],
              ["burned_supply", String(launch.burnedSupply)],
              ["final_supply", String(launch.finalSupply)],
              ["burn_percent", launch.burnPercent.toFixed(4)],
              ["decided_by", "FOUNDRY community gameplay"],
            ],
          });
          token = await prisma.token.create({
            data: {
              projectId, mintAddress: res.mint, name: p.name, symbol: p.symbol, decimals: p.decimals, cluster: clusterName, creator: authority,
              treasuryAta: res.treasuryAta, initialSupply: launch.initialSupply, burnedSupply: launch.burnedSupply, finalSupply: launch.finalSupply, mintTx: res.signature,
            },
          });
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "CONFIRMED", signature: res.signature, confirmedAt: new Date() } });
          await prisma.blockchainTransaction.create({ data: { projectId, kind: "MINT_SUPPLY", cluster: clusterName, amount: launch.initialSupply, status: "CONFIRMED", signature: null, detail: `Minted in ${res.signature}`, confirmedAt: new Date() } });
          await prisma.launch.update({ where: { projectId }, data: { step: "SUPPLY_MINTED" } });
        } catch (e) {
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "FAILED", error: (e as Error).message } });
          throw e;
        }
      }

      if (!token.burnTx && launch.burnedSupply > 0) {
        const tx = await prisma.blockchainTransaction.create({ data: { projectId, kind: "BURN", cluster: clusterName, amount: launch.burnedSupply, detail: `Burn ${launch.burnedSupply} ${p.symbol} decided by the community` } });
        try {
          const sig = await burnFromTreasury(token.mintAddress, launch.burnedSupply, p.decimals);
          token = await prisma.token.update({ where: { projectId }, data: { burnTx: sig } });
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "CONFIRMED", signature: sig, confirmedAt: new Date() } });
          await prisma.launch.update({ where: { projectId }, data: { step: "BURNED" } });
          await prisma.burnEvent.create({ data: { projectId, totalBurnPower: launch.finalBurnPower, burnedSupply: launch.burnedSupply, burnPercent: launch.burnPercent, reason: `onchain:${sig}` } });
        } catch (e) {
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "FAILED", error: (e as Error).message } });
          throw e;
        }
      }

      if (p.revokeMintAuthority && !token.revokeTx) {
        const tx = await prisma.blockchainTransaction.create({ data: { projectId, kind: "REVOKE_MINT_AUTHORITY", cluster: clusterName, detail: "Set mint authority to none so the supply is fixed" } });
        try {
          const sig = await revokeMintAuthority(token.mintAddress);
          token = await prisma.token.update({ where: { projectId }, data: { revokeTx: sig } });
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "CONFIRMED", signature: sig, confirmedAt: new Date() } });
          await prisma.launch.update({ where: { projectId }, data: { step: "AUTHORITY_REVOKED" } });
        } catch (e) {
          await prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { status: "FAILED", error: (e as Error).message } });
          throw e;
        }
      }

      await prisma.launch.update({ where: { projectId }, data: { step: "DONE", launchedAt: new Date(), error: null } });
      await prisma.project.update({ where: { id: projectId }, data: { status: "LAUNCHED" } });
      invalidateProjectCache();
      return token;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      await prisma.launch.update({ where: { projectId }, data: { error: msg } });
      await prisma.project.update({ where: { id: projectId }, data: { status: "FAILED" } });
      invalidateProjectCache();
      throw new HttpError(500, msg);
    }
  } finally {
    executing = false;
  }
}

/** Called every second by the scheduler. Freezes and finalizes when the countdown ends. */
export async function launchTick() {
  const p = await getCurrentProject(true);
  if (p.status === "ACTIVE" && p.endsAt && p.endsAt.getTime() <= Date.now()) {
    console.log(`[launch] countdown for ${p.symbol} ended, freezing`);
    await freezeProject(p.id, "countdown");
    await finalizeProject(p.id);
    if (env.autoExecuteLaunch) {
      executeLaunch(p.id).catch((e) => console.error("[launch] auto execute failed:", e.message));
    }
  }
}

export async function createNewProject(data: { slug: string; name: string; symbol: string; commodity: string }) {
  const p = await prisma.$transaction(async (tx) => {
    await tx.project.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    return tx.project.create({ data: { ...data, isCurrent: true, globalStats: { create: {} } } });
  });
  invalidateProjectCache();
  return p;
}

export async function projectTotals(projectId: string) {
  return getGlobalTotals(projectId);
}
