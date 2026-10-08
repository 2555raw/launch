import type { IncomingMessage } from 'node:http';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import type { Env } from '@launch/config';
import type { Db } from '@launch/database';
import { CLAN_CHAT_CHANNEL, NOTIFY_CHANNEL, postClanMessage, type GameContext } from '@launch/game-core';
import type { ClanMessageDTO, ClientMessage, NotificationDTO, ServerMessage } from '@launch/types';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { WebSocket, WebSocketServer } from 'ws';
import { BattleRoom } from './battle-room.js';

interface Claims {
  sub: string;
  pid: string | null;
  role: string;
  username: string;
}

export interface ClientSession {
  socket: WebSocket;
  userId: string | null;
  playerId: string | null;
  clanId: string | null;
  battle: BattleRoom | null;
  alive: boolean;
  messageTimestamps: number[];
}

export interface GameServerOptions {
  env: Env;
  db: Db;
  redis: Redis;
  subscriber: Redis;
  logger: Logger;
  port: number;
  now?: () => Date;
}

const MAX_MESSAGES_PER_10S = 60;

/**
 * Authoritative realtime server: battles are simulated here and only the result is persisted.
 * Clients send intents (deploy at x,y); the server validates every one of them.
 */
export class GameServer {
  private http: Server;
  private wss: WebSocketServer;
  private readonly sessions = new Set<ClientSession>();
  private readonly byUser = new Map<string, Set<ClientSession>>();
  private heartbeat: NodeJS.Timeout | null = null;
  readonly ctx: GameContext;

