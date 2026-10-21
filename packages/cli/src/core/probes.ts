import type { Config } from '../config.js';
import { probeFile, probeLive } from '../adapters/codex.js';
import { probeOpenRouter } from '../adapters/openrouter.js';
import { unknown, type ProbeResult } from './probe.js';
export type ProviderResult = { provider: string; result: ProbeResult };
export async function probeProvider(provider: 'codex' | 'openrouter', config: Config, now = new Date()): Promise<ProviderResult> {
  try {
    if (provider === 'codex') {
      const c = config.providers.codex;
      return { provider, result: c.source === 'file' ? await probeFile(c.file!,now,config.intervalSeconds*2000) : await probeLive(c.command,config.timeoutMs) };
    }
    const c = config.providers.openrouter;
    return { provider, result: await probeOpenRouter(process.env[c.keyEnv],c.scope,config.timeoutMs) };
  } catch { return { provider, result: unknown('Provider probe failed unexpectedly.') }; }
}
export async function probeAll(config: Config): Promise<ProviderResult[]> {
  const names: ('codex'|'openrouter')[] = [];
  if (config.providers.codex.enabled) names.push('codex');
  if (config.providers.openrouter.enabled) names.push('openrouter');
  return Promise.all(names.map(name => probeProvider(name,config)));
}
