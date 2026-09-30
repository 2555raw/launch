import "server-only";
import { randomBytes } from "node:crypto";
import { bytesToHex, decodeEventLog, encodeFunctionData, hexToBytes, keccak256, parseAbi, parseEther, zeroAddress, type Address, type Hex } from "viem";
import type { Launch } from "@/lib/types";
import { assertEvmAddress, call, evmClient, simulationError, verifyEvm } from "./evm";
import { LaunchError, type OnchainAdapter } from "./types";

/**
 * Flap on BNB Chain (docs.flap.sh, github.com/flap-sh/flap-skills). A launch is
 * one Portal.newTokenV7 call creating a Flap Token V3 with no buy/sell tax,
 * the same shape flap.sh itself sends. The token is a CREATE2 clone whose
 * address must end in 8888, so a vanity salt is mined here. BNB pairs can
 * include an opening buy paid as msg.value.
 */
const PORTAL: Address = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0";
/** Flap Token V3 implementation (tokenVersion 7); clones must end in 8888. */
const TOKEN_IMPL: Address = "0x88881b6f03090462a969eC7f48385744Eeb63333";
const TOKEN_VERSION = 7;
const MIGRATOR_V3 = 3;
const SUFFIX = 0x8888;
const TOKEN_CREATED = "0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603";
const UPLOAD_URL = "https://funcs.flap.sh/api/upload";

/** Pair symbol -> quote token (native BNB is the zero address, not WBNB). From flap.sh/api/launch/quote-tokens. */
const PAIRS: Record<string, Address> = {
  BNB: zeroAddress,
  BTC: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  NVDA: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436",
  AAPL: "0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A",
  TSLA: "0x5b1910eAaD6450E50f816082Aa078C41F10C292f",
  MSFT: "0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0",
  GOOGL: "0x3F53De71c126BdaBAe20f9cD64848d317f6C3238",
  SPY: "0x7138b48df7D98D7e3cc221BfE7192D0a178182D8",
  QQQ: "0x205812CdBed920aFf76C6580abD681a46D11efc7",
  HOOD: "0xA394dCEa3fd3847fD793afBFd163E2e3858B7c65",
  NFLX: "0xD6829Ea836b6FA224d099D40E54B31262f874631",
  MSTR: "0xE87afb3076AeB0f9B14E368DE8145ae6a2826A14",
};

/** Struct layouts from the Sourcify-verified Portal implementation (0x27a0f9Da7F5BEAd616fe0bf02bf0c793bece4e20). */
const portalAbi = parseAbi([
  "struct FeeConfig { uint8 feeType; uint16 bps; address marketingAddress; address dividendToken; uint256 minimumShareBalance; }",
  "struct NewTokenV7Params { string name; string symbol; string meta; uint8 dexThresh; bytes32 salt; uint8 migratorType; address quoteToken; uint256 quoteAmt; bytes permitData; bytes32 extensionID; bytes extensionData; uint8 dexId; uint16 buyTaxRate; uint16 sellTaxRate; uint64 taxDuration; uint64 antiFarmerDuration; address commissionReceiver; uint8 tokenVersion; FeeConfig[4] feeConfigs; }",
  "struct QuoteTokenConfiguration { uint8 enabled; uint8 defaultCurve; uint8 alternativeCurve; uint8 nativeToQuoteSwapType; uint8 dexId; }",
  "function newTokenV7(NewTokenV7Params params) payable returns (address)",
  "function getQuoteTokenConfiguration(address quoteToken) view returns (QuoteTokenConfiguration)",
  "event TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)",
]);

const ZERO32: Hex = `0x${"0".repeat(64)}`;
const noFee = { feeType: 0, bps: 0, marketingAddress: zeroAddress, dividendToken: zeroAddress, minimumShareBalance: 0n } as const;
/**
 * The tax split flap.sh sends for a no-tax token: all of it to dividends. Buy
 * and sell tax are 0, so it never takes anything, but the Portal rejects an
 * all-zero split (InvalidTaxDistribution) and wants the dividend paid in the
 * quote token (DividendTokenMustEqualQuoteToken).
 */
const feeConfigs = (quote: Address) =>
  [{ feeType: 2, bps: 10_000, marketingAddress: zeroAddress, dividendToken: quote, minimumShareBalance: 10_000n * 10n ** 18n }, noFee, noFee, noFee] as const;

/** keccak256 of the EIP-1167 clone init code the Portal deploys with CREATE2. */
const INIT_CODE_HASH = hexToBytes(keccak256(`0x3d602d80600a3d3981f3363d3d373d3d3d363d73${TOKEN_IMPL.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`));

