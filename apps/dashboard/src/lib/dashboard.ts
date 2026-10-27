import 'server-only';
import { loadConfig, type Config } from 'cliffwatch/config';
import { openExistingStore } from 'cliffwatch/daemon';
import { paceView, type PaceView } from 'cliffwatch/pacing-history';
import type { Alert, ProbeHealth, Sample, Store } from 'cliffwatch/store';
import { currentSnapshotReason, isStaleAge, sampleAge } from './freshness';
import { heartbeatState, type HeartbeatState } from './diagnostics';

export type Card = {
  key: string; provider: string; bucket: string; window: string; scope: string;
  state: 'ok' | 'warn' | 'critical' | 'unknown'; reason?: string; stale?: boolean; ageMs?: number;
  usedPct?: number; remainingPct?: number; usedAbsolute?: number; limitAbsolute?: number;
  observedAt?: string; resetsAt?: string; pace?: PaceView;
};
export type Overview = { cards: Card[]; globalState: Card['state']; lastProbeAt?: string; heartbeat?: string; error?: string; thresholds: number[] };
export type History = { series: { key: string; provider: string; bucket: string; window: string; scope: string; points: { at: string; usedPct: number }[] }[]; alerts: Alert[]; error?: string };
export type SafeSettings = { intervalSeconds: number; timeoutMs: number; thresholds: number[]; providers: { name: string; enabled: boolean; detail: string }[]; channels: { type: string; envNames: string[] }[]; error?: string };
export type Diagnostics={schemaVersion:1;generatedAt:string;runtime:{platform:string;node:string};localOnly:true;config:{readable:boolean;intervalSeconds?:number;retentionDays?:number;enabledProviders:string[];channelTypes:string[]};store:{available:boolean;integrity:'ok'|'failed'|'unavailable';heartbeat?:string;heartbeatState:HeartbeatState;latestMetricCount:number;latestSampleAt?:string;recentAlerts:{pending:number;delivered:number};providerHealth:{provider:string;state:'ok'|'unknown';reason?:string;observedAt:string}[]};errors:string[]};

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
  const since=new Date(now.getTime()-168*3600000).toISOString();
  const history = store.historySince(since,sample.provider,100000).filter(s => s.bucket === sample.bucket && s.window === sample.window && s.scope === sample.scope && s.state === 'ok');
  const pace = paceView(history, now, config.intervalSeconds * 1000);
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
      for (const sample of store.historySince(new Date(since).toISOString(),undefined,100000)) {
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
      channels: config.channels.map((channel:Config['channels'][number]) => ({ type: channel.type, envNames: channel.type === 'telegram' ? [channel.botTokenEnv, channel.chatIdEnv] : channel.type === 'desktop' ? [] : [channel.urlEnv] })) };
  } catch { return { intervalSeconds: 0, timeoutMs: 0, thresholds: [], providers: [], channels: [], error: 'Cannot read local configuration.' }; }
}

export async function getDiagnostics(now=new Date()):Promise<Diagnostics>{
  const base:Diagnostics={schemaVersion:1,generatedAt:now.toISOString(),runtime:{platform:process.platform,node:process.version},localOnly:true,config:{readable:false,enabledProviders:[],channelTypes:[]},store:{available:false,integrity:'unavailable',heartbeatState:'missing',latestMetricCount:0,recentAlerts:{pending:0,delivered:0},providerHealth:[]},errors:[]};
  try{
    const config=await loadConfig(process.env.CLIFFWATCH_CONFIG_PATH);
    base.config={readable:true,intervalSeconds:config.intervalSeconds,retentionDays:config.retentionDays,enabledProviders:providerNames.filter(name=>config.providers[name].enabled),channelTypes:config.channels.map((channel:Config['channels'][number])=>channel.type)};
    return withStore(config,{...base,errors:['Local quota store is not available yet.']},store=>{
      const heartbeat=store.getHeartbeat(),latest=store.latestSamples(),alerts=store.alertHistory(1000),health=store.latestHealth();
      const latestSampleAt=latest.map(sample=>sample.observedAt).filter(value=>Number.isFinite(Date.parse(value))).sort().at(-1);
      const integrity=store.integrityCheck();
      return{...base,store:{available:true,integrity:integrity.ok?'ok':'failed',...(heartbeat?{heartbeat}:{}),heartbeatState:heartbeatState(heartbeat,config.intervalSeconds,now.getTime()),latestMetricCount:latest.length,...(latestSampleAt?{latestSampleAt}:{}),recentAlerts:{pending:alerts.filter(alert=>alert.state==='pending'&&!alert.acknowledgedAt).length,delivered:alerts.filter(alert=>alert.state==='delivered').length},providerHealth:health},errors:integrity.ok?[]:['SQLite integrity check failed.']};
    });
  }catch{return{...base,errors:['Local configuration could not be read.']};}
}
