/**
 * The Stepit mark: three pairs of rising bars, like steps climbing to a peak.
 * Drawn in a 392 x 263 box; corners are rounded with a matching stroke.
 */
export const MARK_PATH = "M108.0 6.0L177.5 42.1L177.5 84.7L108.0 47.4ZM284.0 6.0L214.5 42.1L214.5 84.7L284.0 47.4ZM59.0 69.0L177.5 127.1L177.5 169.7L59.0 110.4ZM333.0 69.0L214.5 127.1L214.5 169.7L333.0 110.4ZM6.0 132.0L177.5 214.0L177.5 256.6L6.0 173.4ZM386.0 132.0L214.5 214.0L214.5 256.6L386.0 173.4Z";
export const MARK_W = 392;
export const MARK_H = 263;
/** Stroke width (in mark units) that rounds the bar corners. */
export const MARK_ROUND = 12;

/** The app tile (dark square, lime mark) as a standalone SVG string: favicon, link previews. */
export function markTileSvg(size = 32): string {
  const k = 24 / MARK_W; // the mark spans 24 of the tile's 32 units
  const tx = 4;
  const ty = 16 - (MARK_H * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8ff9c"/><stop offset="1" stop-color="#b2f047"/></linearGradient></defs><rect x=".5" y=".5" width="31" height="31" rx="9.5" fill="#071d14" stroke="rgba(196,251,109,.35)"/><g transform="translate(${tx} ${ty.toFixed(2)}) scale(${k.toFixed(5)})"><path d="${MARK_PATH}" fill="url(#g)" stroke="url(#g)" stroke-width="${MARK_ROUND}" stroke-linejoin="round"/></g></svg>`;
}
