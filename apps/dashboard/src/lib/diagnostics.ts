export type HeartbeatState='fresh'|'stale'|'missing'|'invalid';

export function heartbeatState(heartbeat:string|undefined,intervalSeconds:number,nowMs=Date.now()):HeartbeatState{
  if(!heartbeat)return'missing';
  const observed=Date.parse(heartbeat);
  if(!Number.isFinite(observed)||observed>nowMs)return'invalid';
  return nowMs-observed<=intervalSeconds*2000?'fresh':'stale';
}
