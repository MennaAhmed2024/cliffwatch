import type { Metric } from './probe.js';
import type { Sample, Store } from './store.js';

export function crossingThresholds(previous: Sample | undefined, current: Sample, thresholds: readonly number[], maxGapMs: number): number[] {
  if (!previous) { const critical=Math.max(...thresholds); return Number.isFinite(critical)&&current.usedPct>=critical&&current.usedPct<=100?[critical]:[]; }
  if (previous.state !== 'ok' || previous.periodEpoch !== current.periodEpoch) return [];
  const gap = Date.parse(current.observedAt) - Date.parse(previous.observedAt);
  if (!Number.isFinite(gap) || gap <= 0 || gap > maxGapMs) return [];
  if (current.usedPct < previous.usedPct || current.usedPct > 100 || current.usedPct < 0) return [];
  return thresholds.filter(t => previous.usedPct < t && current.usedPct >= t);
}
export function recordMetric(store: Store, metric: Metric, thresholds: readonly number[], maxGapMs: number): number {
  return store.transaction(() => {
    const previous = store.latestSample(metric.provider, metric.bucket, metric.window, metric.scope);
    store.insertSample(metric);
    const current = store.latestSample(metric.provider, metric.bucket, metric.window, metric.scope)!;
    let created = 0;
    for (const threshold of crossingThresholds(previous, current, thresholds, maxGapMs)) {
      const window = `${metric.bucket}:${metric.window}`;
      const dedupeKey = `${metric.provider}|${window}|${threshold}|${current.periodEpoch}`;
      if (store.insertAlert({ dedupeKey, provider: metric.provider, window, threshold, periodEpoch: current.periodEpoch })) created++;
    }
    return created;
  });
}
