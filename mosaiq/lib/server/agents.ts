import "server-only";
import type { Agent, PublicAgent } from "@/lib/types";
import { hashKey, newAgentKey, newId } from "./ids";
import { store } from "./store";

export async function createAgent(name: string): Promise<{ agent: PublicAgent; key: string }> {
  const { key, hash, prefix } = newAgentKey();
  const agent: Agent = {
    id: newId("agt", 10),
    name,
    keyHash: hash,
    keyPrefix: prefix,
    createdAt: new Date().toISOString(),
    launches: 0,
  };
  await store().insertAgent(agent);
  return { agent: { id: agent.id, name, keyPrefix: prefix, createdAt: agent.createdAt }, key };
}

/** Resolve `Authorization: Bearer mq_live_…` to an agent, or null. */
export async function agentFromRequest(req: Request): Promise<Agent | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  return (await store().findAgentByHash(hashKey(match[1]))) ?? null;
}
