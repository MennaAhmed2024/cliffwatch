import { describe, expect, it } from 'vitest';
import { currentSnapshotReason, formatAge, isStaleAge, sampleAge } from '../apps/dashboard/src/lib/freshness.js';

describe('dashboard snapshot transparency', () => {
  it('backdated samples render an age label and cross the two-interval stale boundary', () => {
    const now = Date.parse('2026-10-23T12:10:01Z');
    const age = sampleAge('2026-10-23T12:00:00Z', now);
    expect(age).toBe(601000);
    expect(isStaleAge(age, 300)).toBe(true);
    expect(formatAge(age)).toBe('as of 10m ago');
  });
  it('a sample at exactly two intervals is not stale', () => expect(isStaleAge(600000, 300)).toBe(false));
  const valid={sampleObservedAt:'2026-10-23T12:09:00Z',sourceObservedAt:'2026-10-23T12:09:00Z',healthObservedAt:'2026-10-23T12:09:00Z',healthState:'ok' as const,resetsAt:'2026-10-23T13:00:00Z',usedPct:50,intervalSeconds:300,nowMs:Date.parse('2026-10-23T12:10:00Z')};
  it('accepts a fresh valid provider snapshot',()=>expect(currentSnapshotReason(valid)).toBeUndefined());
  it('rejects stale samples and stale provider health',()=>{expect(currentSnapshotReason({...valid,sampleObservedAt:'2026-10-23T11:59:00Z'})).toContain('stale');expect(currentSnapshotReason({...valid,healthObservedAt:'2026-10-23T11:59:00Z'})).toContain('health is stale');});
  it('rejects expired reset and invalid timestamps',()=>{expect(currentSnapshotReason({...valid,resetsAt:'2026-10-23T12:00:00Z'})).toContain('expired');expect(currentSnapshotReason({...valid,sourceObservedAt:'bad'})).toContain('timestamp is invalid');});
});
