#!/usr/bin/env node
import { loadConfig } from './config.js';
import { probeFile, probeLive } from './adapters/codex.js';
import { probeOpenRouter } from './adapters/openrouter.js';
import { testAlert } from './core/notify.js';
import { freshness, unknown, type ProbeResult } from './core/probe.js';

export function render(results: { provider: string; result: ProbeResult }[], now: Date): string {
  const lines = ['PROVIDER / BUCKET          WINDOW    USED     REMAINING  RESETS-IN (UTC)   PACE      STATE'];
  for (const { provider, result } of results) {
    if (result.state === 'unknown') {
      lines.push(`${provider.padEnd(26)}-         -        -          -                 unknown   UNKNOWN`, `  ${result.reason}`, '  Open adapter health issue: see docs/adapters/' + provider + '.md (repository issue tracker not configured).');
      continue;
    }
    for (const m of result.metrics) {
      const reset = m.resetsAt ? `${Math.max(0, (Date.parse(m.resetsAt) - now.getTime()) / 3600000).toFixed(1)}h` : 'no scheduled reset';
      lines.push(`${(provider + '/' + m.bucket).padEnd(26)}${m.window.padEnd(10)}${(m.usedPct.toFixed(1) + '%').padEnd(9)}${((100 - m.usedPct).toFixed(1) + '%').padEnd(11)}${reset.padEnd(18)}unknown   OK`);
      lines.push(`  Scope: ${m.scope}; source: ${m.sourceObservedAt}${m.resetsAt ? '; reset: ' + m.resetsAt : ''}`);
    }
  }
  lines.push('Pace: unknown until sufficient history exists (persistence arrives in M2).');
  return lines.join('\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}
async function main() {
  const args = process.argv.slice(2), command = args.shift() ?? 'status';
  if (command === '--help' || command === 'help') { console.log('quotadog status [--json] [--config PATH]\nquotadog test-alert [--config PATH]\nM1: daemon, history and dashboard are not implemented yet.'); return; }
  let path: string | undefined, json = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--json') json = true;
    else if (arg === '--config' && args[0] && !args[0].startsWith('--')) path = args.shift();
    else throw new Error('Invalid arguments. Run quotadog --help.');
  }
  if (!['status', 'test-alert'].includes(command)) throw new Error('Command unavailable in M1. Run quotadog --help.');
  const config = await loadConfig(path);
  if (command === 'test-alert') { await testAlert(config); console.log('Test alert delivered.'); return; }
  const tasks: Promise<{ provider: string; result: ProbeResult }>[] = [];
  const codex = config.providers.codex;
  if (codex.enabled) tasks.push((codex.source === 'file' ? probeFile(codex.file!, new Date(), config.intervalSeconds * 2000) : probeLive(codex.command, config.timeoutMs)).then(result => ({ provider: 'codex', result })));
  const router = config.providers.openrouter;
  if (router.enabled) tasks.push(probeOpenRouter(process.env[router.keyEnv], router.scope, config.timeoutMs).then(result => ({ provider: 'openrouter', result })));
  const results = await Promise.all(tasks);
  const displayedAt = new Date();
  for (const entry of results) {
    if (entry.result.metrics.some(metric => !freshness(metric.sourceObservedAt, displayedAt, config.intervalSeconds * 2000) || (metric.resetsAt !== undefined && Date.parse(metric.resetsAt) <= displayedAt.getTime()))) {
      entry.result = unknown('Observation became stale or reset while waiting for other providers.');
    }
  }
  console.log(json ? JSON.stringify(results, null, 2) : render(results, new Date()));
}
// The executable owns errors; adapters always report unknown rather than throwing.
main().catch((error: unknown) => { console.error('QuotaDog: ' + (error instanceof Error ? error.message : 'Command failed.')); process.exitCode = 1; });
