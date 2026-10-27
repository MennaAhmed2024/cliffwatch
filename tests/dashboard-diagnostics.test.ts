import { describe,expect,it } from 'vitest';
import { heartbeatState } from '../apps/dashboard/src/lib/diagnostics.js';

describe('dashboard diagnostics',()=>{
  it('fails closed for missing, invalid, future, and stale heartbeats',()=>{const now=Date.parse('2026-10-21T12:00:00Z');expect(heartbeatState(undefined,300,now)).toBe('missing');expect(heartbeatState('bad',300,now)).toBe('invalid');expect(heartbeatState('2026-10-21T12:01:00Z',300,now)).toBe('invalid');expect(heartbeatState('2026-10-21T11:49:59Z',300,now)).toBe('stale');});
  it('accepts a heartbeat exactly two intervals old',()=>expect(heartbeatState('2026-10-21T11:50:00Z',300,Date.parse('2026-10-21T12:00:00Z'))).toBe('fresh'));
});
