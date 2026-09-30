import "server-only";
import { randomBytes } from "node:crypto";
import { encodeFunctionData, parseEther, zeroAddress, type Address, type Hex } from "viem";
import type { Launch } from "@/lib/types";
import { pinImage } from "./ipfs";
import { assertBalance, assertEvmAddress, call, evmClient, simulationError, verifyEvm } from "./evm";
import { LaunchError, type OnchainAdapter } from "./types";

/**
 * Pons v2 on Robinhood Chain (docs.ponsfamily.com/v2). Plain launches call the
 * factory's launchToken with the launch fee; launches with an opening buy go
 * through the LaunchAndBuy router with fee + ETH in.
 */
const FACTORY: Address = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const ROUTER: Address = "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948";
const TOKEN_LAUNCHED = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";

/** Pair symbol -> pair token (native ETH is the zero address). From the Pons app. */
const PAIRS: Record<string, Address> = {
  ETH: zeroAddress,
  USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  cbBTC: "0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  COIN: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
  QQQ: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",
  AMZN: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  NFLX: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8",
  PLTR: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A",
  AMD: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",
  MSTR: "0xec262a75e413fAfD0dF80480274532C79D42da09",
  CRCL: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5",
};

const tokenParams = {
  type: "tuple",
  name: "params",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "logo", type: "string" },
    { name: "description", type: "string" },
    {
      name: "socials",
      type: "tuple",
      components: [
        { name: "twitter", type: "string" },
        { name: "telegram", type: "string" },
        { name: "discord", type: "string" },
        { name: "website", type: "string" },
        { name: "farcaster", type: "string" },
      ],
    },
    { name: "creatorFeeRecipient", type: "address" },
    { name: "creatorTaxBps", type: "uint16" },
    { name: "buybackEnabled", type: "bool" },
    { name: "expectedEconomics", type: "bytes32" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

const factoryAbi = [
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [tokenParams, { name: "launchConfigId", type: "uint256" }, { name: "pairToken", type: "address" }, { name: "snipeTaxExemptions", type: "address[]" }],
    outputs: [{ name: "token", type: "address" }, { name: "curve", type: "address" }],
  },
  { type: "function", name: "previewLaunchEconomics", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launchEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "canLaunch", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "approvedPairTokens", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const routerAbi = [
  {
    type: "function",
    name: "launchAndBuy",
    stateMutability: "payable",
    inputs: [
      tokenParams,
      { name: "launchConfigId", type: "uint256" },
      { name: "pairToken", type: "address" },
      { name: "quoteIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "snipeTaxExemptions", type: "address[]" },
    ],
    outputs: [{ name: "token", type: "address" }, { name: "curve", type: "address" }, { name: "tokensOut", type: "uint256" }],
  },
] as const;

export const pons: OnchainAdapter = {
  wallet: "evm",

  async prepare(launch: Launch, ctx) {
    const creator = assertEvmAddress(ctx.creator);
    const pair = PAIRS[launch.pair];
    if (!pair) throw new LaunchError(`Pons does not pair with ${launch.pair} on-chain yet.`, 422);
    const client = evmClient("robinhood");
    const read = <T>(functionName: string, args: unknown[] = []) =>
      client.readContract({ address: FACTORY, abi: factoryAbi, functionName: functionName as never, args: args as never }) as Promise<T>;

    const [enabled, allowed, fee, economics, approved] = await Promise.all([
      read<boolean>("launchEnabled"),
      read<boolean>("canLaunch", [creator]),
      read<bigint>("launchFee"),
      read<Hex>("previewLaunchEconomics", [0n, pair]),
      pair === zeroAddress ? Promise.resolve(true) : read<boolean>("approvedPairTokens", [pair]),
    ]).catch(() => {
      throw new LaunchError("Robinhood Chain did not respond. Try again.", 502);
    });
    if (!enabled) throw new LaunchError("Pons has paused new launches.", 409);
    if (!allowed) throw new LaunchError("Pons does not allow this wallet to launch right now.", 403);
    if (!approved) throw new LaunchError(`Pons no longer accepts ${launch.pair} as a pair.`, 422);

    const buy = launch.openingBuy ? parseEther(launch.openingBuy) : 0n;
    if (buy > 0n && pair !== zeroAddress) throw new LaunchError("On Pons an opening buy works with the ETH pair only. Leave it empty.", 422);

    // Pons' own uploader only accepts its site, so pin to IPFS ourselves or link our hosted image.
    const logo = launch.metadataUri ?? (await pinImage(launch.image!, launch.ticker)) ?? ctx.imageUrl;
    const params = {
      name: launch.name,
      symbol: launch.ticker,
      logo,
      description: launch.description ?? "",
      socials: { twitter: launch.x ?? "", telegram: "", discord: "", website: launch.website ?? ctx.origin, farcaster: "" },
      creatorFeeRecipient: creator,
      creatorTaxBps: 0,
      buybackEnabled: false,
      expectedEconomics: economics,
      salt: `0x${randomBytes(32).toString("hex")}` as Hex,
    };

    await assertBalance("robinhood", creator, fee + buy);

    if (buy === 0n) {
      const args = [params, 0n, pair, []] as const;
      await client.simulateContract({ address: FACTORY, abi: factoryAbi, functionName: "launchToken", args, value: fee, account: creator }).catch((e) => {
        throw simulationError(e);
      });
      const data = encodeFunctionData({ abi: factoryAbi, functionName: "launchToken", args });
      return { prepared: { kind: "evm", chainId: 4663, calls: [call(FACTORY, data, fee, "Launch on Pons")] }, metadataUri: logo };
    }

    // Simulate once to learn the tokens out, then allow 5% slippage.
    const sim = await client
      .simulateContract({ address: ROUTER, abi: routerAbi, functionName: "launchAndBuy", args: [params, 0n, pair, buy, 0n, creator, []], value: fee + buy, account: creator })
      .catch((e) => {
        throw simulationError(e);
      });
    const minOut = (sim.result[2] * 95n) / 100n;
    const data = encodeFunctionData({ abi: routerAbi, functionName: "launchAndBuy", args: [params, 0n, pair, buy, minOut, creator, []] });
    return { prepared: { kind: "evm", chainId: 4663, calls: [call(ROUTER, data, fee + buy, "Launch and buy on Pons")] }, metadataUri: logo };
  },

  async verify(launch, hash) {
    return verifyEvm("robinhood", hash, { from: launch.creator!, to: [FACTORY, ROUTER] }, (receipt) => {
      const log = receipt.logs.find(
        (l) =>
          l.address.toLowerCase() === FACTORY.toLowerCase() &&
          l.topics[0] === TOKEN_LAUNCHED &&
          `0x${l.topics[3]?.slice(26)}`.toLowerCase() === launch.creator!.toLowerCase(),
      );
      return log?.topics[1] ? `0x${log.topics[1].slice(26)}` : null;
    });
  },
};
