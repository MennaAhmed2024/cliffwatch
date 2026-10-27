import 'server-only';
import { loadConfig, type Config } from 'cliffwatch/config';
import { openExistingStore } from 'cliffwatch/daemon';
import { paceView, type PaceView } from 'cliffwatch/pacing-history';
import type { Alert, ProbeHealth, Sample, Store } from 'cliffwatch/store';
import { currentSnapshotReason, isStaleAge, sampleAge } from './freshness';

export type Card = {
  key: string; provider: string; bucket: string; window: string; scope: string;
  state: 'ok' | 'warn' | 'critical' | 'unknown'; reason?: string; stale?: boolean; ageMs?: number;
  usedPct?: number; remainingPct?: number; usedAbsolute?: number; limitAbsolute?: number;
  observedAt?: string; resetsAt?: string; pace?: PaceView;
};
export type Overview = { cards: Card[]; globalState: Card['state']; lastProbeAt?: string; heartbeat?: string; error?: string; thresholds: number[] };
export type History = { series: { key: string; provider: string; bucket: string; window: string; scope: string; points: { at: string; usedPct: number }[] }[]; alerts: Alert[]; error?: string };
export type SafeSettings = { intervalSeconds: number; timeoutMs: number; thresholds: number[]; providers: { name: string; enabled: boolean; detail: string }[]; channels: { type: string; envNames: string[] }[]; error?: string };

const providerNames = ['codex', 'openrouter'] as const;
const validTime = (value: string | undefined): number => value ? Date.parse(value) : NaN;

function withStore<T>(config: Config, fallback: T, read: (store: Store) => T): T {
  const store = openExistingStore(config);
  if (!store) return fallback;
  try { return read(store); }
  finally { store.close(); }
}

function classify(sample: Sample, config: Config): Card['state'] {
  const critical = config.thresholds.at(-1) ?? 95;
  const warning = config.thresholds.at(-2) ?? 70;
  return sample.usedPct >= critical ? 'critical' : sample.usedPct >= warning ? 'warn' : 'ok';
}

function sampleCard(sample: Sample, health: ProbeHealth | undefined, config: Config, now: Date, store: Store): Card {
  const base: Card = { key: `${sample.provider}|${sample.bucket}|${sample.window}|${sample.scope}`, provider: sample.provider, bucket: sample.bucket, window: sample.window, scope: sample.scope, state: 'unknown' };
  const ageMs = sampleAge(sample.observedAt, now.getTime());
  const stale = isStaleAge(ageMs, config.intervalSeconds);
  const reason=currentSnapshotReason({sampleObservedAt:sample.observedAt,sourceObservedAt:sample.sourceObservedAt,healthObservedAt:health?.observedAt,healthState:health?.state,healthReason:health?.reason,resetsAt:sample.resetsAt,usedPct:sample.usedPct,intervalSeconds:config.intervalSeconds,nowMs:now.getTime()});
  if (reason) return { ...base, reason, stale, ageMs, observedAt: sample.observedAt, usedPct:sample.usedPct, remainingPct:Number.isFinite(sample.usedPct)?100-sample.usedPct:undefined, resetsAt:sample.resetsAt };
  const history = store.history(sample.provider, 10000).filter(s => s.bucket === sample.bucket && s.window === sample.window && s.scope === sample.scope && s.state === 'ok');
  const pace = paceView(history.reverse(), now, config.intervalSeconds * 1000);
  return { ...base, state: classify(sample, config), stale, ageMs, usedPct: sample.usedPct, remainingPct: 100 - sample.usedPct, usedAbsolute: sample.usedAbsolute, limitAbsolute: sample.limitAbsolute, observedAt: sample.observedAt, resetsAt: sample.resetsAt, pace };
}

