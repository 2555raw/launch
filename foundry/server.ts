/**
 * FOUNDRY custom server: Next.js for pages and API routes, `ws` for the
 * realtime global counter, and the in-process scheduler for flushes and the
 * launch countdown.
 */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { handleUpgrade } from "./src/server/ws";
import { startScheduler } from "./src/server/scheduler";
import { env } from "./src/server/env";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port: env.port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => handle(req, res, parse(req.url ?? "/", true)));
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "/");
    if (pathname === "/ws") handleUpgrade(req, socket, head);
    else if (dev && pathname?.startsWith("/_next")) {
      // Next's HMR socket
      app.getUpgradeHandler()(req, socket, head);
    } else socket.destroy();
  });
  await startScheduler();
  server.listen(env.port, () => console.log(`> FOUNDRY ready on ${env.appUrl} (${dev ? "dev" : "prod"})`));
});
