const hour = 3600000;
function valid(date: Date): number {
  const n = date.getTime();
  if (!Number.isFinite(n)) throw new Error('Invalid date');
  return n;
}
export function rollingReset(firstUse: Date, durationHours = 5): string {
  if (!Number.isFinite(durationHours) || durationHours <= 0) throw new Error('Invalid duration');
  return new Date(valid(firstUse) + durationHours * hour).toISOString();
}
export function dailyReset(now: Date): string {
  valid(now);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}
export function weeklyReset(start: Date, now: Date): string {
  const startMs = valid(start), nowMs = valid(now), week = 168 * hour;
  if (nowMs < startMs) throw new Error('Weekly start is in the future');
  return new Date(startMs + (Math.floor((nowMs - startMs) / week) + 1) * week).toISOString();
}