export async function getOverview(now = new Date()): Promise<Overview> {
  try {
    const config = await loadConfig(process.env.CLIFFWATCH_CONFIG_PATH);
    const enabled = providerNames.filter(name => config.providers[name].enabled);
    const empty = (reason: string): Overview => ({ cards: enabled.map(provider => ({ key: provider, provider, bucket: '—', window: '—', scope: '—', state: 'unknown', reason })), globalState: 'unknown', thresholds: config.thresholds, error: reason });
    return withStore(config, empty('No local samples yet. Run `cliffwatch daemon`.'), store => {
      const health = new Map(store.latestHealth().map(item => [item.provider, item]));
      const samples = store.latestSamples().filter(item => enabled.includes(item.provider as typeof enabled[number]));
      const cards = samples.map(sample => sampleCard(sample, health.get(sample.provider), config, now, store));
      for (const provider of enabled) {
        if (!samples.some(sample => sample.provider === provider)) cards.push({ key: provider, provider, bucket: '—', window: '—', scope: '—', state: 'unknown', reason: health.get(provider)?.reason ?? 'No sample yet. Run `cliffwatch daemon`.' });
      }
      const rank = { ok: 0, warn: 1, critical: 2, unknown: 3 };
      const globalState = cards.length ? cards.reduce<Card['state']>((state, card) => rank[card.state] > rank[state] ? card.state : state, 'ok') : 'unknown';
      const lastProbeAt = [...health.values()].map(item => item.observedAt).filter(item => Number.isFinite(validTime(item))).sort().at(-1);
      return { cards, globalState, lastProbeAt, heartbeat: store.getHeartbeat(), thresholds: config.thresholds };
    });
  } catch { const error = 'Cannot read local configuration or quota database.'; return { cards: [{ key: 'store-error', provider: 'CliffWatch', bucket: '—', window: '—', scope: '—', state: 'unknown', reason: error }], globalState: 'unknown', thresholds: [], error }; }
}

export async function getHistory(now = new Date()): Promise<History> {
  try {
    const config = await loadConfig(process.env.CLIFFWATCH_CONFIG_PATH);
    return withStore(config, { series: [], alerts: [] }, store => {
      const since = now.getTime() - 7 * 86400000;
      const groups = new Map<string, History['series'][number]>();
      for (const sample of store.history(undefined, 10000).reverse()) {
        const observed = validTime(sample.observedAt);
        if (sample.state !== 'ok' || !Number.isFinite(observed) || observed < since || observed > now.getTime() || !Number.isFinite(sample.usedPct)) continue;
        const key = `${sample.provider}|${sample.bucket}|${sample.window}|${sample.scope}`;
        let item = groups.get(key);
        if (!item) { item = { key, provider: sample.provider, bucket: sample.bucket, window: sample.window, scope: sample.scope, points: [] }; groups.set(key, item); }
        item.points.push({ at: sample.observedAt, usedPct: sample.usedPct });
      }
      return { series: [...groups.values()], alerts: store.alertHistory(100) };
    });
  } catch { return { series: [], alerts: [], error: 'Cannot read local history database.' }; }
}

export async function getSafeSettings(): Promise<SafeSettings> {
  try {
    const config = await loadConfig(process.env.CLIFFWATCH_CONFIG_PATH);
    return { intervalSeconds: config.intervalSeconds, timeoutMs: config.timeoutMs, thresholds: config.thresholds,
      providers: [
        { name: 'Codex', enabled: config.providers.codex.enabled, detail: `Source: ${config.providers.codex.source}` },
        { name: 'OpenRouter (experimental)', enabled: config.providers.openrouter.enabled, detail: `Key environment variable: ${config.providers.openrouter.keyEnv}; scope: ${config.providers.openrouter.scope}` },
      ],
      channels: config.channels.map(channel => ({ type: channel.type, envNames: channel.type === 'telegram' ? [channel.botTokenEnv, channel.chatIdEnv] : channel.type === 'desktop' ? [] : [channel.urlEnv] })) };
  } catch { return { intervalSeconds: 0, timeoutMs: 0, thresholds: [], providers: [], channels: [], error: 'Cannot read local configuration.' }; }
}
