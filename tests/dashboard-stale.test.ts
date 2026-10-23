import { describe, expect, it } from 'vitest';
import { formatAge, isStaleAge, sampleAge } from '../apps/dashboard/src/lib/freshness.js';

describe('dashboard snapshot transparency', () => {
  it('backdated samples render an age label and cross the two-interval stale boundary', () => {
    const now = Date.parse('2026-10-23T12:10:01Z');
    const age = sampleAge('2026-10-23T12:00:00Z', now);
    expect(age).toBe(601000);
    expect(isStaleAge(age, 300)).toBe(true);
    expect(formatAge(age)).toBe('as of 10m ago');
  });
  it('a sample at exactly two intervals is not stale', () => expect(isStaleAge(600000, 300)).toBe(false));
});
