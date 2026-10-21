import type { Sample } from './store.js';
import { dailyBudget } from './pacing.js';

export type HistoricalEstimate = { burnPerHour: number; remaining: number; etaHours: number | null; coveredHours: number };
export function historicalEstimate(samples: readonly Sample[], now: Date, hours: number, maxGapMs: number, unit: 'pct' | 'absolute'): HistoricalEstimate | null {
  const ordered = [...samples].sort((a,b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const last = ordered.at(-1);
  if (!last || Date.parse(last.observedAt)>now.getTime() || now.getTime() - Date.parse(last.observedAt) > maxGapMs || !Number.isFinite(hours) || hours <= 0) return null;
  const start = now.getTime() - hours * 3600000;
  let delta = 0, coveredMs = 0;
  for (let i=1;i<ordered.length;i++) {
    const a = ordered[i-1]!, b = ordered[i]!;
    const from = Date.parse(a.observedAt), to = Date.parse(b.observedAt), overlap = to - Math.max(start,from);
    if (overlap <= 0 || to - from <= 0 || to - from > maxGapMs || a.periodEpoch !== b.periodEpoch) continue;
    const x = unit === 'pct' ? a.usedPct : a.usedAbsolute;
    const y = unit === 'pct' ? b.usedPct : b.usedAbsolute;
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y) || y < x) continue;
    coveredMs += overlap; delta += (y-x) * overlap/(to-from);
  }
  if (coveredMs < hours * 3600000 * 0.8) return null;
  const remaining = unit === 'pct' ? 100-last.usedPct : (last.limitAbsolute ?? NaN)-(last.usedAbsolute ?? NaN);
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  const burnPerHour = delta/(coveredMs/3600000);
  return { burnPerHour, remaining, etaHours: remaining === 0 ? 0 : burnPerHour > 0 ? remaining/burnPerHour : null, coveredHours: coveredMs/3600000 };
}
export type PaceView = { sevenDay: HistoricalEstimate | null; lastSixHours: HistoricalEstimate | null; driver: '7-day' | 'last-6h' | 'unknown'; weekly?: { budgetPerDay: number; todayBurn: number; overPacePct: number | null } };
export function paceView(samples: readonly Sample[], now: Date, intervalMs: number): PaceView {
  const last = samples.at(-1);
  if (!last) return { sevenDay: null, lastSixHours: null, driver: 'unknown' };
  const unit = last.window === 'credit' ? 'absolute' : 'pct';
  const sevenDay = historicalEstimate(samples, now, 168, intervalMs*2, unit);
  const lastSixHours = historicalEstimate(samples, now, 6, intervalMs*2, unit);
  const eta7 = sevenDay?.etaHours ?? Infinity, eta6 = lastSixHours?.etaHours ?? Infinity;
  const driver = eta7 === Infinity && eta6 === Infinity ? 'unknown' : eta6 <= eta7 ? 'last-6h' : '7-day';
  const view: PaceView = { sevenDay, lastSixHours, driver };
  if (last.window === 'weekly' && last.resetsAt) {
    const midnight = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
    const daily = historicalEstimate(samples, now, (now.getTime()-midnight)/3600000, intervalMs*2, 'pct');
    if (daily) {
      const todayBurn = daily.burnPerHour*((now.getTime()-midnight)/3600000);
      const budget = dailyBudget(100-last.usedPct,last.resetsAt,now,todayBurn);
      if (budget) view.weekly = { budgetPerDay: budget.remainingBudgetPerDay, todayBurn, overPacePct: budget.overPacePct };
    }
  }
  return view;
}
