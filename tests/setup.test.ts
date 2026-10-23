import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../packages/cli/src/config.js';
import { saveTool, testTool } from '../packages/cli/src/setup.js';

describe('local tool setup', () => {
  it('saves provider state while keeping the OpenRouter secret out of YAML', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cliffwatch-setup-'));
    const configPath = join(dir, 'config.yaml');
    let persisted = '';
    try {
      await saveTool('openrouter', 'private-test-key', configPath, async key => { persisted = key; }, 'win32');
      expect(persisted).toBe('private-test-key');
      expect((await loadConfig(configPath)).providers.openrouter.enabled).toBe(true);
      expect(await readFile(configPath, 'utf8')).not.toContain('private-test-key');
    } finally { delete process.env.OPENROUTER_API_KEY; await rm(dir, { recursive: true, force: true }); }
  });
  it('does not pretend Claude is supported', async () => {
    expect(await testTool('claude')).toMatchObject({ state: 'unknown', reason: expect.stringContaining('not implemented') });
  });
});
