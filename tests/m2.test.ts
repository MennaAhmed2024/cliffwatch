import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../packages/cli/src/core/store.js';
import { recordMetric } from '../packages/cli/src/core/alerts.js';
import { paceView } from '../packages/cli/src/core/pacing-history.js';
import { deliverDueAlerts } from '../packages/cli/src/core/notify.js';
import { parseConfig } from '../packages/cli/src/config.js';
import { pollOnce, runDaemon } from '../packages/cli/src/daemon.js';
import type { Metric } from '../packages/cli/src/core/probe.js';

async function withStore(fn: (store: SqliteStore, path: string) => Promise<void> | void) {
  const dir = await mkdtemp(join(tmpdir(),'cliffwatch-m2-')), path = join(dir,'quota.sqlite');
  let store: SqliteStore | undefined;
  try { store = new SqliteStore(path); await fn(store,path); }
  finally { store?.close(); await rm(dir,{recursive:true,force:true}); }
}
function metric(pct: number, at: Date, reset: Date, bucket = 'codex'): Metric {
  return {provider:'codex',bucket,window:'5h',scope:'account',usedPct:pct,resetsAt:reset.toISOString(),observedAt:at.toISOString(),sourceObservedAt:at.toISOString()};
}
describe('durable crossing alerts', () => {
  it('first trusted critical sample emits once and remains deduplicated',()=>withStore(store=>{const t=new Date(),reset=new Date(t.getTime()+3600000);recordMetric(store,metric(96,t,reset),[70,85,95],600000);recordMetric(store,metric(97,new Date(t.getTime()+1000),reset),[70,85,95],600000);expect(store.alertHistory()).toHaveLength(1);expect(store.alertHistory()[0]?.threshold).toBe(95);}));
  it('two polls above 70 produce exactly one durable alert, including after reopen', async () => withStore(async (store,path) => {
    const t = new Date(), reset = new Date(t.getTime()+2*3600000);
    recordMetric(store,metric(60,t,reset),[70,85,95],600000);
    recordMetric(store,metric(75,new Date(t.getTime()+1000),reset),[70,85,95],600000);
    recordMetric(store,metric(80,new Date(t.getTime()+2000),reset),[70,85,95],600000);
    expect(store.alertHistory()).toHaveLength(1);
    expect(store.alertHistory()[0]?.dedupeKey).toBe(`codex|codex:5h|70|${Math.floor(reset.getTime()/1000)}`);
    const reopened = new SqliteStore(path);
    try {
      recordMetric(reopened,metric(81,new Date(t.getTime()+3000),reset),[70,85,95],600000);
      expect(reopened.alertHistory()).toHaveLength(1);
      expect(reopened.latestSamples()[0]?.usedPct).toBe(81);
    } finally { reopened.close(); }
  }));
  it('fresh period permits new threshold event; stale gaps and decreases do not', () => withStore(store => {
    const t = new Date(), r1 = new Date(t.getTime()+3600000), r2 = new Date(t.getTime()+6*3600000);
    for (const [pct,ms,r] of [[69,0,r1],[75,1000,r1],[69,2000,r2],[75,3000,r2],[96,4000,r2],[50,5000,r2],[75,4000000,r2]] as const) recordMetric(store,metric(pct,new Date(t.getTime()+ms),r),[70,85,95],600000);
    expect(store.alertHistory().map(a=>a.threshold).sort()).toEqual([70,70,85,95]);
  }));
  it('multiple metric buckets cannot collide in dedupe key', () => withStore(store => {
    const t = new Date(), r = new Date(t.getTime()+3600000);
    for (const b of ['a','b']) { recordMetric(store,metric(60,t,r,b),[70],600000); recordMetric(store,metric(75,new Date(t.getTime()+1000),r,b),[70],600000); }
    expect(store.alertHistory()).toHaveLength(2);
  }));
  it('credit topup starts a new non-resetting period', () => withStore(store => {
    const t = new Date();
    const credit = (pct:number,limit:number,offset:number):Metric => ({provider:'openrouter',bucket:'key',window:'credit',scope:'key credit only',usedPct:pct,usedAbsolute:pct*limit/100,limitAbsolute:limit,observedAt:new Date(t.getTime()+offset).toISOString(),sourceObservedAt:new Date(t.getTime()+offset).toISOString()});
    recordMetric(store,credit(60,100,0),[70],600000); recordMetric(store,credit(75,100,1000),[70],600000);
    recordMetric(store,credit(60,200,2000),[70],600000); recordMetric(store,credit(75,200,3000),[70],600000);
    expect(store.alertHistory()).toHaveLength(2);
  }));
  it('credit refill with unchanged limit also starts a new period', () => withStore(store => {
    const t = new Date();
    const credit = (pct:number,offset:number):Metric => ({provider:'openrouter',bucket:'key',window:'credit',scope:'key credit only',usedPct:pct,usedAbsolute:pct,limitAbsolute:100,observedAt:new Date(t.getTime()+offset).toISOString(),sourceObservedAt:new Date(t.getTime()+offset).toISOString()});
    for (const [pct,offset] of [[60,0],[75,1000],[40,2000],[75,3000]] as [number,number][]) recordMetric(store,credit(pct,offset),[70],600000);
    expect(store.alertHistory()).toHaveLength(2);
  }));
});
describe('delivery outbox', () => {
  it('claims prevent concurrent send; failed channel retries then uses fallback', async () => withStore(async store => {
    const t = new Date(), reset = new Date(t.getTime()+3600000);
    recordMetric(store,metric(60,t,reset),[70],600000); recordMetric(store,metric(75,new Date(t.getTime()+1000),reset),[70],600000);
    const cfg = parseConfig('channels:\n  - type: webhook\n    urlEnv: FIRST_URL\n  - type: webhook\n    urlEnv: SECOND_URL');
    process.env.FIRST_URL='https://example.test/first'; process.env.SECOND_URL='https://example.test/second';
    const calls:string[]=[];
    const request:typeof fetch = async input => { calls.push(String(input)); return String(input).endsWith('/first') ? new Response('',{status:500}) : new Response(null,{status:204}); };
    try {
      await deliverDueAlerts(store,cfg,new Date(t.getTime()+10000),request,()=>{});
      expect(store.pendingAlerts(new Date(t.getTime()+10000))).toHaveLength(0);
      await deliverDueAlerts(store,cfg,new Date(t.getTime()+45000),request,()=>{});
      await deliverDueAlerts(store,cfg,new Date(t.getTime()+110000),request,()=>{});
      expect(calls).toEqual(['https://example.test/first','https://example.test/first','https://example.test/second']);
      expect(store.alertHistory()[0]?.state).toBe('delivered');
      await deliverDueAlerts(store,cfg,new Date(t.getTime()+200000),request,()=>{});
      expect(calls).toHaveLength(3);
    } finally { delete process.env.FIRST_URL; delete process.env.SECOND_URL; }
  }));
});
describe('daemon and historical pacing', () => {
  it('per-provider isolation records unknown health and healthy samples', async () => withStore(async store => {
    const t = new Date(), reset = new Date(t.getTime()+3600000), cfg = parseConfig('providers:\n  openrouter:\n    enabled: true\nchannels: []');
    await pollOnce(cfg,store,t,async name => name === 'codex' ? {provider:name,result:{state:'ok',metrics:[metric(30,t,reset)]}} : {provider:name,result:{state:'unknown',reason:'401',metrics:[]}},new Map(),()=>{});
    expect(store.latestSamples()).toHaveLength(1);
    expect(store.latestHealth()).toMatchObject([{provider:'codex',state:'ok'},{provider:'openrouter',state:'unknown',reason:'401'}]);
    expect(store.getHeartbeat()).toBeTruthy();
  }));
  it('warns after a silent heartbeat on restart', async () => withStore(async (store,path) => {
    store.setHeartbeat('2020-01-01T00:00:00.000Z');
    const cfg = parseConfig(JSON.stringify({dataFile:path,providers:{codex:{enabled:false},openrouter:{enabled:false}}}));
    const logs:string[]=[]; await runDaemon(cfg,true,undefined,s=>logs.push(s));
    expect(logs.some(s=>s.includes('older than two intervals'))).toBe(true);
  }));
  it('spike ETA drives when coverage is sufficient', async () => withStore(store => {
    const now = new Date('2026-10-21T12:00:00Z'), reset = new Date('2026-10-22T12:00:00Z');
    for(let i=0;i<=168*6;i++) {
      const at = new Date(now.getTime()-(168*6-i)*600000);
      const used = i<=162*6 ? i*40/(162*6) : 40+(i-162*6)*30/(6*6);
      store.insertSample(metric(used,at,reset));
    }
    const view = paceView(store.history('codex',2000).reverse(),now,600000);
    expect(view.sevenDay?.burnPerHour).toBeCloseTo(70/168);
    expect(view.lastSixHours?.burnPerHour).toBeCloseTo(5);
    expect(view.driver).toBe('last-6h');
  }));
});
