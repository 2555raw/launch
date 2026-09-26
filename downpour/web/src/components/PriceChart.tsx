import { useEffect, useMemo, useRef } from 'react';
import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { Trade } from '../backend/types';
import { priceOf } from '../lib/math';

/** Price after every fill, as an area chart (TradingView's lightweight-charts). */
export function PriceChart({
  trades,
  current,
  decimals,
  color,
  divisor = 1,
  now,
}: {
  trades: Trade[];
  current: number;
  decimals: number;
  color: string;
  /** Divide prices by this (units per USD) to show them in dollars. */
  divisor?: number;
  now: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Area'> | null>(null);

  const data = useMemo(() => {
    const byTime = new Map<number, number>();
    for (const t of trades) byTime.set(t.timestamp, priceOf({ reserveQuote: t.reserveQuote, reserveToken: t.reserveToken }, decimals) / divisor);
    byTime.set(Math.max(Math.floor(now), ...byTime.keys(), 0) + 1, current / divisor);
    return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time: time as UTCTimestamp, value }));
  }, [trades, current, decimals, divisor, now]);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#5b6679', fontFamily: 'Inter Variable, system-ui' },
      grid: { vertLines: { color: 'rgba(15,28,50,0.05)' }, horzLines: { color: 'rgba(15,28,50,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(15,28,50,0.12)' },
      timeScale: { borderColor: 'rgba(15,28,50,0.12)', timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: 'rgba(90,63,209,0.45)' }, horzLine: { color: 'rgba(90,63,209,0.45)' } },
      localization: { priceFormatter: (p: number) => formatTick(p) },
    });
    chart.current = c;
    series.current = c.addSeries(AreaSeries, {
      lineColor: color,
      topColor: hexA(color, 0.35),
      bottomColor: hexA(color, 0.02),
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (p: number) => formatTick(p), minMove: 1e-12 },
    });
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [color]);

  useEffect(() => {
    series.current?.setData(data);
    chart.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={box} className="chart-box" />;
}

function formatTick(p: number) {
  // the bottom of the scale can be a hair off zero; show it as zero
  if (Math.abs(p) < 1e-15) return '0';
  if (p >= 1) return p.toFixed(2);
  const zeros = Math.floor(-Math.log10(p));
  return p.toFixed(Math.min(zeros + 3, 14));
}

function hexA(color: string, a: number) {
  if (color.startsWith('#') && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (color.startsWith('hsl(')) return color.replace(')', ` / ${a})`);
  return color;
}
