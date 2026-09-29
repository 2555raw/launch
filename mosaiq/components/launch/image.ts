import { MAX_IMAGE_DATA_URL } from "@/lib/schemas";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Validate an uploaded token image and shrink it to a square-ish ≤512px WebP
 * data URL, so drafts stay small and pages load fast.
 */
export async function prepareImage(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Use a PNG, JPG, WebP or GIF.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Images up to 5 MB.");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file could not be read as an image.");
  });
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const quality of [0.86, 0.72, 0.56, 0.4]) {
    let url = canvas.toDataURL("image/webp", quality);
    // Safari before 14 cannot encode WebP and silently returns PNG.
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_IMAGE_DATA_URL) return url;
  }
  throw new Error("That image is too detailed to compress. Try a simpler one.");
}
