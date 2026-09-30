import "server-only";
import { randomBytes } from "node:crypto";
import { encodeFunctionData, getContractAddress, keccak256, parseUnits, toHex, type Address, type Hex } from "viem";
import type { Launch } from "@/lib/types";
import { assertEvmAddress, call, erc20Abi, evmClient, simulationError, verifyEvm } from "./evm";
import { LaunchError, type OnchainAdapter } from "./types";

/**
 * Argus on Arc mainnet, Portal #7 (Sourcify full match). One `launch` call
 * deploys the token, its hooked Uniswap v4 pool, curve position, LP lock, tax
 * hook and fee splitter. Nothing is paid in msg.value: the opening buy is
 * pulled from the creator's USDC (ERC-20 at 0x3600…, 6 decimals) by
 * safeTransferFrom, so it needs an allowance to the Portal first.
 */
const PORTAL: Address = "0xB021Be536808f551b31789422Fd28a6c9c6e97Da";
const USDC: Address = "0x3600000000000000000000000000000000000000";
const CHAIN_ID = 5042;
/** keccak256("TokenCreated(address,address,string,string,bytes32,string,string,string,string)") */
const TOKEN_CREATED = "0x1d8917231579f8ce39407f0d616f36f357b07329b0ce5164d0754ac15145ce0a";

/** Economics copied from a real Argus launch (ARC INU): $2.5k start FDV, bonds at $45k. */
const TOTAL_SUPPLY = 10n ** 27n; // 1e9 tokens, 18 decimals
const START_FDV_USDC6 = 2_500n * 10n ** 6n;
const BOND_FDV_USDC6 = 45_000n * 10n ** 6n;
/** Both taxes may not be zero (ZeroTaxNotAllowed); 1 bp on sells is the smallest legal tax. */
const BUY_TAX_BPS = 0;
const SELL_TAX_BPS = 1;
/** Payout must be in the quote (USDC is the default quote, so it never converts). */
const EXPECT_CONVERT = 1;

/** The hook's address must carry these v4 permission bits and no others (ArgusV4HookFlags). */
const HOOK_MASK = 0x3fff;
const HOOK_REQUIRED = 0x2044; // BEFORE_INITIALIZE | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA
const MAX_MINE_TRIES = 2_000_000; // mean 16,384; P(miss) ≈ e^-122

const launchParams = {
  type: "tuple",
  name: "p",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "totalSupply", type: "uint256" },
    { name: "startFdvUsdc6", type: "uint256" },
    { name: "bondFdvUsdc6", type: "uint256" },
    { name: "buyTaxBps", type: "uint16" },
    { name: "sellTaxBps", type: "uint16" },
    { name: "creatorBps", type: "uint16" },
    { name: "burnBps", type: "uint16" },
    { name: "dividendBps", type: "uint16" },
    { name: "liquidityBps", type: "uint16" },
    { name: "devBuyQuote", type: "uint256" },
    { name: "quoteAsset", type: "address" },
    { name: "expectConvert", type: "uint8" },
  ],
} as const;

const tokenMeta = {
  type: "tuple",
  name: "meta",
  components: [
    { name: "imageURI", type: "string" },
    { name: "website", type: "string" },
    { name: "twitter", type: "string" },
    { name: "telegram", type: "string" },
    { name: "description", type: "string" },
  ],
} as const;

