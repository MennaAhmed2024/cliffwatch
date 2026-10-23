import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { discoverCodex } from './adapters/codex-discovery.js';
import { probeLive } from './adapters/codex.js';
import { probeOpenRouter } from './adapters/openrouter.js';
import { configPath, loadConfig, parseConfig, saveConfig } from './config.js';
import type { ProbeResult } from './core/probe.js';

export type ToolName = 'codex' | 'openrouter' | 'claude';
export type ToolDetection = { name: ToolName; found: boolean; supported: boolean; detail: string };

async function commandExists(name: string): Promise<boolean> {
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd'] : [''];
  for (const root of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) for (const suffix of suffixes) {
    try { await access(join(root, name + suffix)); return true; } catch { /* next candidate */ }
  }
  return false;
}

export async function detectTools(): Promise<ToolDetection[]> {
  const [codex, claude] = await Promise.all([discoverCodex('codex'), commandExists('claude')]);
  return [
    { name: 'codex', found: Boolean(codex.path), supported: true, detail: codex.path ?? codex.reason ?? 'Not found' },
    { name: 'openrouter', found: Boolean(process.env.OPENROUTER_API_KEY), supported: true, detail: process.env.OPENROUTER_API_KEY ? 'Key is configured locally.' : 'Enter an API key to connect.' },
    { name: 'claude', found: claude, supported: false, detail: claude ? 'Installed; quota adapter is still under investigation.' : 'Not found; quota adapter is still under investigation.' },
  ];
}

export async function testTool(name: ToolName, key?: string): Promise<ProbeResult> {
  if (name === 'codex') return probeLive('codex', 10000);
  if (name === 'openrouter') return probeOpenRouter(key || process.env.OPENROUTER_API_KEY, 'key', 10000);
  return { state: 'unknown', reason: 'Claude quota adapter is not implemented yet.', metrics: [] };
}

function persistWindowsUserKey(key: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const script = "$p=[Console]::In.ReadToEnd()|ConvertFrom-Json;[Environment]::SetEnvironmentVariable('OPENROUTER_API_KEY',[string]$p.key,'User')";
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    child.once('error', () => reject(new Error('Could not open Windows environment settings.')));
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error('Could not save the OpenRouter key in Windows user environment.')));
    child.stdin.end(JSON.stringify({ key }));
  });
}

export async function saveTool(name: ToolName, key?: string, path?: string, persist: (key: string) => Promise<void> = persistWindowsUserKey, platform = process.platform): Promise<void> {
  if (name === 'claude') throw new Error('Claude quota adapter is not implemented yet.');
  if (name === 'openrouter') {
    const value = key || process.env.OPENROUTER_API_KEY;
    if (!value) throw new Error('OpenRouter API key is required.');
    if (platform !== 'win32') throw new Error('Save OPENROUTER_API_KEY in your shell environment, then retry.');
    await persist(value);
    process.env.OPENROUTER_API_KEY = value;
  }
  let exists = true;
  try { await access(configPath(path)); } catch { exists = false; }
  const config = exists ? await loadConfig(path) : parseConfig('');
  if (name === 'codex') config.providers.codex.enabled = true;
  if (name === 'openrouter') config.providers.openrouter.enabled = true;
  await saveConfig(config, path);
}