/** Hash a random seed until CREATE2(PORTAL, salt, clone) ends in 8888 (~65k tries on average). */
function mineSalt(): Hex {
  const buf = new Uint8Array(85);
  buf[0] = 0xff;
  buf.set(hexToBytes(PORTAL), 1);
  buf.set(INIT_CODE_HASH, 53);
  let salt = keccak256(randomBytes(32), "bytes");
  for (let i = 0; i < 2_000_000; i++) {
    buf.set(salt, 21);
    const addr = keccak256(buf, "bytes");
    if (((addr[30] << 8) | addr[31]) === SUFFIX) return bytesToHex(salt);
    salt = keccak256(salt, "bytes");
  }
  throw new LaunchError("Could not find a token address for Flap. Try again.", 500);
}

/** Pin the image and links through Flap's uploader, which returns the metadata CID the Portal takes as `meta`. */
async function uploadMeta(launch: Launch, creator: Address, website: string): Promise<string> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(launch.image ?? "");
  if (!m) throw new LaunchError("The token image could not be read.");
  const form = new FormData();
  form.append(
    "operations",
    JSON.stringify({
      query: "mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }",
      variables: { file: null, meta: { website, twitter: launch.x ?? "", telegram: "", description: launch.description ?? "", creator } },
    }),
  );
  form.append("map", JSON.stringify({ "0": ["variables.file"] }));
  form.append("0", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), `image.${m[1].split("/")[1].split("+")[0]}`);
  const res = await fetch(UPLOAD_URL, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => null)) as { data?: { create?: string } } | null) : null;
  const cid = data?.data?.create;
  if (typeof cid !== "string" || !/^[a-z0-9]{46,100}$/i.test(cid)) throw new LaunchError("Flap did not accept the token image. Try again in a moment.", 502);
  return cid;
}

export const flap: OnchainAdapter = {
  wallet: "evm",

  async prepare(launch: Launch, ctx) {
    const creator = assertEvmAddress(ctx.creator);
    const quote = PAIRS[launch.pair];
    if (!quote) throw new LaunchError(`Flap does not pair with ${launch.pair} on-chain yet.`, 422);

    const buy = launch.openingBuy ? parseEther(launch.openingBuy) : 0n;
    if (buy > 0n && quote !== zeroAddress) throw new LaunchError("On Flap an opening buy works with the BNB pair only. Leave it empty.", 422);

    const client = evmClient("bsc");
    if (quote !== zeroAddress) {
      const config = await client.readContract({ address: PORTAL, abi: portalAbi, functionName: "getQuoteTokenConfiguration", args: [quote] }).catch(() => {
        throw new LaunchError("BNB Chain did not respond. Try again.", 502);
      });
      if (!config.enabled) throw new LaunchError(`Flap no longer accepts ${launch.pair} as a pair.`, 422);
    }

    const meta = launch.metadataUri ?? (await uploadMeta(launch, creator, launch.website ?? ctx.origin));
    const args = [
      {
        name: launch.name,
        symbol: launch.ticker,
        meta,
        dexThresh: 1,
        salt: mineSalt(),
        migratorType: MIGRATOR_V3,
        quoteToken: quote,
        quoteAmt: buy,
        permitData: "0x",
        extensionID: ZERO32,
        extensionData: "0x",
        dexId: 0,
        buyTaxRate: 0,
        sellTaxRate: 0,
        taxDuration: 0n,
        antiFarmerDuration: 2_592_000n,
        commissionReceiver: zeroAddress,
        tokenVersion: TOKEN_VERSION,
        feeConfigs: feeConfigs(quote),
      },
    ] as const;

    await client.simulateContract({ address: PORTAL, abi: portalAbi, functionName: "newTokenV7", args, value: buy, account: creator }).catch((e) => {
      throw simulationError(e);
    });
    const data = encodeFunctionData({ abi: portalAbi, functionName: "newTokenV7", args });
    return { prepared: { kind: "evm", chainId: 56, calls: [call(PORTAL, data, buy, "Launch on Flap")] }, metadataUri: meta };
  },

  async verify(launch, hash) {
    const creator = launch.creator!.toLowerCase();
    return verifyEvm("bsc", hash, { from: launch.creator!, to: [PORTAL] }, (receipt) => {
      for (const l of receipt.logs) {
        if (l.address.toLowerCase() !== PORTAL.toLowerCase() || l.topics[0] !== TOKEN_CREATED) continue;
        const ev = decodeEventLog({ abi: portalAbi, eventName: "TokenCreated", data: l.data, topics: l.topics });
        if (ev.args.creator.toLowerCase() === creator) return ev.args.token;
      }
      return null;
    });
  },
};
