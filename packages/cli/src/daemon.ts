import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from './config.js';
import { recordMetric } from './core/alerts.js';
import { deliverDueAlerts } from './core/notify.js';
import { probeProvider, type ProviderResult } from './core/probes.js';
import { freshness, unknown } from './core/probe.js';
import { SqliteStore, type Store } from './core/store.js';

export function storePath(config: Config): string { return config.dataFile ?? join(homedir(), '.quotadog', 'quotadog.sqlite'); }
export function openExistingStore(config: Config): Store | undefined { const path = storePath(config); return existsSync(path) ? new SqliteStore(path) : undefined; }
export type Backoff = Map<string,{failures:number;until:number}>;
export async function pollOnce(config: Config, store: Store, now = new Date(), probe: (provider: 'codex'|'openrouter',config:Config,now:Date)=>Promise<ProviderResult> = probeProvider, backoff: Backoff = new Map(), log: (text:string)=>void = console.error): Promise<ProviderResult[]> {
  const names: ('codex'|'openrouter')[] = [];
  if (config.providers.codex.enabled) names.push('codex');
  if (config.providers.openrouter.enabled) names.push('openrouter');
  const results = await Promise.all(names.map(async name => {
    const b = backoff.get(name);
    if (b && now.getTime()<b.until) return {provider:name,result:unknown(`Backoff after probe failure; retry after ${new Date(b.until).toISOString()}.`)};
    try { return await probe(name,config,now); }
    catch { return {provider:name,result:unknown('Provider probe failed unexpectedly.')}; }
  }));
  for (const entry of results) {
    const observedAt = new Date().toISOString();
    if (entry.result.metrics.some(m => !freshness(m.sourceObservedAt,new Date(),config.intervalSeconds*2000) || (m.resetsAt && Date.parse(m.resetsAt)<=Date.now()))) entry.result = unknown('Provider observation expired during poll.');
    store.putHealth({ provider: entry.provider, state: entry.result.state, reason: entry.result.reason, observedAt });
    if (entry.result.state === 'unknown') {
      if (!entry.result.reason?.startsWith('Backoff')) {
        const failures = (backoff.get(entry.provider)?.failures ?? 0)+1;
        backoff.set(entry.provider,{failures,until:now.getTime()+Math.min(3600000,config.intervalSeconds*1000*2**Math.min(failures,8))});
        log(`QuotaDog ${entry.provider}: UNKNOWN — ${entry.result.reason}`);
      }
      continue;
    }
    backoff.delete(entry.provider);
    try { store.transaction(() => { for (const metric of entry.result.metrics) recordMetric(store,metric,config.thresholds,config.intervalSeconds*2000); }); }
    catch { entry.result = unknown('Cannot persist quota sample.'); store.putHealth({provider:entry.provider,state:'unknown',reason:entry.result.reason,observedAt}); log(`QuotaDog ${entry.provider}: UNKNOWN — cannot persist quota sample.`); }
  }
  try { await deliverDueAlerts(store,config,new Date(),fetch,log); }
  catch { log('QuotaDog: alert outbox processing failed; pending alerts remain for retry.'); }
  store.setHeartbeat(new Date().toISOString());
  return results;
}
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done,ms);
    const onAbort = () => { clearTimeout(timer); done(); };
    function done() { signal.removeEventListener('abort',onAbort); resolve(); }
    signal.addEventListener('abort',onAbort,{once:true});
  });
}
export async function runDaemon(config: Config, once = false, signal?: AbortSignal, log: (text:string)=>void = console.error): Promise<void> {
  const store = new SqliteStore(storePath(config));
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  process.on('SIGINT',abort); process.on('SIGTERM',abort);
  try {
    const heartbeat = store.getHeartbeat();
    if (heartbeat && Date.now()-Date.parse(heartbeat)>config.intervalSeconds*2000) log(`QuotaDog: previous daemon heartbeat is older than two intervals (last ${heartbeat}).`);
    const backoff: Backoff = new Map();
    do {
      if (controller.signal.aborted) break;
      const start = Date.now();
      await pollOnce(config,store,new Date(),probeProvider,backoff,log);
      if (once) break;
      await wait(Math.max(0,config.intervalSeconds*1000-(Date.now()-start)),controller.signal);
    } while (!controller.signal.aborted);
  } finally { signal?.removeEventListener('abort',abort); process.off('SIGINT',abort); process.off('SIGTERM',abort); store.close(); }
}
