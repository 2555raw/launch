import "server-only";
import { createHash } from "node:crypto";

export interface PhotoFingerprint {
  /** sha256 of the image bytes: identical files. */
  sha: string;
  /** 48 x 48 greyscale thumbnail: the same picture resized or re-saved. */
  thumb: Buffer;
}

const SIDE = 48;
/** A pixel counts as changed when its grey level moves by more than this. */
const PIXEL_TOLERANCE = 24;
/**
 * Share of changed pixels below which two thumbnails are the same photo.
 * Measured: the same screenshot re-saved or resized changes under 1%; two
 * different health app screenshots with the same layout change about 8%.
 */
export const SAME_PHOTO_MAX_CHANGED = 0.03;

/**
 * Fingerprints a screenshot sent as a data URL. The thumbnail is null if the
 * image can't be decoded: a fingerprint only adds a review flag, it never
 * blocks an upload.
 */
export async function photoFingerprint(dataUrl: string): Promise<{ sha: string; thumb: Buffer | null } | null> {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
  const sha = createHash("sha256").update(bytes).digest("hex");
  try {
    const { default: sharp } = await import("sharp");
    const thumb = await sharp(bytes).greyscale().resize(SIDE, SIDE, { fit: "fill" }).raw().toBuffer();
    return { sha, thumb };
  } catch {
    return { sha, thumb: null };
  }
}

/** Share of pixels (0 to 1) that differ between two thumbnails. */
export function changedShare(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > PIXEL_TOLERANCE) changed++;
  return changed / a.length;
}
