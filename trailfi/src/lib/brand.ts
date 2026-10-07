/**
 * The Strydo mark: four rounded pieces locked around a square opening.
 * Drawn in a 514 x 514 box with its corners already rounded.
 */
export const MARK_PATH = "M144 0L220 0A32 32 0 0 1 252 32L252 138A9 9 0 0 1 243 147L177 147A30 30 0 0 0 147 177L147 243A9 9 0 0 1 138 252L32 252A32 32 0 0 1 0 220L0 142A32 32 0 0 1 32 110L78 110A34 34 0 0 0 112 76L112 32A32 32 0 0 1 144 0ZM514 144L514 220A32 32 0 0 1 482 252L376 252A9 9 0 0 1 367 243L367 177A30 30 0 0 0 337 147L271 147A9 9 0 0 1 262 138L262 32A32 32 0 0 1 294 0L372 0A32 32 0 0 1 404 32L404 78A34 34 0 0 0 438 112L482 112A32 32 0 0 1 514 144ZM370 514L294 514A32 32 0 0 1 262 482L262 376A9 9 0 0 1 271 367L337 367A30 30 0 0 0 367 337L367 271A9 9 0 0 1 376 262L482 262A32 32 0 0 1 514 294L514 372A32 32 0 0 1 482 404L436 404A34 34 0 0 0 402 438L402 482A32 32 0 0 1 370 514ZM0 370L0 294A32 32 0 0 1 32 262L138 262A9 9 0 0 1 147 271L147 337A30 30 0 0 0 177 367L243 367A9 9 0 0 1 252 376L252 482A32 32 0 0 1 220 514L142 514A32 32 0 0 1 110 482L110 436A34 34 0 0 0 76 402L32 402A32 32 0 0 1 0 370Z";
export const MARK_W = 514;
export const MARK_H = 514;
/** Stroke width (in mark units); the new mark has its rounding built in. */
export const MARK_ROUND = 0;

/** The app tile (dark square, lime mark) as a standalone SVG string: favicon, link previews. */
export function markTileSvg(size = 32): string {
  const k = 24 / MARK_W; // the mark spans 24 of the tile's 32 units
  const tx = 4;
  const ty = 16 - (MARK_H * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc2ff"/><stop offset="1" stop-color="#2f7bff"/></linearGradient></defs><rect x=".5" y=".5" width="31" height="31" rx="9.5" fill="#071226" stroke="rgba(77,148,255,.35)"/><g transform="translate(${tx} ${ty.toFixed(2)}) scale(${k.toFixed(5)})"><path d="${MARK_PATH}" fill="url(#g)" stroke="url(#g)" stroke-width="${MARK_ROUND}" stroke-linejoin="round"/></g></svg>`;
}
