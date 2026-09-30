import "server-only";
import { buildCreateTx, checkCreate, isPublicKey, messageHash, uploadMetadata } from "../pump";
import { LaunchError, type OnchainAdapter } from "./types";

/** Pump.fun on Solana: PumpPortal builds the create transaction; see ../pump.ts. */
export const pump: OnchainAdapter = {
  wallet: "solana",

  async prepare(launch, ctx) {
    if (!ctx.mint || !isPublicKey(ctx.mint) || ctx.mint === ctx.creator) throw new LaunchError("mint must be a fresh Solana public key.", 422);
    const website = launch.website ?? `${ctx.origin}/explore?q=${encodeURIComponent(launch.ticker)}`;
    const metadataUri = launch.metadataUri ?? (await uploadMetadata(launch, website));
    const tx = await buildCreateTx({
      creator: ctx.creator,
      mint: ctx.mint,
      name: launch.name,
      symbol: launch.ticker,
      uri: metadataUri,
      buySol: launch.openingBuy ? Number(launch.openingBuy) : 0,
    });
    return {
      prepared: { kind: "solana", transaction: Buffer.from(tx.serialize()).toString("base64"), mint: ctx.mint, messageHash: messageHash(tx) },
      metadataUri,
    };
  },

  async verify(launch, signature) {
    const r = await checkCreate(signature, launch.creator!, launch.mint!);
    return r.state === "live" ? { state: "live", token: launch.mint! } : r;
  },
};
