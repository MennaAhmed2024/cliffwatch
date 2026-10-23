export const sampleAge = (observedAt: string | undefined, nowMs = Date.now()): number | undefined => {
  if (!observedAt) return undefined;
  const value = nowMs - Date.parse(observedAt);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};
export const isStaleAge = (ageMs: number | undefined, intervalSeconds: number): boolean => ageMs !== undefined && ageMs > intervalSeconds * 2000;
export const formatAge = (value?: number): string => value === undefined ? 'unknown age' : value < 60000 ? 'as of just now' : value < 3600000 ? `as of ${Math.floor(value / 60000)}m ago` : `as of ${Math.floor(value / 3600000)}h ago`;