  constructor(private readonly opts: GameServerOptions) {
    this.ctx = { db: opts.db, redis: opts.redis, now: opts.now ?? (() => new Date()) };
    this.http = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, connections: this.sessions.size, battles: [...this.sessions].filter((s) => s.battle).length }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    this.wss = new WebSocketServer({ server: this.http, maxPayload: 16 * 1024 });
  }

  get address(): number {
    const a = this.http.address();
    return typeof a === 'object' && a ? a.port : this.opts.port;
  }

  async start(): Promise<void> {
    this.wss.on('connection', (socket, req) => this.onConnection(socket, req));
    await this.opts.subscriber.subscribe(NOTIFY_CHANNEL, CLAN_CHAT_CHANNEL);
    this.opts.subscriber.on('message', (channel, raw) => this.onRedisMessage(channel, raw));
    this.heartbeat = setInterval(() => {
      for (const s of this.sessions) {
        if (!s.alive) {
          s.socket.terminate();
          continue;
        }
        s.alive = false;
        s.socket.ping();
      }
    }, 30_000);
    await new Promise<void>((resolve) => this.http.listen(this.opts.port, '0.0.0.0', resolve));
  }

  async stop(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const s of this.sessions) {
      await s.battle?.dispose('server_shutdown');
      s.socket.close(1001, 'server shutting down');
    }
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  private onConnection(socket: WebSocket, req: IncomingMessage) {
    const session: ClientSession = { socket, userId: null, playerId: null, clanId: null, battle: null, alive: true, messageTimestamps: [] };
    this.sessions.add(session);
    this.opts.logger.debug({ ip: req.socket.remoteAddress }, 'ws connection');
    socket.on('pong', () => (session.alive = true));
    socket.on('message', (data) => void this.onMessage(session, data.toString()));
    socket.on('close', () => void this.onClose(session));
    socket.on('error', (err) => this.opts.logger.warn({ err }, 'ws error'));
    // must authenticate within 10 seconds
    setTimeout(() => {
      if (!session.userId && socket.readyState === WebSocket.OPEN) socket.close(4001, 'authentication timeout');
    }, 10_000);
  }

  send(session: ClientSession, msg: ServerMessage) {
    if (session.socket.readyState === WebSocket.OPEN) session.socket.send(JSON.stringify(msg));
  }

  private async onMessage(session: ClientSession, raw: string) {
    const now = Date.now();
    session.messageTimestamps = session.messageTimestamps.filter((t) => now - t < 10_000);
    session.messageTimestamps.push(now);
    if (session.messageTimestamps.length > MAX_MESSAGES_PER_10S) {
      this.send(session, { type: 'error', code: 'RATE_LIMITED', message: 'Too many messages' });
      session.socket.close(4029, 'rate limited');
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(session, { type: 'error', code: 'BAD_JSON', message: 'Invalid JSON' });
      return;
    }
    try {
      if (msg.type === 'auth') return await this.handleAuth(session, msg.token);
      if (msg.type === 'ping') return this.send(session, { type: 'pong' });
      if (!session.userId || !session.playerId) return this.send(session, { type: 'auth:error', message: 'Authenticate first' });
      switch (msg.type) {
        case 'battle:join':
          return await this.handleBattleJoin(session, msg.battleId);
        case 'battle:deploy':
          if (!session.battle || session.battle.battleId !== msg.battleId) return this.send(session, { type: 'error', code: 'NO_BATTLE', message: 'Join a battle first' });
          return session.battle.deploy(msg.troopType, msg.x, msg.y);
        case 'battle:end':
          if (!session.battle || session.battle.battleId !== msg.battleId) return this.send(session, { type: 'error', code: 'NO_BATTLE', message: 'Join a battle first' });
          return await session.battle.endEarly();
        case 'clan:subscribe':
          return await this.refreshClan(session);
        case 'clan:message': {
          await this.refreshClan(session);
          if (!session.clanId) return this.send(session, { type: 'error', code: 'NOT_IN_CLAN', message: 'You are not in a clan' });
          await postClanMessage(this.ctx, session.playerId, String(msg.content ?? ''));
          return;
        }
        default:
          return this.send(session, { type: 'error', code: 'UNKNOWN_TYPE', message: 'Unknown message type' });
      }
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.send(session, { type: 'error', code: err.code ?? 'INTERNAL', message: err.message ?? 'Something went wrong' });
      if (!err.code) this.opts.logger.error({ err: e }, 'ws handler error');
    }
  }

  private async handleAuth(session: ClientSession, token: string) {
    let claims: Claims;
    try {
      claims = jwt.verify(token, this.opts.env.JWT_SECRET, { issuer: 'launch-api', audience: 'launch' }) as Claims;
    } catch {
      return this.send(session, { type: 'auth:error', message: 'Invalid or expired token' });
    }
    if (!claims.pid) return this.send(session, { type: 'auth:error', message: 'No player profile' });
    const user = await this.opts.db.user.findUnique({ where: { id: claims.sub }, select: { status: true } });
    if (!user || user.status === 'BANNED') return this.send(session, { type: 'auth:error', message: 'Account unavailable' });
    session.userId = claims.sub;
    session.playerId = claims.pid;
    if (!this.byUser.has(claims.sub)) this.byUser.set(claims.sub, new Set());
    this.byUser.get(claims.sub)!.add(session);
    await this.refreshClan(session);
    this.send(session, { type: 'auth:ok', userId: claims.sub, playerId: claims.pid });
  }

  private async refreshClan(session: ClientSession) {
    if (!session.playerId) return;
    const member = await this.opts.db.clanMember.findUnique({ where: { playerId: session.playerId }, select: { clanId: true } });
    session.clanId = member?.clanId ?? null;
  }

  private async handleBattleJoin(session: ClientSession, battleId: string) {
    if (session.battle) {
      if (session.battle.battleId === battleId) return session.battle.resend(session);
      await session.battle.dispose('replaced');
      session.battle = null;
    }
    const room = new BattleRoom(this, session, battleId, this.opts.logger);
    session.battle = room;
    await room.start();
  }

  private async onClose(session: ClientSession) {
    this.sessions.delete(session);
    if (session.userId) {
      const set = this.byUser.get(session.userId);
      set?.delete(session);
      if (set && set.size === 0) this.byUser.delete(session.userId);
    }
    if (session.battle) {
      // the attacker disconnected mid-battle: the simulation keeps running to its natural end
      session.battle.detach();
    }
  }

  private onRedisMessage(channel: string, raw: string) {
    try {
      if (channel === NOTIFY_CHANNEL) {
        const { userId, notification } = JSON.parse(raw) as { userId: string; notification: NotificationDTO };
        for (const s of this.byUser.get(userId) ?? []) this.send(s, { type: 'notification', notification });
      } else if (channel === CLAN_CHAT_CHANNEL) {
        const message = JSON.parse(raw) as ClanMessageDTO;
        for (const s of this.sessions) if (s.clanId === message.clanId) this.send(s, { type: 'clan:message', message });
      }
    } catch (e) {
      this.opts.logger.warn({ err: e }, 'bad redis message');
    }
  }
}
