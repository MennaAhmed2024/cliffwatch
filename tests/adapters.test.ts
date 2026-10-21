import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { parseSession, parseLive, probeFile, probeLive } from '../packages/cli/src/adapters/codex.js';
import { parseOpenRouter, probeOpenRouter } from '../packages/cli/src/adapters/openrouter.js';
const fixture = await readFile(new URL('../packages/cli/src/fixtures/codex-real-sanitized.json', import.meta.url), 'utf8');
describe('real Codex fixture contract', () => {
  const now = new Date('2026-10-16T12:39:03Z');
  it('preserves provider percentages and reset epochs', () => {
    const result = parseSession(fixture, now, 600000);
    expect(result.state).toBe('ok'); expect(result.metrics.map(m => m.usedPct)).toEqual([41, 22]);
    expect(result.metrics[0]?.resetsAt).toBe(new Date(1792171408 * 1000).toISOString());
  });
  it('old source cannot become fresh by rereading', () => expect(parseSession(fixture, new Date('2026-10-21T12:00Z'), 600000).state).toBe('unknown'));
  it('future source is unknown', () => expect(parseSession(fixture, new Date('2020-01-01'), 600000).state).toBe('unknown'));
  it('real live capture with inconsistent reset timing fails closed', async () => {
    const capture = JSON.parse(await readFile(new URL('../packages/cli/src/fixtures/codex-live-real-sanitized.json', import.meta.url), 'utf8'));
    expect(parseLive(capture.result, new Date(capture.capturedAt))).toMatchObject({ state: 'unknown', reason: expect.stringContaining('duration'), metrics: [] });
  });
  it.each(['garbled', '{}', '[]', fixture.replace('41.0', '141.0'), fixture.replace('41.0', 'null')])('bad data is unknown with no metrics', text => expect(parseSession(text, now, 600000)).toMatchObject({ state: 'unknown', metrics: [] }));
  it('latest null quota does not reuse earlier healthy quota', () => {
    const rows = JSON.parse(fixture); rows.at(-1).payload.rate_limits = null;
    expect(parseSession(JSON.stringify(rows), now, 600000).state).toBe('unknown');
  });
  it('missing file / executable stay isolated', async () => {
    expect((await probeFile('does-not-exist', now, 1)).state).toBe('unknown');
    expect((await probeLive('quotadog-nonexistent-executable', 100)).state).toBe('unknown');
  });
  it('live protocol handles multiple buckets; synthetic fixture explicitly constructed', () => {
    const bucket = { primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: now.getTime() / 1000 + 100 }, secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: now.getTime() / 1000 + 200 } };
    const result = parseLive({ rateLimitsByLimitId: { a: bucket, b: bucket } }, now);
    expect(result.metrics.map(m => m.bucket)).toEqual(['a', 'a', 'b', 'b']);
    expect(parseLive({ rateLimitsByLimitId: {} }, now).state).toBe('unknown');
  });
});
describe('OpenRouter contracts', () => {
  const now = new Date('2026-10-21T12:00Z');
  it('real unauthenticated fixture maps to unknown', async () => {
    const fixture = JSON.parse(await readFile(new URL('../packages/cli/src/fixtures/openrouter-real-401.json', import.meta.url), 'utf8'));
    const request: typeof fetch = async () => new Response(JSON.stringify(fixture.body), { status: fixture.status });
    expect((await probeOpenRouter('test-secret', 'account', 1000, request)).state).toBe('unknown');
  });
  it('synthetic account success is scoped, not a daily quota', () => {
    const result = parseOpenRouter({ data: { total_credits: 100, total_usage: 25 } }, 'account', now);
    expect(result.metrics[0]).toMatchObject({ usedPct: 25, window: 'credit', scope: 'account credit only' });
    expect(result.metrics[0]?.resetsAt).toBeUndefined();
  });
  it('synthetic key success and unsupported resetting budgets', () => {
    const data = { limit: 100, limit_remaining: 70, usage: 30, limit_reset: null };
    expect(parseOpenRouter({ data }, 'key', now).metrics[0]?.usedPct).toBe(30);
    expect(parseOpenRouter({ data: { ...data, limit_reset: 'daily' } }, 'key', now).state).toBe('unknown');
  });
  it.each([null, {}, { data: { total_credits: 0, total_usage: 0 } }, { data: { total_credits: 10, total_usage: 11 } }])('invalid limits remain unknown', raw => expect(parseOpenRouter(raw, 'account', now).state).toBe('unknown'));
  it('missing key does not call network; network errors do not expose secrets', async () => {
    let called = false;
    const request: typeof fetch = async () => { called = true; throw new Error('secret'); };
    expect((await probeOpenRouter(undefined, 'key', 100, request)).state).toBe('unknown'); expect(called).toBe(false);
    expect(JSON.stringify(await probeOpenRouter('secret', 'key', 100, request))).not.toContain('secret');
  });
});
