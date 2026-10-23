import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { testAlert } from '../packages/cli/src/core/notify.js';
import { loadConfig, parseConfig } from '../packages/cli/src/config.js';
const exec = promisify(execFile);
it('starts with Codex enabled and optional providers disabled', () => {
  const config = parseConfig('');
  expect(config.providers.codex.enabled).toBe(true);
  expect(config.providers.openrouter.enabled).toBe(false);
});
it('resolves a relative SQLite path beside its config so CLI and dashboard share the database', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cliffwatch-config-'));
  try {
    const file = join(dir, 'config.yaml');
    await writeFile(file, 'dataFile: data/cliffwatch.sqlite\n');
    expect((await loadConfig(file)).dataFile).toBe(join(dir, 'data', 'cliffwatch.sqlite'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('garbled source prints UNKNOWN, exits 0, and cannot display stale OK', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cliffwatch-'));
  try {
    const source = join(dir, 'broken.jsonl'), config = join(dir, 'config.yaml');
    await writeFile(source, 'garbled');
    await writeFile(config, JSON.stringify({ providers: { codex: { source: 'file', file: source }, openrouter: { enabled: false } } }));
    const result = await exec(process.execPath, [resolve('packages/cli/dist/cli.js'), 'status', '--config', config]);
    expect(result.stdout).toContain('UNKNOWN'); expect(result.stdout).not.toMatch(/\bOK\b/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('real CLI test-alert posts JSON to a local HTTP receiver', async () => {
  const received: string[] = [];
  const server = createServer((req, res) => { let body = ''; req.on('data', c => body += c); req.on('end', () => { received.push(body); res.writeHead(204); res.end(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(join(tmpdir(), 'cliffwatch-alert-'));
  try {
    const address = server.address(); if (!address || typeof address === 'string') throw new Error();
    const path = join(dir, 'config.yaml');
    await writeFile(path, 'channels:\n  - type: webhook\n    urlEnv: CLIFFWATCH_TEST_URL\n');
    const result = await exec(process.execPath, [resolve('packages/cli/dist/cli.js'), 'test-alert', '--config', path], { env: { ...process.env, CLIFFWATCH_TEST_URL: `http://127.0.0.1:${address.port}` } });
    expect(result.stdout).toContain('Test alert delivered');
    expect(received).toHaveLength(1); expect(JSON.parse(received[0]!).type).toBe('cliffwatch.test');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
});
it('notification failure stays visible; unsafe URL rejected', async () => {
  const config = parseConfig('channels:\n  - type: webhook\n    urlEnv: ALERT_URL');
  await expect(testAlert(config, { ALERT_URL: 'http://example.com/secret' })).rejects.toThrow('HTTPS');
  await expect(testAlert(config, { ALERT_URL: 'https://example.com/secret' }, async () => new Response('', { status: 500 }))).rejects.toThrow('delivery failed');
});
it('daemon --once creates a private store and history stays honest when no provider is enabled', async () => {
  const dir = await mkdtemp(join(tmpdir(),'cliffwatch-daemon-cli-'));
  try {
    const db = join(dir,'samples.sqlite'), config = join(dir,'config.yaml');
    await writeFile(config,JSON.stringify({dataFile:db,providers:{codex:{enabled:false},openrouter:{enabled:false}}}));
    await exec(process.execPath,[resolve('packages/cli/dist/cli.js'),'daemon','--once','--config',config]);
    const history = await exec(process.execPath,[resolve('packages/cli/dist/cli.js'),'history','--config',config]);
    expect(history.stdout).toContain('No samples yet');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
