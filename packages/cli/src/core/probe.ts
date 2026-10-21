export type Metric = {
  provider: string; window: string; bucket: string; scope: string; usedPct: number;
  usedAbsolute?: number; limitAbsolute?: number; resetsAt?: string;
  observedAt: string; sourceObservedAt: string;
};
export type ProbeResult = { state: 'ok' | 'unknown'; reason?: string; metrics: Metric[] };
export const unknown = (reason: string): ProbeResult => ({ state: 'unknown', reason, metrics: [] });
export function freshness(source: string, now: Date, maxAgeMs: number): boolean {
  const age = now.getTime() - Date.parse(source);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}
