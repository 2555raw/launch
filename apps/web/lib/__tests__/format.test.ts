import { describe, expect, it } from 'vitest';
import { compact, fmt, fmtUsd, shortAddr, timeLeft } from '@/components/ui/primitives';

describe('web formatting helpers', () => {
  it('never invents numbers for missing data', () => {
    expect(fmt(null)).toBe('Data unavailable');
    expect(fmtUsd(undefined)).toBe('Data unavailable');
    expect(compact(null)).toBe('—');
  });
  it('formats values', () => {
    expect(fmtUsd(0.000123)).toBe('$0.000123');
    expect(fmtUsd(1234.5)).toBe('$1,234.5');
    expect(compact(1_500_000)).toBe('1.5M');
    expect(shortAddr('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe('EPjF…Dt1v');
  });
  it('counts down timers', () => {
    const now = Date.UTC(2026, 0, 1);
    expect(timeLeft(new Date(now + 5000).toISOString(), now)).toBe('5s');
    expect(timeLeft(new Date(now + 90_000).toISOString(), now)).toBe('1m 30s');
    expect(timeLeft(new Date(now - 1).toISOString(), now)).toBe('done');
    expect(timeLeft(null, now)).toBe('');
  });
});
