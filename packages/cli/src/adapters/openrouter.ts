import { z } from 'zod';
import { unknown, type ProbeResult } from '../core/probe.js';
import { boundedJson } from '../core/http.js';
export function parseOpenRouter(raw: unknown, scope: 'key' | 'account', now: Date): ProbeResult {
  try {
    let used: number, limit: number;
    if (scope === 'account') {
      const { data } = z.object({ data: z.object({ total_credits: z.number().positive(), total_usage: z.number().nonnegative() }) }).parse(raw);
      used = data.total_usage; limit = data.total_credits;
    } else {
      const { data } = z.object({ data: z.object({ limit: z.number().positive(), limit_remaining: z.number(), limit_reset: z.string().nullable(), usage: z.number().nonnegative() }) }).parse(raw);
      if (data.limit_reset !== null) return unknown('OpenRouter resetting key budget needs verified window usage/reset data.');
      limit = data.limit; used = limit - data.limit_remaining;
      if (Math.abs(used - data.usage) > 0.000001 * Math.max(1, limit)) return unknown('OpenRouter key usage and remaining budget disagree.');
    }
    if (!Number.isFinite(used) || !Number.isFinite(limit) || used < 0 || used > limit) return unknown('OpenRouter credit values are outside the supported range.');
    return { state: 'ok', metrics: [{ provider: 'openrouter', bucket: scope, scope: `${scope} credit only`, window: 'credit', usedPct: used / limit * 100, usedAbsolute: used, limitAbsolute: limit, observedAt: now.toISOString(), sourceObservedAt: now.toISOString() }] };
  } catch { return unknown('OpenRouter limit missing, unlimited, zero or malformed.'); }
}
export async function probeOpenRouter(key: string | undefined, scope: 'key' | 'account', timeoutMs: number, request: typeof fetch = fetch): Promise<ProbeResult> {
  if (!key) return unknown('OpenRouter key environment variable is missing.');
  try {
    const response = await request(`https://openrouter.ai/api/v1/${scope === 'account' ? 'credits' : 'key'}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); return unknown(`OpenRouter HTTP ${response.status}; check credentials, scope or provider availability.`); }
    return parseOpenRouter(await boundedJson(response), scope, new Date());
  } catch { return unknown('OpenRouter request failed, timed out or returned invalid JSON.'); }
}
