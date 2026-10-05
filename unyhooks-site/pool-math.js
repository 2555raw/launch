/* UnyHooks — Uniswap V4 pool math, in BigInt.

   Ports of TickMath.getSqrtPriceAtTick (v4-core), LiquidityAmounts (v4-periphery)
   and SqrtPriceMath's amount deltas (v4-core), plus the conversions the pages
   need between human prices ("1 TOKEN = 0.001 ETH") and sqrtPriceX96 / ticks.
   No DOM: loads as window.UnyPoolMath in the browser and with require() in Node,
   where scripts/hook-tests checks it against known values and real mints. */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnyPoolMath = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const Q96 = 1n << 96n;
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;
  const MIN_SQRT_PRICE = 4295128739n;
  const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
  const MAX_UINT256 = (1n << 256n) - 1n;

  const divUp = (a, b) => (a + b - 1n) / b;

  // floor(sqrt(n)): Newton's method from a start at or above the root.
  const isqrt = (n) => {
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) {
      const y = (x + n / x) >> 1n;
      if (y >= x) return x;
      x = y;
    }
  };

  // TickMath.getSqrtPriceAtTick, constant for constant.
  const RATIOS = [
    [0x2n, 0xfff97272373d413259a46990580e213an],
    [0x4n, 0xfff2e50f5f656932ef12357cf3c7fdccn],
    [0x8n, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [0x10n, 0xffcb9843d60f6159c9db58835c926644n],
    [0x20n, 0xff973b41fa98c081472e6896dfb254c0n],
    [0x40n, 0xff2ea16466c96a3843ec78b326b52861n],
    [0x80n, 0xfe5dee046a99a2a811c461f1969c3053n],
    [0x100n, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [0x200n, 0xf987a7253ac413176f2b074cf7815e54n],
    [0x400n, 0xf3392b0822b70005940c7a398e4b70f3n],
    [0x800n, 0xe7159475a2c29b7443b29c7fa6e889d9n],
    [0x1000n, 0xd097f3bdfd2022b8845ad8f792aa5825n],
    [0x2000n, 0xa9f746462d870fdf8a65dc1f90e061e5n],
    [0x4000n, 0x70d869a156d2a1b890bb3df62baf32f7n],
    [0x8000n, 0x31be135f97d08fd981231505542fcfa6n],
    [0x10000n, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [0x20000n, 0x5d6af8dedb81196699c329225ee604n],
    [0x40000n, 0x2216e584f5fa1ea926041bedfe98n],
    [0x80000n, 0x48a170391f7dc42444e8fa2n]
  ];
  const sqrtPriceAtTick = (tick) => {
    const t = Number(tick);
    if (!Number.isInteger(t) || t < MIN_TICK || t > MAX_TICK) throw new Error(`tick out of range: ${tick}`);
    const abs = BigInt(Math.abs(t));
    let price = abs & 1n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 1n << 128n;
    for (const [bit, ratio] of RATIOS) if (abs & bit) price = (price * ratio) >> 128n;
    if (t > 0) price = MAX_UINT256 / price;
    return (price + (1n << 32n) - 1n) >> 32n;
  };

  // LiquidityAmounts (v4-periphery), rounding down like the contract.
  const liquidityForAmount0 = (a, b, amount0) => {
    if (a > b) [a, b] = [b, a];
    return (amount0 * ((a * b) / Q96)) / (b - a);
  };
  const liquidityForAmount1 = (a, b, amount1) => {
    if (a > b) [a, b] = [b, a];
    return (amount1 * Q96) / (b - a);
  };
  const liquidityForAmounts = (price, a, b, amount0, amount1) => {
    if (a > b) [a, b] = [b, a];
    if (price <= a) return liquidityForAmount0(a, b, amount0);
    if (price < b) {
      const l0 = liquidityForAmount0(price, b, amount0);
      const l1 = liquidityForAmount1(a, price, amount1);
      return l0 < l1 ? l0 : l1;
    }
    return liquidityForAmount1(a, b, amount1);
  };

  // SqrtPriceMath.getAmount0Delta / getAmount1Delta with rounding up: what a mint pulls.
  const amount0Delta = (a, b, liquidity) => {
    if (a > b) [a, b] = [b, a];
    return divUp(divUp((liquidity << 96n) * (b - a), b), a);
  };
  const amount1Delta = (a, b, liquidity) => {
    if (a > b) [a, b] = [b, a];
    return divUp(liquidity * (b - a), Q96);
  };
  const amountsForLiquidity = (price, a, b, liquidity) => {
    if (a > b) [a, b] = [b, a];
    if (price <= a) return { amount0: amount0Delta(a, b, liquidity), amount1: 0n };
    if (price < b) return { amount0: amount0Delta(price, b, liquidity), amount1: amount1Delta(a, price, liquidity) };
    return { amount0: 0n, amount1: amount1Delta(a, b, liquidity) };
  };

  /* ---------- human prices ---------- */

  // "1.5" -> { num: 15n, den: 10n }, exactly; null for anything that is not a positive number.
  const fraction = (text) => {
    const t = String(text).trim().replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    const [w, f = ''] = t.split('.');
    const num = BigInt((w || '0') + f);
    const den = 10n ** BigInt(f.length);
    return num > 0n ? { num, den } : null;
  };

  // "1 A = p B" -> sqrtPriceX96 of the sorted pair. a and b are { address, decimals }.
  const sqrtPriceFor = (a, b, p) => {
    const aIs0 = BigInt(a.address) < BigInt(b.address);
    const scaleA = 10n ** BigInt(a.decimals);
    const scaleB = 10n ** BigInt(b.decimals);
    const num = aIs0 ? p.num * scaleB : p.den * scaleA;
    const den = aIs0 ? p.den * scaleA : p.num * scaleB;
    return isqrt((num << 192n) / den);
  };

  // sqrtPriceX96 -> how many B one A buys, as a float for display.
  const priceOf = (sqrtPriceX96, a, b) => {
    const aIs0 = BigInt(a.address) < BigInt(b.address);
    const s = Number(sqrtPriceX96) / 2 ** 96;
    const raw1per0 = s * s;                                   // currency1 per currency0, raw units
    const human1per0 = raw1per0 * 10 ** ((aIs0 ? a.decimals : b.decimals) - (aIs0 ? b.decimals : a.decimals));
    return aIs0 ? human1per0 : 1 / human1per0;
  };

  // "1 A = p B" (a float) -> the nearest usable tick for this spacing.
  const tickForPrice = (p, a, b, spacing) => {
    const aIs0 = BigInt(a.address) < BigInt(b.address);
    const human1per0 = aIs0 ? p : 1 / p;
    const raw1per0 = human1per0 * 10 ** ((aIs0 ? b.decimals : a.decimals) - (aIs0 ? a.decimals : b.decimals));
    const tick = Math.log(raw1per0) / Math.log(1.0001);
    const aligned = Math.round(tick / spacing) * spacing;
    return Math.max(minUsableTick(spacing), Math.min(maxUsableTick(spacing), aligned));
  };

  const minUsableTick = (spacing) => Math.ceil(MIN_TICK / spacing) * spacing;
  const maxUsableTick = (spacing) => Math.floor(MAX_TICK / spacing) * spacing;

  // Amounts as text -> raw units, exactly ("0.5", 18) -> 500000000000000000n.
  const toUnits = (text, decimals) => {
    const t = String(text).trim().replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    const [w, f = ''] = t.split('.');
    if (f.length > decimals) return BigInt((w || '0') + f.slice(0, decimals));
    return BigInt((w || '0') + f.padEnd(decimals, '0'));
  };
  const fromUnits = (raw, decimals, maxDecimals = 6) => {
    const s = BigInt(raw).toString().padStart(decimals + 1, '0');
    const whole = s.slice(0, s.length - decimals) || '0';
    let frac = decimals ? s.slice(s.length - decimals) : '';
    frac = frac.slice(0, Math.max(maxDecimals, frac.search(/[1-9]/) + 3)).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole;
  };

  return {
    Q96, MIN_TICK, MAX_TICK, MIN_SQRT_PRICE, MAX_SQRT_PRICE,
    isqrt, sqrtPriceAtTick, liquidityForAmounts, amountsForLiquidity,
    fraction, sqrtPriceFor, priceOf, tickForPrice, minUsableTick, maxUsableTick, toUnits, fromUnits
  };
});