const portalAbi = [
  {
    type: "function",
    name: "launch",
    stateMutability: "nonpayable",
    inputs: [launchParams, tokenMeta, { name: "salt", type: "bytes32" }, { name: "hookSalt", type: "bytes32" }],
    outputs: [{ name: "token", type: "address" }],
  },
  { type: "function", name: "predictSplitter", stateMutability: "view", inputs: [{ name: "creator", type: "address" }, { name: "salt", type: "bytes32" }], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "hookInitCodeHash",
    stateMutability: "view",
    inputs: [{ name: "splitter_", type: "address" }, { name: "buyTaxBps", type: "uint16" }, { name: "sellTaxBps", type: "uint16" }, { name: "quote", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "predictHook",
    stateMutability: "view",
    inputs: [
      { name: "creator", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "hookSalt", type: "bytes32" },
      { name: "buyTaxBps", type: "uint16" },
      { name: "sellTaxBps", type: "uint16" },
      { name: "quote", type: "address" },
    ],
    outputs: [{ name: "hook", type: "address" }, { name: "mask", type: "uint160" }, { name: "valid", type: "bool" }],
  },
] as const;

const balanceOfAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const bytesOf = (h: Hex) => Buffer.from(h.slice(2), "hex");

/**
 * Find `hookSalt` such that the Portal's CREATE2 of the hook — salt
 * keccak256(abi.encode(creator, hookSalt)), deployer the Portal itself
 * (`_deployHook`) — lands on an address whose low 14 bits are 0x2044.
 * Works on raw bytes: two keccaks per try, no hex round trips.
 */
export function mineHookSalt(creator: Address, initCodeHash: Hex): { hookSalt: Hex; hook: Address } {
  // abi.encode(address, bytes32): 12 zero bytes, the address, then the salt.
  const saltPre = new Uint8Array(64);
  saltPre.set(bytesOf(creator), 12);
  const base = randomBytes(32);
  saltPre.set(base, 32);
  // 0xff ++ deployer ++ create2Salt ++ initCodeHash
  const addrPre = new Uint8Array(85);
  addrPre[0] = 0xff;
  addrPre.set(bytesOf(PORTAL), 1);
  addrPre.set(bytesOf(initCodeHash), 53);

  for (let i = 0; i < MAX_MINE_TRIES; i++) {
    // Vary the last four bytes of the random base.
    saltPre[60] = base[28] ^ (i >>> 24);
    saltPre[61] = base[29] ^ ((i >>> 16) & 0xff);
    saltPre[62] = base[30] ^ ((i >>> 8) & 0xff);
    saltPre[63] = base[31] ^ (i & 0xff);
    addrPre.set(keccak256(saltPre, "bytes"), 21);
    const h = keccak256(addrPre, "bytes");
    if ((((h[30] << 8) | h[31]) & HOOK_MASK) === HOOK_REQUIRED) {
      const hookSalt = toHex(saltPre.slice(32));
      const hook = getContractAddress({ opcode: "CREATE2", from: PORTAL, salt: addrPre.slice(21, 53), bytecodeHash: initCodeHash });
      return { hookSalt, hook };
    }
  }
  throw new LaunchError("Could not find a hook address for this launch. Try again.", 500);
}

export const argus: OnchainAdapter = {
  wallet: "evm",

  async prepare(launch: Launch, ctx) {
    const creator = assertEvmAddress(ctx.creator);
    if (launch.pair !== "USDC") throw new LaunchError(`Argus pairs with USDC only on-chain, not ${launch.pair}.`, 422);

    let buy = 0n;
    try {
      buy = launch.openingBuy ? parseUnits(launch.openingBuy, 6) : 0n;
    } catch {
      throw new LaunchError("The opening buy must be a USDC amount like 10 or 2.5.", 422);
    }
    if (buy < 0n) throw new LaunchError("The opening buy cannot be negative.", 422);

    const client = evmClient("arc");
    const salt = `0x${randomBytes(32).toString("hex")}` as Hex;
    const unreachable = () => {
      throw new LaunchError("Arc did not respond. Try again.", 502);
    };

    // The hook's init code names the splitter, which depends on (creator, salt).
    const [splitter, allowance, balance] = await Promise.all([
      client.readContract({ address: PORTAL, abi: portalAbi, functionName: "predictSplitter", args: [creator, salt] }),
      buy > 0n ? client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [creator, PORTAL] }) : Promise.resolve(0n),
      buy > 0n ? client.readContract({ address: USDC, abi: balanceOfAbi, functionName: "balanceOf", args: [creator] }) : Promise.resolve(0n),
    ]).catch(unreachable);
    if (buy > 0n && balance < buy) throw new LaunchError("Your wallet does not have enough USDC for this opening buy.");

    const initCodeHash = await client
      .readContract({ address: PORTAL, abi: portalAbi, functionName: "hookInitCodeHash", args: [splitter, BUY_TAX_BPS, SELL_TAX_BPS, USDC] })
      .catch(unreachable);
    const { hookSalt, hook } = mineHookSalt(creator, initCodeHash);

    // Confirm the mined salt against the Portal's own view, not our reconstruction.
    const [predicted, , valid] = await client
      .readContract({ address: PORTAL, abi: portalAbi, functionName: "predictHook", args: [creator, salt, hookSalt, BUY_TAX_BPS, SELL_TAX_BPS, USDC] })
      .catch(unreachable);
    if (!valid || predicted.toLowerCase() !== hook.toLowerCase()) throw new LaunchError("Argus rejected the hook address for this launch. Try again.", 500);

    const params = (devBuyQuote: bigint) => ({
      name: launch.name,
      symbol: launch.ticker,
      totalSupply: TOTAL_SUPPLY,
      startFdvUsdc6: START_FDV_USDC6,
      bondFdvUsdc6: BOND_FDV_USDC6,
      buyTaxBps: BUY_TAX_BPS,
      sellTaxBps: SELL_TAX_BPS,
      creatorBps: 10_000,
      burnBps: 0,
      dividendBps: 0,
      liquidityBps: 0,
      devBuyQuote,
      quoteAsset: USDC,
      expectConvert: EXPECT_CONVERT,
    });
    const meta = {
      imageURI: ctx.imageUrl,
      website: launch.website ?? ctx.origin,
      twitter: launch.x ?? "",
      telegram: "",
      description: launch.description ?? "",
    };

    // Until an approve is mined the dev-buy pull reverts, so in that case the
    // simulation runs without the buy to validate everything else.
    const needsApprove = buy > 0n && allowance < buy;
    await client
      .simulateContract({
        address: PORTAL,
        abi: portalAbi,
        functionName: "launch",
        args: [params(needsApprove ? 0n : buy), meta, salt, hookSalt],
        account: creator,
      })
      .catch((e) => {
        throw simulationError(e);
      });

    const data = encodeFunctionData({ abi: portalAbi, functionName: "launch", args: [params(buy), meta, salt, hookSalt] });
    const calls = [call(PORTAL, data, 0n, buy > 0n ? "Launch and buy on Argus" : "Launch on Argus")];
    if (needsApprove) {
      const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [PORTAL, buy] });
      calls.unshift(call(USDC, approve, 0n, "Approve USDC"));
    }
    return { prepared: { kind: "evm", chainId: CHAIN_ID, calls }, metadataUri: undefined };
  },

  async verify(launch, hash) {
    return verifyEvm("arc", hash, { from: launch.creator!, to: [PORTAL] }, (receipt) => {
      const log = receipt.logs.find(
        (l) =>
          l.address.toLowerCase() === PORTAL.toLowerCase() &&
          l.topics[0] === TOKEN_CREATED &&
          `0x${l.topics[2]?.slice(26)}`.toLowerCase() === launch.creator!.toLowerCase(),
      );
      return log?.topics[1] ? `0x${log.topics[1].slice(26)}` : null;
    });
  },
};
