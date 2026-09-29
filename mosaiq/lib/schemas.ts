import { z } from "zod";
import { chains, getChain, getPad, isValidAddress } from "./pads";

/** Largest token image we accept, as a base64 data URL (the client resizes to ~512px first). */
export const MAX_IMAGE_DATA_URL = 400_000;
export const DESCRIPTION_MAX = 280;

const optionalUrl = (hosts?: string[]) =>
  z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const u = new URL(v);
          if (u.protocol !== "https:" && u.protocol !== "http:") return false;
          return !hosts || hosts.includes(u.hostname.replace(/^www\./, ""));
        } catch {
          return false;
        }
      },
      { message: hosts ? `Use a link on ${hosts[0]}` : "Enter a full URL, starting with https://" },
    );

export const draftInputSchema = z
  .object({
    mode: z.enum(["create", "import"]),
    chain: z.enum(chains.map((c) => c.id) as [string, ...string[]]),
    pad: z.string(),
    pair: z.string(),
    name: z.string().trim().min(1, "Give the token a name").max(32, "32 characters at most"),
    ticker: z
      .string()
      .trim()
      .min(1, "Add a ticker")
      .max(10, "10 characters at most")
      .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only")
      .transform((v) => v.toUpperCase()),
    image: z
      .string()
      .max(MAX_IMAGE_DATA_URL, "That image is too large after compression")
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,/, "Unsupported image")
      .optional(),
    x: optionalUrl(["x.com", "twitter.com"]),
    websiteMode: z.enum(["mosaiq", "custom"]),
    website: optionalUrl(),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} characters at most`)
      .optional()
      .transform((v) => (v ? v : undefined)),
    openingBuy: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || /^\d+(\.\d+)?$/.test(v), "Enter a number, like 0.05"),
    address: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((d, ctx) => {
    const pad = getPad(d.pad);
    if (!pad || pad.chain !== d.chain) {
      ctx.addIssue({ code: "custom", path: ["pad"], message: "Pick a launchpad on this chain" });
      return;
    }
    const pair = pad.pairs.find((p) => p.symbol === d.pair);
    if (!pair) ctx.addIssue({ code: "custom", path: ["pair"], message: "Pick a pair this pad supports" });
    if (pair && d.openingBuy !== undefined && Number(d.openingBuy) < pair.minBuy) {
      ctx.addIssue({
        code: "custom",
        path: ["openingBuy"],
        message: `Minimum is ${pair.minBuy} ${pair.symbol}, or leave it empty`,
      });
    }
    if (d.websiteMode === "custom" && !d.website) {
      ctx.addIssue({ code: "custom", path: ["website"], message: "Add your site, or use the Mosaiq page" });
    }
    if (d.mode === "import") {
      const chain = getChain(d.chain)!;
      if (!d.address) {
        ctx.addIssue({ code: "custom", path: ["address"], message: "Paste the token's contract address" });
      } else if (!isValidAddress(chain.addressKind, d.address)) {
        ctx.addIssue({
          code: "custom",
          path: ["address"],
          message: chain.addressKind === "evm" ? "Expected 0x followed by 40 hex characters" : "That is not a Solana address",
        });
      }
    }
  });

export type DraftInput = z.input<typeof draftInputSchema>;
export type DraftData = z.output<typeof draftInputSchema>;

export const agentInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(40, "40 characters at most")
    .regex(/^[\p{L}\p{N} ._-]+$/u, "Letters, numbers, spaces, . _ and - only"),
});

/** Flatten zod issues into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
