import "server-only";
import { buildHandoff, studioUrl } from "@/lib/handoff";
import { chains, pairOptions, pads, stocks } from "@/lib/pads";
import { canLaunchOnChain } from "@/lib/onchain";
import { site } from "@/lib/site";
import type { Agent } from "@/lib/types";
import { confirmOnChain, createDraft, prepareOnChain, queryLaunches, submitDraft, toPublic } from "./launches";
import { store } from "./store";

/**
 * A small Model Context Protocol server (JSON-RPC 2.0 over HTTP POST).
 * Drafting is open; submit_launch needs an agent key.
 */

type Json = Record<string, unknown>;

export const PROTOCOL_VERSION = "2025-06-18";

const draftProps = {
  chain: { type: "string", enum: chains.map((c) => c.id) },
  pad: { type: "string", enum: pads.map((p) => p.id) },
  pair: { type: "string", description: "Pair symbol the pad supports, e.g. ETH, or a stock like TSLA on pads with STOCK" },
  name: { type: "string", maxLength: 32 },
  ticker: { type: "string", maxLength: 10 },
  description: { type: "string", maxLength: 280 },
  image: { type: "string", description: "data:image/png|jpeg|webp|gif;base64,… up to ~300 KB, 512px is plenty. Required to launch on Pump.fun" },
  x: { type: "string", description: "https://x.com/… link" },
  website: { type: "string", description: "Your own site; omit to use the Picker token page" },
  opening_buy: { type: "string", description: "Dev buy in the chain's native asset; omit for none" },
  address: { type: "string", description: "Only for mode=import" },
  mode: { type: "string", enum: ["create", "import"], default: "create" },
};

export const tools = [
  {
    name: "list_pads",
    description: `List every chain, launchpad and pair ${site.name} can launch on.`,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "draft_launch",
    description: "Save a launch draft and get its id and studio link. Does not create the token.",
    inputSchema: { type: "object", properties: draftProps, required: ["chain", "pad", "pair", "name", "ticker"] },
  },
  {
    name: "get_draft",
    description: "Read a draft saved from the studio, with the handoff note the person saw.",
    inputSchema: { type: "object", properties: { draft_id: { type: "string" } }, required: ["draft_id"] },
  },
  {
    name: "submit_launch",
    description: "Submit a draft to its launchpad. Requires an agent key in the Authorization header.",
    inputSchema: { type: "object", properties: { draft_id: { type: "string" } }, required: ["draft_id"] },
  },
  {
    name: "prepare_launch",
    description:
      "Pump.fun (Solana, SOL pair) only: returns the unsigned create transaction (base64, versioned) for a draft. Generate a fresh mint keypair, pass its public key as mint and your wallet as creator. Sign with your wallet first, then the mint keypair, send it to Solana, then call confirm_launch.",
    inputSchema: {
      type: "object",
      properties: { draft_id: { type: "string" }, creator: { type: "string" }, mint: { type: "string" } },
      required: ["draft_id", "creator", "mint"],
    },
  },
  {
    name: "confirm_launch",
    description: "Check a prepared Pump.fun launch on Solana by its transaction signature. Returns pending, live or failed.",
    inputSchema: {
      type: "object",
      properties: { draft_id: { type: "string" }, signature: { type: "string" } },
      required: ["draft_id", "signature"],
    },
  },
  {
    name: "list_launches",
    description: "Search the public ledger of submitted launches.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" }, chain: { type: "string" }, limit: { type: "number", maximum: 50 } },
    },
  },
];

const text = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  ...(typeof value === "object" && value !== null && !isError ? { structuredContent: value } : {}),
  isError,
});

async function callTool(name: string, args: Json, ctx: { agent: Agent | null; origin: string }) {
  switch (name) {
    case "list_pads":
      return text({
        chains: chains.map((c) => ({
          id: c.id,
          name: c.name,
          native: c.native,
          min_opening_buy: c.minBuy,
          pads: pads.filter((p) => p.chain === c.id).map((p) => ({ id: p.id, name: p.name, pairs: p.pairs, accepted_pairs: pairOptions(p) })),
        })),
        stocks: stocks.map((s) => ({ symbol: s.symbol, name: s.name })),
      });

    case "draft_launch": {
      const result = await createDraft({
        mode: args.mode ?? "create",
        chain: args.chain,
        pad: args.pad,
        pair: args.pair,
        name: args.name,
        ticker: args.ticker,
        description: args.description,
        image: args.image,
        x: args.x,
        websiteMode: args.website ? "custom" : "hosted",
        website: args.website,
        openingBuy: args.opening_buy,
        address: args.address,
      });
      if (!result.ok) return text({ errors: result.errors }, true);
      const l = result.launch;
      return text({ draft_id: l.id, studio_url: studioUrl(ctx.origin, l, l.id), next: canLaunchOnChain(l) ? "Call prepare_launch with this draft_id, your wallet and a fresh mint." : "Call submit_launch with this draft_id." });
    }

    case "get_draft": {
      const l = await store().getLaunch(String(args.draft_id ?? ""));
      if (!l) return text("No draft with that id.", true);
      const { image: _image, ...rest } = toPublic(l);
      return text({ ...rest, has_image: Boolean(l.image), handoff: buildHandoff({ ...l, hasImage: Boolean(l.image) }, ctx.origin, l.id) });
    }

    case "submit_launch": {
      if (!ctx.agent) return text(`Unauthorized. Send "Authorization: Bearer ${site.keyPrefix}…". People can draft; only agents submit.`, true);
      const res = await submitDraft(String(args.draft_id ?? ""), ctx.agent);
      if (!res.ok) return text(res.error, true);
      const { image: _image, ...rest } = toPublic(res.launch);
      return text({ launch: rest, explore_url: `${ctx.origin}/explore?q=${encodeURIComponent(res.launch.ticker)}` });
    }

    case "prepare_launch": {
      const r = await prepareOnChain(String(args.draft_id ?? ""), { creator: args.creator, mint: args.mint }, ctx.origin);
      if (!r.ok) return text(r.error, true);
      return text({ transaction: r.transaction, encoding: "base64", mint: r.mint, next: "Sign (wallet, then mint), send to Solana, then call confirm_launch with the signature." });
    }

    case "confirm_launch": {
      const r = await confirmOnChain(String(args.draft_id ?? ""), args.signature, ctx.agent);
      if (!r.ok) return text(r.error, true);
      const { image: _image, ...launch } = toPublic(r.launch);
      return text({ state: r.state, launch });
    }

    case "list_launches": {
      const rows = await queryLaunches({
        q: typeof args.q === "string" ? args.q : undefined,
        chain: typeof args.chain === "string" ? args.chain : undefined,
        limit: Math.min(Number(args.limit) || 20, 50),
      });
      return text({ launches: rows.map(({ image: _image, ...r }) => r) });
    }

    default:
      return null;
  }
}

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
}

export async function handleRpc(msg: RpcRequest, ctx: { agent: Agent | null; origin: string }) {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });

  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "Invalid request");
  // Notifications get no response.
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: site.name.toLowerCase(), version: "0.1.0" },
        instructions: `Draft a launch with draft_launch (or read one a person saved with get_draft). Pump.fun drafts paired with SOL launch on-chain: prepare_launch, sign with your Solana wallet and the mint keypair, send, then confirm_launch. Other pads: submit_launch with your ${site.name} agent key.`,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const result = await callTool(name, (msg.params?.arguments as Json) ?? {}, ctx);
      return result ? reply(result) : fail(-32602, `Unknown tool: ${name}`);
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}
