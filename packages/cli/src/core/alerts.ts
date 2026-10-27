import type { Metric } from './probe.js';
import type { Sample, Store } from './store.js';
import { paceView } from './pacing-history.js';

export type PredictiveAlertOptions = { enabled: boolean; leadTimeHours: number };

export function crossingThresholds(previous: Sample | undefined, current: Sample, thresholds: readonly number[], maxGapMs: number): number[] {
  if (!previous) { const critical=Math.max(...thresholds); return Number.isFinite(critical)&&current.usedPct>=critical&&current.usedPct<=100?[critical]:[]; }
  if (previous.state !== 'ok' || previous.periodEpoch !== current.periodEpoch) return [];
  const gap = Date.parse(current.observedAt) - Date.parse(previous.observedAt);
  if (!Number.isFinite(gap) || gap <= 0 || gap > maxGapMs) return [];
  if (current.usedPct < previous.usedPct || current.usedPct > 100 || current.usedPct < 0) return [];
  return thresholds.filter(t => previous.usedPct < t && current.usedPct >= t);
}
function recordPrediction(store:Store,current:Sample,maxGapMs:number,options:PredictiveAlertOptions):number{
  if(!options.enabled)return 0;
  const now=new Date(current.observedAt);
  if(!Number.isFinite(now.getTime()))return 0;
  const since=new Date(now.getTime()-168*3600000).toISOString();
  const history=store.historySince(since,current.provider,100000).filter(sample=>sample.bucket===current.bucket&&sample.window===current.window&&sample.scope===current.scope&&sample.state==='ok');
  const pace=paceView(history,now,maxGapMs/2);
  const estimate=pace.driver==='last-6h'?pace.lastSixHours:pace.driver==='7-day'?pace.sevenDay:null;
  const etaHours=estimate?.etaHours;
  if(etaHours===null||etaHours===undefined||!Number.isFinite(etaHours)||etaHours<0||etaHours>options.leadTimeHours)return 0;
  if(current.resetsAt&&now.getTime()+etaHours*3600000>=Date.parse(current.resetsAt))return 0;
  const window=`${current.bucket}:${current.window}`;
  const dedupeKey=`${current.provider}|${window}|predictive|${options.leadTimeHours}|${current.periodEpoch}`;
  const detail=JSON.stringify({etaHours:Number(etaHours.toFixed(2)),driver:pace.driver,leadTimeHours:options.leadTimeHours});
  return store.insertAlert({dedupeKey,provider:current.provider,window,threshold:current.usedPct,periodEpoch:current.periodEpoch,kind:'predictive',detail})?1:0;
}

export function recordMetric(store: Store, metric: Metric, thresholds: readonly number[], maxGapMs: number, predictive:PredictiveAlertOptions={enabled:false,leadTimeHours:24}): number {
  return store.transaction(() => {
    const previous = store.latestSample(metric.provider, metric.bucket, metric.window, metric.scope);
    store.insertSample(metric);
    const current = store.latestSample(metric.provider, metric.bucket, metric.window, metric.scope)!;
    let created = 0;
    for (const threshold of crossingThresholds(previous, current, thresholds, maxGapMs)) {
      const window = `${metric.bucket}:${metric.window}`;
      const dedupeKey = `${metric.provider}|${window}|${threshold}|${current.periodEpoch}`;
      if (store.insertAlert({ dedupeKey, provider: metric.provider, window, threshold, periodEpoch: current.periodEpoch, kind:'threshold' })) created++;
    }
    created+=recordPrediction(store,current,maxGapMs,predictive);
    return created;
  });
}
