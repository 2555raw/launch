#!/usr/bin/env node
/**
 * Plays the agent side end to end against a running server:
 *   issue a key → draft_launch → get_draft → submit_launch → list_launches
 *
 *   npm run agent:demo                     # http://localhost:3000
 *   BASE_URL=https://… npm run agent:demo
 */
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let id = 0;

async function rpc(method, params, key) {
  const res = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

async function tool(name, args, key) {
  const r = await rpc("tools/call", { name, arguments: args }, key);
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  return r.structuredContent ?? JSON.parse(r.content[0].text);
}

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "agent-demo", version: "1" } });
console.log("✓ initialize", init.serverInfo);

const agentRes = await fetch(`${base}/api/agents`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: process.env.AGENT_NAME ?? "Demo Agent" }),
});
if (!agentRes.ok) throw new Error(`agents: ${agentRes.status} ${await agentRes.text()}`);
const { agent, key } = await agentRes.json();
console.log("✓ agent key issued for", agent.name, `(${agent.keyPrefix}…)`);

const pads = await tool("list_pads", {});
console.log("✓ list_pads:", pads.chains.map((c) => `${c.name} [${c.pads.map((p) => p.name).join(", ")}]`).join(" · "));

const ticker = `DEMO${Math.floor(Math.random() * 900 + 100)}`;
const draft = await tool("draft_launch", { chain: "solana", pad: "pump", pair: "SOL", name: `Demo ${ticker}`, ticker, description: "Created by scripts/agent-demo.mjs" });
console.log("✓ draft_launch", draft.draft_id);

const read = await tool("get_draft", { draft_id: draft.draft_id });
console.log("✓ get_draft status =", read.status);

const unauth = await rpc("tools/call", { name: "submit_launch", arguments: { draft_id: draft.draft_id } });
console.log(unauth.isError ? "✓ submit without key rejected" : "✗ submit without key was accepted!");

const submitted = await tool("submit_launch", { draft_id: draft.draft_id }, key);
console.log("✓ submit_launch status =", submitted.launch.status, "→", submitted.explore_url);

const again = await rpc("tools/call", { name: "submit_launch", arguments: { draft_id: draft.draft_id } }, key);
console.log(again.isError ? "✓ double submit rejected" : "✗ double submit accepted!");

const list = await tool("list_launches", { q: ticker });
console.log("✓ list_launches found", list.launches.length);
