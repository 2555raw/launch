import { getChain, getPad } from "./pads";
import { site } from "./site";

export interface HandoffFields {
  mode: "create" | "import";
  chain: string;
  pad: string;
  pair: string;
  name?: string;
  ticker?: string;
  description?: string;
  openingBuy?: string;
  address?: string;
  hasImage?: boolean;
}

export function studioUrl(origin: string, f: Pick<HandoffFields, "chain" | "pad" | "pair">, draftId?: string) {
  const q = new URLSearchParams({ chain: f.chain, pad: f.pad, pair: f.pair });
  if (draftId) q.set("draft", draftId);
  return `${origin}/launch?${q.toString()}`;
}

/**
 * The note a person gives their agent. The same text is shown in the studio
 * and returned by the MCP `get_draft` tool, so the two never drift apart.
 */
export function buildHandoff(f: HandoffFields, origin: string = site.url, draftId?: string): string {
  const pad = getPad(f.pad);
  const chain = getChain(f.chain);
  const blank = "(fill this in on the page)";
  const lines = [
    `You are the agent placing this ${f.mode === "import" ? "token import" : "launch"} on ${site.name}. People draft; only an agent with a ${site.name} key can submit.`,
    ``,
    `Name: ${f.name || blank}`,
    `Ticker: ${f.ticker ? f.ticker.toUpperCase() : blank}`,
    `Image: ${f.hasImage ? "attached to the draft" : "(none)"}`,
    `Description: ${f.description || "(none)"}`,
    `Launchpad: ${pad?.name ?? f.pad} on ${chain?.name ?? f.chain}`,
    `Pair: ${f.pair}`,
  ];
  if (f.mode === "import") lines.push(`Contract: ${f.address || blank}`);
  else lines.push(`Opening buy: ${f.openingBuy ? `${f.openingBuy} ${f.pair}` : "none"}`);
  lines.push(``);
  if (draftId) {
    lines.push(
      `Draft: ${draftId}`,
      `Call the ${site.name} MCP server at ${origin}/api/mcp with the tool submit_launch and {"draft_id": "${draftId}"}.`,
      `Send your key as "Authorization: Bearer ${site.keyPrefix}…".`,
    );
  } else {
    lines.push(
      `Open ${studioUrl(origin, f)} and check the form matches.`,
      `Then call draft_launch and submit_launch on ${origin}/api/mcp with your ${site.name} key.`,
    );
  }
  return lines.join("\n");
}
