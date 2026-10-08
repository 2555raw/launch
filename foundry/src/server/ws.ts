/**
 * WebSocket hub: pushes the global snapshot to every connected client about
 * once a second, and project status changes immediately.
 */
import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Duplex } from "node:stream";

const g = globalThis as unknown as { wss?: WebSocketServer };

export function getHub(): WebSocketServer {
  if (!g.wss) {
    g.wss = new WebSocketServer({ noServer: true });
    g.wss.on("connection", (ws) => {
      (ws as WebSocket & { isAlive: boolean }).isAlive = true;
      ws.on("pong", () => ((ws as WebSocket & { isAlive: boolean }).isAlive = true));
      ws.on("error", () => ws.close());
    });
    setInterval(() => {
      for (const ws of g.wss!.clients) {
        const w = ws as WebSocket & { isAlive: boolean };
        if (!w.isAlive) return w.terminate();
        w.isAlive = false;
        w.ping();
      }
    }, 30_000).unref();
  }
  return g.wss;
}

export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const hub = getHub();
  hub.handleUpgrade(req, socket, head, (ws) => hub.emit("connection", ws, req));
}

export function broadcast(type: string, payload: unknown) {
  const hub = getHub();
  if (hub.clients.size === 0) return;
  const msg = JSON.stringify({ type, payload });
  for (const c of hub.clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
}

export function clientCount(): number {
  return getHub().clients.size;
}
