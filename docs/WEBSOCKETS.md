# WebSockets (game server)

URL: `ws://localhost:4100`. JSON messages; types in `packages/types/src/index.ts` (`ClientMessage`, `ServerMessage`).

1. `{ "type": "auth", "token": "<accessToken>" }` within 10 s → `auth:ok` or `auth:error`.
2. Battles: `battle:join {battleId}` (battle created by `POST /game/battles/find`) → `battle:ready {snapshot, army, durationMs, prepMs}`; `battle:deploy {battleId, troopType, x, y}` → `battle:state` every 250 ms + `battle:event` (deploy / building_destroyed / troop_died / star / rejected); `battle:end` → `battle:result`.
3. `clan:subscribe`, `clan:message {content}` → `clan:message` broadcast to online clan members (via Redis pub/sub, so it works across game-server instances).
4. `notification` messages are pushed for defenses, invites, donations.
5. `ping` → `pong`. 60 messages / 10 s per connection; heartbeat ping every 30 s.

The server validates every deployment; invalid ones return `battle:event {kind:'rejected', reason}` and are never simulated. Disconnecting mid-battle does not refund the army: the simulation runs to completion and the result is persisted.
