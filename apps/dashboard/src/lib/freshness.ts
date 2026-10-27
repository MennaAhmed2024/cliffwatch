export const sampleAge = (observedAt: string | undefined, nowMs = Date.now()): number | undefined => {
  if (!observedAt) return undefined;
  const value = nowMs - Date.parse(observedAt);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};
export const isStaleAge = (ageMs: number | undefined, intervalSeconds: number): boolean => ageMs !== undefined && ageMs > intervalSeconds * 2000;
export const formatAge = (value?: number): string => value === undefined ? 'unknown age' : value < 60000 ? 'as of just now' : value < 3600000 ? `as of ${Math.floor(value / 60000)}m ago` : `as of ${Math.floor(value / 3600000)}h ago`;
export function currentSnapshotReason(input:{sampleObservedAt:string;sourceObservedAt:string;healthObservedAt?:string;healthState?:'ok'|'unknown';healthReason?:string;resetsAt?:string;usedPct:number;intervalSeconds:number;nowMs:number}):string|undefined{
  if(!input.healthObservedAt)return 'No provider health record yet.';
  if(input.healthState==='unknown')return input.healthReason??'Provider reported unknown.';
  const sample=sampleAge(input.sampleObservedAt,input.nowMs),source=sampleAge(input.sourceObservedAt,input.nowMs),health=sampleAge(input.healthObservedAt,input.nowMs);
  if(sample===undefined||source===undefined)return 'Quota sample timestamp is invalid.';
  if(health===undefined)return 'Provider health timestamp is invalid.';
  if(isStaleAge(sample,input.intervalSeconds)||isStaleAge(source,input.intervalSeconds))return 'Quota sample is stale; waiting for a fresh observation.';
  if(isStaleAge(health,input.intervalSeconds))return 'Provider health is stale; waiting for a fresh probe.';
  if(input.resetsAt){const reset=Date.parse(input.resetsAt);if(!Number.isFinite(reset)||reset<=input.nowMs)return 'Quota reset time is invalid or expired; waiting for a new sample.';}
  if(!Number.isFinite(input.usedPct)||input.usedPct<0||input.usedPct>100)return 'Quota sample is invalid.';
}
