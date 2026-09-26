import type { CoinMeta } from '../backend/types';

export const MAX_META_BYTES = 16_384;

export function parseMeta(raw: string): CoinMeta {
  try {
    const j = JSON.parse(raw || '{}');
    const links = typeof j.links === 'object' && j.links ? j.links : {};
    return {
      description: typeof j.description === 'string' ? j.description.slice(0, 600) : '',
      image: typeof j.image === 'string' && /^(data:image\/(png|jpeg|webp|gif);base64,|https:\/\/|ipfs:\/\/)/.test(j.image) ? j.image : '',
      links: {
        website: safeUrl(links.website),
        x: safeUrl(links.x),
        telegram: safeUrl(links.telegram),
      },
    };
  } catch {
    return { description: '', image: '', links: {} };
  }
}

function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function imageSrc(image: string): string {
  if (image.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${image.slice(7)}`;
  return image;
}

/** Shrinks a picked image to a small square WebP so it fits in the launch transaction. */
export async function shrinkImage(file: File, size = 160, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file is not an image the browser can read.'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    let q = quality;
    let out = canvas.toDataURL('image/webp', q);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', q);
    while (out.length > 11_000 && q > 0.3) {
      q -= 0.1;
      out = canvas.toDataURL(out.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg', q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
