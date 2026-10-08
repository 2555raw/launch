import { BATTLE_PREP_MS, BATTLE_TICK_MS, BattleSimulation, trophyDeltas } from '@launch/game-engine';
import { finalizeBattle, startBattle } from '@launch/game-core';
import type { BattleSnapshot } from '@launch/types';
import type { Logger } from 'pino';
import type { ClientSession, GameServer } from './game-server.js';

const SNAPSHOT_EVERY_MS = 250;

/** One live battle: owns the simulation loop and reports the result to game-core when it ends. */
export class BattleRoom {
  private sim: BattleSimulation | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastSnapshotAt = 0;
  private eventCursor = 0;
  private finished = false;
  private prepDeadline = 0;
  private defenderTh = 1;
  private attackerTrophies = 0;
  private defenderTrophies = 0;
  private session: ClientSession | null;

  constructor(
    private readonly server: GameServer,
    session: ClientSession,
    readonly battleId: string,
    private readonly logger: Logger,
  ) {
    this.session = session;
  }

  async start(): Promise<void> {
    const session = this.session!;
    const { db } = this.server.ctx;
    const { battle, troopLevels, attackerTownHall } = await startBattle(this.server.ctx, session.playerId!, this.battleId);
    const snapshot = battle.defenderSnapshot as unknown as BattleSnapshot;
    const army = battle.attackerArmy as Record<string, number>;
    const [attacker, defender] = await Promise.all([db.player.findUniqueOrThrow({ where: { id: battle.attackerId } }), db.player.findUniqueOrThrow({ where: { id: battle.defenderId } })]);
    this.attackerTrophies = attacker.trophies;
    this.defenderTrophies = defender.trophies;
    this.defenderTh = snapshot.townHallLevel;
    this.sim = new BattleSimulation({ seed: battle.seed, snapshot, army, troopLevels, attackerTownHall });
    // if the socket reconnects to an already running battle, elapsed time must account for it
    const alreadyElapsed = battle.startedAt ? Date.now() - battle.startedAt.getTime() : 0;
    this.prepDeadline = Date.now() + Math.max(0, BATTLE_PREP_MS - alreadyElapsed);
    this.server.send(session, { type: 'battle:ready', battleId: this.battleId, snapshot, army, durationMs: this.sim.durationMs, prepMs: Math.max(0, this.prepDeadline - Date.now()) });
    this.timer = setInterval(() => void this.tick(), BATTLE_TICK_MS);
  }

  resend(session: ClientSession) {
    if (!this.sim) return;
    this.session = session;
    this.server.send(session, { type: 'battle:ready', battleId: this.battleId, snapshot: { gridSize: this.sim.gridSize, townHallLevel: this.defenderTh, buildings: [] }, army: this.sim.remainingArmy, durationMs: this.sim.durationMs, prepMs: Math.max(0, this.prepDeadline - Date.now()) });
    this.server.send(session, { type: 'battle:state', state: this.sim.state(this.battleId) });
  }

  detach() {
    this.session = null;
  }

  deploy(troopType: string, x: number, y: number) {
    if (!this.sim || this.finished) return;
    const outcome = this.sim.deploy(troopType, x, y);
    if (!outcome.ok && this.session) this.server.send(this.session, { type: 'battle:event', battleId: this.battleId, event: { kind: 'rejected', reason: outcome.reason } });
    this.lastSnapshotAt = 0; // push a snapshot right away
  }

  async endEarly() {
    if (!this.sim || this.finished) return;
    this.sim.end();
    await this.finish();
  }

  private async tick() {
    if (!this.sim || this.finished) return;
    const started = this.sim.troops.length > 0 || Date.now() >= this.prepDeadline;
    if (!started) return; // preparation phase: clock does not run until the first troop lands
    const ended = this.sim.tick(BATTLE_TICK_MS);
    const now = Date.now();
    if (this.session && this.sim.events.length > this.eventCursor) {
      for (const event of this.sim.events.slice(this.eventCursor)) this.server.send(this.session, { type: 'battle:event', battleId: this.battleId, event });
      this.eventCursor = this.sim.events.length;
    }
    if (this.session && now - this.lastSnapshotAt >= SNAPSHOT_EVERY_MS) {
      this.lastSnapshotAt = now;
      this.server.send(this.session, { type: 'battle:state', state: this.sim.state(this.battleId) });
    }
    if (ended) await this.finish();
  }

  private async finish() {
    if (this.finished || !this.sim) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    const result = this.sim.result(this.attackerTrophies, this.defenderTrophies, trophyDeltas, this.defenderTh);
    try {
      const battle = await finalizeBattle(this.server.ctx, this.battleId, result, this.sim.deployments);
      const final = { ...result, attackerTrophyDelta: battle.attackerTrophyDelta, defenderTrophyDelta: battle.defenderTrophyDelta };
      if (this.session) {
        this.server.send(this.session, { type: 'battle:state', state: this.sim.state(this.battleId) });
        this.server.send(this.session, { type: 'battle:result', battleId: this.battleId, result: final });
        this.session.battle = null;
      }
    } catch (e) {
      this.logger.error({ err: e, battleId: this.battleId }, 'failed to finalize battle');
      if (this.session) this.server.send(this.session, { type: 'error', code: 'FINALIZE_FAILED', message: 'The battle could not be saved' });
    }
  }

  async dispose(reason: string) {
    if (this.finished) return;
    if (this.sim && this.sim.troops.length > 0) {
      // troops were committed: settle the battle with what happened so far
      this.sim.end();
      await this.finish();
    } else {
      this.finished = true;
      if (this.timer) clearInterval(this.timer);
      this.logger.info({ battleId: this.battleId, reason }, 'battle room disposed before deployment');
    }
  }
}
