import { it, expect } from 'vitest';
import { boundedJson } from '../packages/cli/src/core/http.js';
import { probeOpenRouter } from '../packages/cli/src/adapters/openrouter.js';
it('caps response size even without content-length', async () => {
  await expect(boundedJson(new Response('123456789'), 4)).rejects.toThrow('large');
});
it.each([403, 429, 500])('OpenRouter HTTP %s never produces metrics', async status => {
  const result = await probeOpenRouter('secret', 'account', 100, async () => new Response('private error', { status }));
  expect(result).toMatchObject({ state: 'unknown', metrics: [], reason: expect.stringContaining(String(status)) });
  expect(result.reason).not.toContain('private');
});
it('garbled success body is unknown', async () => {
  expect((await probeOpenRouter('secret', 'account', 100, async () => new Response('garbled'))).state).toBe('unknown');
});
