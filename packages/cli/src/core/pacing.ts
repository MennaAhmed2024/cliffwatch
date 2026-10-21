export type BurnSample = { at: string; used: number; period: string };
export type Estimate = { burnPerHour: number; hoursToExhaustion: number | null };
// Samples must use one stable unit (percentage points, or absolute credits).
// Require full horizon coverage; never extrapolate sparse startup data as seven days.
export function estimate(samples: BurnSample[], remaining: number, now: Date, horizonHours: number): Estimate | null {
  if (!Number.isFinite(remaining) || remaining < 0 || !Number.isFinite(horizonHours) || horizonHours <= 0 || !Number.isFinite(now.getTime())) return null;
  const start = now.getTime() - horizonHours * 3600000;
  const sorted = [...samples].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (sorted.some(s => !Number.isFinite(Date.parse(s.at)) || !Number.isFinite(s.used) || s.used < 0 || Date.parse(s.at) > now.getTime())) return null;
  const before = sorted.filter(s => Date.parse(s.at) <= start).at(-1);
  const after = sorted.filter(s => Date.parse(s.at) > start);
  if (!before || start - Date.parse(before.at) > horizonHours * 3600000 || !after.length || Date.parse(after.at(-1)!.at) !== now.getTime()) return null;
  const series = [before, ...after];
  let burn = 0;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]!, b = series[i]!;
    const elapsed = Date.parse(b.at) - Date.parse(a.at);
    if (elapsed <= 0 || a.period !== b.period || b.used < a.used) return null;
    const overlap = Date.parse(b.at) - Math.max(start, Date.parse(a.at));
    burn += (b.used - a.used) * overlap / elapsed;
  }
  const burnPerHour = burn / horizonHours;
  return { burnPerHour, hoursToExhaustion: remaining === 0 ? 0 : burnPerHour > 0 ? remaining / burnPerHour : null };
}
export function dualEta(samples: BurnSample[], remaining: number, now: Date) {
  const average = estimate(samples, remaining, now, 168), recent = estimate(samples, remaining, now, 6);
  const a = average?.hoursToExhaustion ?? Infinity, r = recent?.hoursToExhaustion ?? Infinity;
  return { average, recent, driver: a === Infinity && r === Infinity ? 'unknown' : r <= a ? 'last-6h' : '7-day' };
}
export function dailyBudget(remainingPct: number, resetsAt: string, now: Date, todayBurnPct: number) {
  const days = (Date.parse(resetsAt) - now.getTime()) / 86400000;
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(remainingPct) || remainingPct < 0 || remainingPct > 100 || !Number.isFinite(todayBurnPct) || todayBurnPct < 0) return null;
  const safeBudget = remainingPct / days;
  return { daysUntilReset: days, fullQuotaReferencePerDay: 100 / days, remainingBudgetPerDay: safeBudget,
    overPacePct: safeBudget > 0 ? Math.max(0, (todayBurnPct / safeBudget - 1) * 100) : todayBurnPct > 0 ? null : 0 };
}
