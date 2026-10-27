import { describe, it, expect } from 'vitest';
import { rollingReset, dailyReset, weeklyReset } from '../packages/cli/src/core/windows.js';
import { dualEta, dailyBudget, estimate } from '../packages/cli/src/core/pacing.js';
import { parseConfig } from '../packages/cli/src/config.js';
describe('UTC windows and boundaries', () => {
  it.each([
    ['2026-10-21T12:34:56Z', '2026-10-21T17:34:56.000Z'],
    ['2026-12-31T23:59:59Z', '2027-01-01T04:59:59.000Z'],
    ['2026-03-08T01:30:00-05:00', '2026-03-08T11:30:00.000Z'],
  ])('anchors five hours to first use %s', (start, end) => expect(rollingReset(new Date(start))).toBe(end));
  it.each([
    ['2024-02-28T23:59:59Z', '2024-02-29T00:00:00.000Z'],
    ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00.000Z'],
    ['2026-10-21T00:00:00Z', '2026-10-22T00:00:00.000Z'],
  ])('daily UTC boundary %s', (start, end) => expect(dailyReset(new Date(start))).toBe(end));
  it('advances at exact weekly reset from explicit anchor', () => expect(weeklyReset(new Date('2026-10-01T12:00Z'), new Date('2026-10-08T12:00Z'))).toBe('2026-10-15T12:00:00.000Z'));
  it('rejects invalid dates and future weekly anchors', () => {
    expect(() => dailyReset(new Date('bad'))).toThrow();
    expect(() => rollingReset(new Date(), -1)).toThrow();
    expect(() => weeklyReset(new Date(10), new Date(0))).toThrow();
  });
});
describe('transparent pacing', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const samples = [{ at: '2026-10-14T12:00:00Z', used: 0, period: 'a' }, { at: '2026-10-21T06:00:00Z', used: 40, period: 'a' }, { at: now.toISOString(), used: 70, period: 'a' }];
  it('shows both rates and lets the spike drive warning', () => {
    const result = dualEta(samples, 30, now);
    expect(result.average?.burnPerHour).toBeCloseTo(70 / 168);
    expect(result.average?.hoursToExhaustion).toBeCloseTo(72);
    expect(result.recent?.hoursToExhaustion).toBe(6);
    expect(result.driver).toBe('last-6h');
  });
  it('requires coverage, rejects resets, negative deltas and stale endpoints', () => {
    expect(estimate(samples.slice(1), 30, now, 168)).toBeNull();
    expect(estimate(samples.map((s, i) => ({ ...s, period: String(i) })), 30, now, 168)).toBeNull();
    expect(estimate(samples.map(s => ({ ...s, used: 100 - s.used })), 30, now, 168)).toBeNull();
    expect(estimate(samples.slice(0, 2), 30, now, 168)).toBeNull();
  });
  it('zero burn has no finite exhaustion prediction', () => expect(estimate(samples.map(s => ({ ...s, used: 0 })), 30, now, 168)?.hoursToExhaustion).toBeNull());
  it('distinguishes full-quota reference from remaining allowance', () => {
    expect(dailyBudget(30, '2026-10-24T12:00:00Z', now, 15)).toEqual({ daysUntilReset: 3, fullQuotaReferencePerDay: 100 / 3, remainingBudgetPerDay: 10, overPacePct: 50 });
    expect(dailyBudget(30, now.toISOString(), now, 1)).toBeNull();
  });
});
describe('config', () => {
  it('zero setup defaults', () => expect(parseConfig('').intervalSeconds).toBe(300));
  it('keeps predictive notifications opt-in with bounded lead time',()=>{expect(parseConfig('').predictiveAlerts).toEqual({enabled:false,leadTimeHours:24});expect(parseConfig('predictiveAlerts:\n  enabled: true\n  leadTimeHours: 12').predictiveAlerts.enabled).toBe(true);});
  it.each(['timeoutMs: -1', 'thresholds: [70, 70]', 'providers:\n  codex:\n    source: file', 'secret: x', 'channels:\n  - type: webhook\n    urlEnv: https://secret', 'a: ['])('rejects invalid config without echoing content', text => expect(() => parseConfig(text)).toThrow('Invalid config:'));
});
