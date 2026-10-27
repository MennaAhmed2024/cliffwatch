#!/usr/bin/env node
import { loadConfig } from './config.js';
import { testAlert } from './core/notify.js';
import { freshness, unknown, type ProbeResult } from './core/probe.js';
import { probeAll } from './core/probes.js';
import { openExistingStore, runDaemon } from './daemon.js';
import { paceView, type PaceView } from './core/pacing-history.js';
import type { Store } from './core/store.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { lastCodexDiscovery } from './adapters/codex-discovery.js';
import { runServiceCommand, type ServiceCommand } from './service.js';

const eta = (hours: number | null | undefined): string => hours === undefined ? 'unknown' : hours === null ? 'no finite ETA' : `${hours.toFixed(1)}h`;
function paceFor(store: Store | undefined, provider: string, metric: ProbeResult['metrics'][number], now: Date, intervalMs: number): PaceView | undefined {
  if (!store) return undefined;
  try {
    const history = store.history(provider,10000).filter(s => s.bucket === metric.bucket && s.window === metric.window && s.scope === metric.scope && s.state === 'ok');
    const last = history[0];
    const periodEpoch = metric.resetsAt ? Math.floor(Date.parse(metric.resetsAt)/1000) : last && last.limitAbsolute === metric.limitAbsolute && metric.usedPct >= last.usedPct ? last.periodEpoch : Math.max(Math.floor(Date.parse(metric.observedAt)/1000),(last?.periodEpoch ?? 0)+1);
    const current = { ...metric, id: -1, state: 'ok' as const, periodEpoch };
    return paceView([...history.reverse(),current],now,intervalMs);
  } catch { return undefined; }
}
export function render(results: { provider: string; result: ProbeResult }[], now: Date, store?: Store, intervalMs = 300000): string {
  const lines = ['PROVIDER / BUCKET          WINDOW    USED     REMAINING  RESETS-IN (UTC)   PACE      STATE'];
  for (const { provider, result } of results) {
    if (result.state === 'unknown') {
      lines.push(`${provider.padEnd(26)}-         -        -          -                 unknown   UNKNOWN`, `  ${result.reason}`, '  Open adapter health issue: see docs/adapters/' + provider + '.md (repository issue tracker not configured).');
      continue;
    }
    for (const m of result.metrics) {
      const reset = m.resetsAt ? `${Math.max(0, (Date.parse(m.resetsAt) - now.getTime()) / 3600000).toFixed(1)}h` : 'no scheduled reset';
      const pace = paceFor(store,provider,m,now,intervalMs);
      const driver = pace?.driver ?? 'unknown';
      const paceLabel = driver === 'unknown' ? 'unknown' : driver === 'last-6h' ? '6h spike' : '7d avg';
      lines.push(`${(provider + '/' + m.bucket).padEnd(26)}${m.window.padEnd(10)}${(m.usedPct.toFixed(1) + '%').padEnd(9)}${((100 - m.usedPct).toFixed(1) + '%').padEnd(11)}${reset.padEnd(18)}${paceLabel.padEnd(10)}OK`);
      lines.push(`  Scope: ${m.scope}; source: ${m.sourceObservedAt}${m.resetsAt ? '; reset: ' + m.resetsAt : ''}`);
      if (pace) {
        lines.push(`  ETA 7-day: ${eta(pace.sevenDay?.etaHours)}; burn ${pace.sevenDay?.burnPerHour.toFixed(2) ?? '?'} ${m.window === 'credit' ? 'credits' : 'points'}/h. ETA last-6h: ${eta(pace.lastSixHours?.etaHours)}; burn ${pace.lastSixHours?.burnPerHour.toFixed(2) ?? '?'} ${m.window === 'credit' ? 'credits' : 'points'}/h. Driver: ${driver}.`);
        if (pace.weekly) lines.push(`  Weekly daily allowance: ${pace.weekly.budgetPerDay.toFixed(1)} points; UTC today burn: ${pace.weekly.todayBurn.toFixed(1)} points${pace.weekly.overPacePct && pace.weekly.overPacePct>0 ? `; WARNING ${pace.weekly.overPacePct.toFixed(0)}% over pace` : ''}.`);
      }
    }
  }
  lines.push('Pace requires >=80% observed history for each horizon; unknown means insufficient coverage.');
  return lines.join('\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}
async function main() {
  const args = process.argv.slice(2), command = args.shift() ?? 'status';
  if (command === '--help' || command === 'help') { console.log('cliffwatch status [--json] [--verbose] [--config PATH]\ncliffwatch sync-now [--config PATH]\ncliffwatch daemon [--once] [--config PATH]\ncliffwatch history [provider] [--json] [--config PATH]\ncliffwatch test-alert [--config PATH]\ncliffwatch dashboard [--config PATH]\ncliffwatch install-service [--config PATH]\ncliffwatch start-service\ncliffwatch stop-service\ncliffwatch service-status'); return; }
  let path: string | undefined, json = false, once = false, verbose = false, provider: string | undefined;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--json') json = true;
    else if (arg === '--verbose') verbose = true;
    else if (arg === '--once') once = true;
    else if (arg === '--config' && args[0] && !args[0].startsWith('--')) path = args.shift();
    else if (command === 'history' && !provider && arg && !arg.startsWith('--')) provider = arg;
    else throw new Error('Invalid arguments. Run cliffwatch --help.');
  }
  const serviceCommands:ServiceCommand[]=['install-service','start-service','stop-service','service-status'];
  if (!['status', 'sync-now', 'test-alert', 'daemon', 'history', 'dashboard',...serviceCommands].includes(command) || (once && command !== 'daemon') || (verbose && command !== 'status') || (provider && !['codex','openrouter'].includes(provider)) || (path&&serviceCommands.includes(command as ServiceCommand)&&command!=='install-service')) throw new Error('Invalid command or arguments. Run cliffwatch --help.');
  if(serviceCommands.includes(command as ServiceCommand)){
    if(command==='install-service')await loadConfig(path);
    console.log(await runServiceCommand(command as ServiceCommand,fileURLToPath(import.meta.url),path));
    return;
  }
  const config = await loadConfig(path);
  if (command === 'dashboard') {
    const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
    if (major < 20 || (major === 20 && minor < 9)) throw new Error('Dashboard requires Node.js 20.9 or newer.');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const server = join(root, 'dashboard', 'apps', 'dashboard', 'server.js');
    if (!existsSync(server)) throw new Error('Dashboard bundle is missing. Build with npm run build:dashboard.');
    const url = `http://127.0.0.1:${config.dashboardPort}`;
    console.log(`CliffWatch dashboard: ${url}`);
    const child = spawn(process.execPath, [server], { cwd: dirname(server), stdio: 'inherit', env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(config.dashboardPort), NEXT_TELEMETRY_DISABLED: '1', CLIFFWATCH_CONFIG_PATH: path ? resolve(path) : undefined } });
    let stopping = false;
    const stop = () => { stopping = true; child.kill('SIGTERM'); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    const code = await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', (value, signal) => done(stopping || signal ? 0 : value ?? 1)); });
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    if (code !== 0) process.exitCode = code;
    return;
  }
  if (command === 'test-alert') { await testAlert(config); console.log('Test alert delivered.'); return; }
  if (command === 'sync-now') { await runDaemon(config,true); console.log('Local store re-read is ready; refresh the dashboard.'); return; }
  if (command === 'daemon') { await runDaemon(config,once); return; }
  if (command === 'history') {
    const store = openExistingStore(config);
    if (!store) { console.log('No samples yet — run cliffwatch daemon.'); return; }
    try {
      const samples = store.history(provider), alerts = store.alertHistory(100);
      console.log(json ? JSON.stringify({samples,alerts},null,2) : samples.length ? samples.map(s => `${s.observedAt} ${s.provider}/${s.bucket}/${s.window} ${s.usedPct.toFixed(1)}% reset ${s.resetsAt ?? 'none'}`).join('\n')+'\nAlerts: '+alerts.length : 'No samples yet — run cliffwatch daemon.');
    } finally { store.close(); }
    return;
  }
  const results = await probeAll(config);
  const displayedAt = new Date();
  for (const entry of results) {
    if (entry.result.metrics.some(metric => !freshness(metric.sourceObservedAt, displayedAt, config.intervalSeconds * 2000) || (metric.resetsAt !== undefined && Date.parse(metric.resetsAt) <= displayedAt.getTime()))) {
      entry.result = unknown('Observation became stale or reset while waiting for other providers.');
    }
  }
  let store: Store | undefined;
  try { store = openExistingStore(config); }
  catch { console.error('CliffWatch: history store unavailable; pace is unknown.'); }
  try {
    console.log(json ? JSON.stringify(results, null, 2) : render(results, new Date(),store,config.intervalSeconds*1000));
    if (verbose && config.providers.codex.enabled && config.providers.codex.source === 'live') {
      const discovery = lastCodexDiscovery();
      console.log(`Codex executable: ${discovery.path ?? 'not found'}${discovery.source ? ` (${discovery.source})` : ''}${discovery.mtimeMs ? `; mtime ${new Date(discovery.mtimeMs).toISOString()}` : ''}`);
    }
  }
  finally { store?.close(); }
}
// The executable owns errors; adapters always report unknown rather than throwing.
main().catch((error: unknown) => { console.error('CliffWatch: ' + (error instanceof Error ? error.message : 'Command failed.')); process.exitCode = 1; });
