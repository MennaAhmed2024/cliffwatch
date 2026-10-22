import { describe, expect, it } from 'vitest';
import { isLocalSameOrigin } from '../apps/dashboard/src/lib/request.js';

function request(host: string, origin?: string) {
  return new Request('http://127.0.0.1:3000/api/test-alert', { method: 'POST', headers: { host, ...(origin ? { origin } : {}) } });
}

describe('dashboard test-alert origin guard', () => {
  it('accepts the local page origin only', () => {
    expect(isLocalSameOrigin(request('127.0.0.1:3000', 'http://127.0.0.1:3000'))).toBe(true);
    expect(isLocalSameOrigin(request('127.0.0.1:3000', 'http://evil.example'))).toBe(false);
    expect(isLocalSameOrigin(request('evil.example', 'http://evil.example'))).toBe(false);
    expect(isLocalSameOrigin(request('127.0.0.1:3000'))).toBe(false);
  });
});
