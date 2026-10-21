import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import { z } from 'zod';
import { freshness, unknown, type Metric, type ProbeResult } from '../core/probe.js';
const win = z.object({ used_percent: z.number().min(0).max(100), window_minutes: z.number().int().positive(), resets_at: z.number().int().positive() });
const limits = z.object({ limit_id: z.string().min(1).max(96).regex(/^[A-Za-z0-9_.:-]+$/), primary: win.nullable(), secondary: win.nullable() });
export function parseLimits(raw: unknown, sourceAt: string, now: Date, maxAge: number): ProbeResult {
  try {
    if (!freshness(sourceAt, now, maxAge)) return unknown('Codex source is stale or has an invalid timestamp.');
    const parsed = z.array(limits).nonempty().parse(raw);
    const metrics: Metric[] = [];
    for (const bucket of parsed) {
      for (const value of [bucket.primary, bucket.secondary]) {
        if (!value) return unknown('Codex quota window is missing.');
        const reset = value.resets_at * 1000;
        if (reset <= now.getTime()) return unknown('Codex reset has passed; a fresh observation is required.');
        if (reset - now.getTime() > value.window_minutes * 60000) return unknown('Codex reset exceeds its reported window duration; timing is suspect.');
        metrics.push({ provider: 'codex', bucket: bucket.limit_id, scope: 'account', window: value.window_minutes === 300 ? '5h' : value.window_minutes === 10080 ? 'weekly' : `${value.window_minutes}m`, usedPct: value.used_percent, resetsAt: new Date(reset).toISOString(), observedAt: now.toISOString(), sourceObservedAt: sourceAt });
      }
    }
    return { state: 'ok', metrics };
  } catch { return unknown('Codex quota format is invalid or unsupported.'); }
}
export function parseSession(text: string, now: Date, maxAge: number): ProbeResult {
  try {
    const rows: unknown[] = text.trimStart().startsWith('[') ? JSON.parse(text) : text.trim().split(/\r?\n/).map(line => JSON.parse(line));
    const events = rows.map(row => z.object({ timestamp: z.string(), type: z.string(), payload: z.object({ type: z.string(), rate_limits: z.unknown().optional() }).passthrough() }).safeParse(row))
      .filter(row => row.success && row.data.type === 'event_msg' && row.data.payload.type === 'token_count');
    const latest = events.at(-1);
    if (!latest?.success) return unknown('No Codex quota event found.');
    return parseLimits([latest.data.payload.rate_limits], latest.data.timestamp, now, maxAge);
  } catch { return unknown('Codex session is malformed or incomplete.'); }
}
export async function probeFile(path: string, now: Date, maxAge: number): Promise<ProbeResult> {
  let file;
  try {
    file = await open(path, 'r');
    const size = (await file.stat()).size;
    if (size > 8 * 1024 * 1024) return unknown('Codex file exceeds the 8 MiB read limit; use live mode.');
    return parseSession(await file.readFile('utf8'), now, maxAge);
  } catch { return unknown('Cannot read Codex source file (missing, locked or inaccessible).'); }
  finally { await file?.close().catch(() => undefined); }
}
export function readLive(command: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['app-server', '-c', 'analytics.enabled=false', '-c', 'otel.exporter="none"', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false });
    let buffer = '', done = false, initialized = false, bytes = 0;
    const finish = (error?: Error, result?: unknown) => {
      if (done) return;
      done = true; clearTimeout(timer); child.stdin.end(); child.kill();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Codex probe timed out.')), timeoutMs);
    child.on('error', () => finish(new Error('Codex executable unavailable; configure an executable path.')));
    child.on('close', () => finish(new Error('Codex app-server closed before returning quota.')));
    child.stdin.on('error', () => finish(new Error('Codex protocol connection failed.')));
    const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + '\n');
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) return finish(new Error('Codex protocol response exceeded size limit.'));
      buffer += chunk.toString('utf8');
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && !initialized) {
            if (msg.error || !msg.result) return finish(new Error('Codex initialization failed.'));
            initialized = true;
            send({ method: 'initialized', params: {} });
            send({ id: 2, method: 'account/rateLimits/read', params: {} });
          } else if (msg.id === 2 && initialized) {
            if (msg.error) finish(new Error('Codex quota read failed; check Codex sign-in.'));
            else finish(undefined, msg.result);
          }
        } catch { finish(new Error('Codex protocol returned invalid JSON.')); }
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'quotadog', title: 'QuotaDog', version: '0.1.0' } } });
  });
}
export function parseLive(raw: unknown, now: Date): ProbeResult {
  try {
    const body = z.object({ rateLimitsByLimitId: z.record(z.unknown()).nullish(), rateLimits: z.unknown().optional() }).parse(raw);
    const buckets = body.rateLimitsByLimitId ? Object.entries(body.rateLimitsByLimitId) : [['codex', body.rateLimits]];
    const normalized = buckets.map(([id, value]) => {
      const bucket = z.object({ limitId: z.string().nullish(), primary: z.unknown(), secondary: z.unknown() }).parse(value);
      const convert = (v: unknown) => {
        if (v === null) return null;
        const w = z.object({ usedPercent: z.number(), windowDurationMins: z.number(), resetsAt: z.number() }).parse(v);
        return { used_percent: w.usedPercent, window_minutes: w.windowDurationMins, resets_at: w.resetsAt };
      };
      return { limit_id: bucket.limitId ?? id, primary: convert(bucket.primary), secondary: convert(bucket.secondary) };
    });
    return parseLimits(normalized, now.toISOString(), now, 0);
  } catch { return unknown('Codex live quota format is invalid or unavailable.'); }
}
export async function probeLive(command: string, timeoutMs: number): Promise<ProbeResult> {
  try { return parseLive(await readLive(command, timeoutMs), new Date()); }
  catch (error) { return unknown(error instanceof Error ? error.message : 'Codex probe failed.'); }
}
