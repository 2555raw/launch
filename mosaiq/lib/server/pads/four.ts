import "server-only";
import { decodeEventLog, encodeFunctionData, parseEther, type Address, type Hex } from "viem";
import type { Launch } from "@/lib/types";
import { assertBalance, assertEvmAddress, call, evmClient, simulationError, verifyEvm } from "./evm";
import { LaunchError, type OnchainAdapter } from "./types";

/**
 * Four.meme on BNB Chain, following the official integration guide
 * (github.com/four-meme-community/fourmeme-docs): the wallet signs a login
 * message, the server uploads the image and asks the API for the signed
 * create arguments, and the wallet sends TokenManager2.createToken.
 */
const API = "https://four.meme/meme-api/v1";
const TOKEN_MANAGER2: Address = "0x5c952063c7fc8610FFDB798152D69F0B9550762b";

const tm2Abi = [
  { type: "function", name: "createToken", stateMutability: "payable", inputs: [{ name: "args", type: "bytes" }, { name: "signature", type: "bytes" }], outputs: [] },
  { type: "function", name: "_launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "_tradingFeeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "TokenCreate",
    inputs: [
      { name: "creator", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "totalSupply", type: "uint256", indexed: false },
      { name: "launchTime", type: "uint256", indexed: false },
      { name: "launchFee", type: "uint256", indexed: false },
    ],
  },
] as const;

interface RaisedToken {
  symbol: string;
  status?: string;
  totalAmount?: string | number;
  totalBAmount?: string | number;
  saleRate?: string | number;
}

/** Call the Four.meme API; it answers { code: "0", data } on success. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res) throw new LaunchError("Four.meme did not respond. Try again.", 502);
  if (res.status === 403) throw new LaunchError("Four.meme refused this server's region, so launches there are not available right now.", 503);
  const body = (await res.json().catch(() => null)) as { code?: string | number; msg?: string; data?: T } | null;
  if (!body || (body.code !== "0" && body.code !== 0)) {
    throw new LaunchError(`Four.meme rejected the request${body?.msg ? `: ${String(body.msg).slice(0, 140)}` : "."}`, 502);
  }
  return body.data as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const toHex = (v: string): Hex => (v.startsWith("0x") ? (v as Hex) : /^[0-9a-fA-F]+$/.test(v) ? `0x${v}` : `0x${Buffer.from(v, "base64").toString("hex")}`);

export const four: OnchainAdapter = {
  wallet: "evm",

  async prepare(launch: Launch, ctx) {
    const creator = assertEvmAddress(ctx.creator);

    // Step 1: no signature yet, so hand the wallet Four.meme's login message.
    if (!ctx.signature) {
      const nonce = await api<string>("/private/user/nonce/generate", json({ accountAddress: creator, verifyType: "LOGIN", networkCode: "BSC" }));
      return { prepared: { kind: "sign", message: `You are sign in Meme ${nonce}` } };
    }

    // Step 2: log in with the signature, upload the image, get the signed create args.
    const token = await api<string>(
      "/private/user/login/dex",
      json({
        region: "WEB",
        langType: "EN",
        loginIp: "",
        inviteCode: "",
        verifyInfo: { address: creator, networkCode: "BSC", signature: ctx.signature, verifyType: "LOGIN" },
        walletName: "MetaMask",
      }),
    );

    const configs = await api<RaisedToken[]>("/public/config");
    const want = launch.pair === "BNB" ? "BNB" : `${launch.pair}B`;
    const raisedToken = configs.find((c) => c.symbol?.toUpperCase() === want.toUpperCase() && (c.status ?? "PUBLISH") === "PUBLISH");
    if (!raisedToken) throw new LaunchError(`Four.meme is not taking ${launch.pair} launches right now.`, 422);

    const buy = launch.openingBuy ? parseEther(launch.openingBuy) : 0n;
    if (buy > 0n && raisedToken.symbol !== "BNB") throw new LaunchError("On Four.meme an opening buy works with the BNB pair only. Leave it empty.", 422);

    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(launch.image ?? "");
    if (!m) throw new LaunchError("The token image could not be read.");
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), `logo.${m[1].split("/")[1]}`);
    const imgUrl = await api<string>("/private/token/upload", { method: "POST", headers: { "meme-web-access": token }, body: form });

    const body: Record<string, unknown> = {
      name: launch.name,
      shortName: launch.ticker,
      desc: launch.description || launch.name,
      totalSupply: Number(raisedToken.totalAmount ?? 1_000_000_000),
      raisedAmount: Number(raisedToken.totalBAmount ?? 24),
      saleRate: Number(raisedToken.saleRate ?? 0.8),
      reserveRate: 0,
      imgUrl,
      raisedToken,
      launchTime: Date.now(),
      funGroup: false,
      label: "Meme",
      lpTradingFee: 0.0025,
      preSale: launch.openingBuy ?? "0",
      clickFun: false,
      symbol: raisedToken.symbol,
      dexType: "PANCAKE_SWAP",
      rushMode: false,
      onlyMPC: false,
      feePlan: false,
      webUrl: launch.website ?? ctx.origin,
    };
    if (launch.x) body.twitterUrl = launch.x;
    const created = await api<{ createArg: string; signature: string }>("/private/token/create", {
      method: "POST",
      headers: { "meme-web-access": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Value as the official tool computes it: launch fee, plus presale and its trading fee for BNB.
    const client = evmClient("bsc");
    const fee = (await client.readContract({ address: TOKEN_MANAGER2, abi: tm2Abi, functionName: "_launchFee" })) as bigint;
    const rate = buy > 0n ? ((await client.readContract({ address: TOKEN_MANAGER2, abi: tm2Abi, functionName: "_tradingFeeRate" })) as bigint) : 0n;
    const value = fee + buy + (buy * rate) / 10000n;
    await assertBalance("bsc", creator, value);

    const args = [toHex(created.createArg), toHex(created.signature)] as const;
    await client.simulateContract({ address: TOKEN_MANAGER2, abi: tm2Abi, functionName: "createToken", args, value, account: creator }).catch((e) => {
      throw simulationError(e);
    });
    const data = encodeFunctionData({ abi: tm2Abi, functionName: "createToken", args });
    return { prepared: { kind: "evm", chainId: 56, calls: [call(TOKEN_MANAGER2, data, value, "Launch on Four.meme")] }, metadataUri: imgUrl };
  },

  async verify(launch, hash) {
    return verifyEvm("bsc", hash, { from: launch.creator!, to: [TOKEN_MANAGER2] }, (receipt) => {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== TOKEN_MANAGER2.toLowerCase()) continue;
        try {
          const ev = decodeEventLog({ abi: tm2Abi, data: log.data, topics: log.topics, eventName: "TokenCreate" });
          if (ev.args.creator.toLowerCase() === launch.creator!.toLowerCase()) return ev.args.token;
        } catch {
          /* another event */
        }
      }
      return null;
    });
  },
};
