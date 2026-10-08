/**
 * Background jobs run inside the custom server process:
 *   - every 1s  : broadcast the global snapshot over WebSocket, check the countdown
 *   - every 5s  : flush dirty sessions and the global counters to Postgres
 *   - every 60s : record a BurnEvent snapshot for the chart / audit trail
 */
import { prisma } from "./db";
import { flushDirtySessions } from "./engine";
import { ensureGlobalLoaded, flushGlobal, getGlobalSnapshot } from "./global";
import { launchTick } from "./launch";
import { getCurrentProject, syncCatalog } from "./project";
import { broadcast } from "./ws";

let started = false;
let lastBurnSnapshot = -1;

export async function startScheduler() {
  if (started) return;
  started = true;
  await syncCatalog();
  const p = await getCurrentProject(true);
  await ensureGlobalLoaded(p.id);
  console.log(`[scheduler] current project ${p.symbol} (${p.status})`);

  const safe = (name: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[scheduler:${name}]`, (e as Error).message);
    }
  };

  setInterval(
    safe("tick", async () => {
      await launchTick();
      const project = await getCurrentProject();
      const snap = await getGlobalSnapshot(project);
      broadcast("global", snap);
    }),
    1000,
  );

  setInterval(
    safe("flush", async () => {
      await flushDirtySessions();
      const project = await getCurrentProject();
      await flushGlobal(project);
    }),
    5000,
  );

  setInterval(
    safe("burn-snapshot", async () => {
      const project = await getCurrentProject();
      if (project.status !== "DRAFT" && project.status !== "ACTIVE") return;
      const snap = await getGlobalSnapshot(project);
      if (snap.burnedSupply === lastBurnSnapshot) return;
      lastBurnSnapshot = snap.burnedSupply;
      await prisma.burnEvent.create({ data: { projectId: project.id, totalBurnPower: snap.totalBurnPower, burnedSupply: snap.burnedSupply, burnPercent: snap.burnPercent, reason: "tick" } });
    }),
    60_000,
  );
}
