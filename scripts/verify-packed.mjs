import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(join(tmpdir(), 'cliffwatch-package-'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run via npm run verify:package so npm_execpath is available.');

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: workspace, windowsHide: true, ...options });
    let stdout = '', stderr = '';
    child.stdout?.on('data', chunk => stdout += chunk);
    child.stderr?.on('data', chunk => stderr += chunk);
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(`${args.join(' ')} failed (${code}).\n${stderr.slice(-2000)}`)));
  });
}
const npm = (...args) => run(process.execPath, [npmCli, ...args]);
const packed = await npm('pack', '--workspace', 'cliffwatch', '--pack-destination', scratch, '--silent');
const tarball = join(scratch, packed.stdout.trim().split(/\r?\n/).at(-1));
const installDir = join(scratch, 'install');
await npm('install', tarball, '--prefix', installDir, '--no-audit', '--no-fund');
const packageDir = join(installDir, 'node_modules', 'cliffwatch');
const cli = join(packageDir, 'dist', 'cli.js');
const help = await npm('--prefix', installDir, 'exec', '--', 'cliffwatch', '--help');
if (!help.stdout.includes('cliffwatch dashboard')) throw new Error('Packaged CLI help is missing dashboard.');
const license = await readFile(join(packageDir, 'LICENSE'), 'utf8');
if (!license.includes('MIT License')) throw new Error('Packaged license is missing.');
const notices = await readFile(join(packageDir, 'THIRD_PARTY_NOTICES.md'), 'utf8');
if (!notices.includes('React Bits')) throw new Error('Packaged React Bits notice is missing.');

const now = new Date();
const fixtureFile = join(scratch, 'codex.jsonl');
await writeFile(fixtureFile, JSON.stringify({
  timestamp: now.toISOString(),
  type: 'event_msg',
  payload: {
    type: 'token_count',
    rate_limits: {
      limit_id: 'codex',
      primary: { used_percent: 42.5, window_minutes: 300, resets_at: Math.floor((now.getTime() + 3600000) / 1000) },
      secondary: { used_percent: 21, window_minutes: 10080, resets_at: Math.floor((now.getTime() + 6 * 86400000) / 1000) },
    },
  },
}) + '\n');
const statusConfigFile = join(scratch, 'status-config.yaml');
await writeFile(statusConfigFile, JSON.stringify({
  providers: {
    codex: { enabled: true, source: 'file', file: fixtureFile },
    openrouter: { enabled: false },
  },
}));
const coldStatus = await npm('--prefix', installDir, 'exec', '--', 'cliffwatch', 'status', '--config', statusConfigFile);
if (!coldStatus.stdout.includes('codex/codex') || !coldStatus.stdout.includes('42.5%') || !coldStatus.stdout.includes('OK')) {
  throw new Error(`Packed CLI cold status failed.\n${coldStatus.stdout.slice(-2000)}`);
}

const listener = createServer();
await new Promise(resolvePromise => listener.listen(0, '127.0.0.1', resolvePromise));
const address = listener.address();
if (!address || typeof address === 'string') throw new Error('Cannot reserve test port.');
const port = address.port;
await new Promise(resolvePromise => listener.close(resolvePromise));

const configFile = join(scratch, 'config.yaml');
const databaseFile = join(scratch, 'quota.sqlite');
await writeFile(configFile, `dataFile: quota.sqlite\ndashboardPort: ${port}\nintervalSeconds: 60\nproviders:\n  codex:\n    enabled: true\n  openrouter:\n    enabled: false\n`);
const { SqliteStore } = await import(pathToFileURL(join(packageDir, 'dist', 'core', 'store.js')).href);
const store = new SqliteStore(databaseFile);
store.insertSample({ provider: 'codex', bucket: 'primary', window: '5h', scope: 'account', usedPct: 42.5, resetsAt: new Date(now.getTime() + 3600000).toISOString(), observedAt: now.toISOString(), sourceObservedAt: now.toISOString() });
store.putHealth({ provider: 'codex', state: 'ok', observedAt: now.toISOString() });
store.close();

const child = spawn(process.execPath, [cli, 'dashboard', '--config', configFile], { cwd: scratch, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
let serverOutput = '';
child.stdout.on('data', chunk => serverOutput += chunk);
child.stderr.on('data', chunk => serverOutput += chunk);
try {
  let overview;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`Dashboard exited early.\n${serverOutput.slice(-2000)}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/overview`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { overview = await response.json(); break; }
    } catch { /* server starting */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  if (!overview) throw new Error(`Packaged dashboard did not start.\n${serverOutput.slice(-2000)}`);
  if (overview.cards[0]?.state !== 'ok' || overview.cards[0]?.usedPct !== 42.5) throw new Error(`Package did not read the seeded SQLite: ${JSON.stringify(overview)}`);
  const brandAsset = await fetch(`http://127.0.0.1:${port}/brand/cliffwatch-mark.png`);
  if (!brandAsset.ok || !brandAsset.headers.get('content-type')?.startsWith('image/png')) throw new Error('Packaged dashboard brand asset is missing.');
  const pricing = await fetch(`http://127.0.0.1:${port}/pricing`);
  if (!pricing.ok || !(await pricing.text()).includes('Plans that grow with your AI workflow')) throw new Error('Packaged pricing page is missing.');
  const staleAt = new Date(Date.now() - 121000);
  const staleStore = new SqliteStore(databaseFile);
  staleStore.insertSample({ provider: 'codex', bucket: 'primary', window: '5h', scope: 'account', usedPct: 43, resetsAt: new Date(Date.now() + 3600000).toISOString(), observedAt: staleAt.toISOString(), sourceObservedAt: staleAt.toISOString() });
  staleStore.putHealth({ provider: 'codex', state: 'ok', observedAt: staleAt.toISOString() });
  staleStore.close();
  const stale = await (await fetch(`http://127.0.0.1:${port}/api/overview`)).json();
  if (stale.cards[0]?.state !== 'unknown' || stale.cards[0]?.stale !== true || stale.cards[0]?.usedPct !== 43) throw new Error('Stale data was not retained and labeled UNKNOWN transparently.');
  console.log(`Package verified on ${process.platform}, Node ${process.version}: npx-style cold status, license, dashboard, SQLite, stale data.`);
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([new Promise(resolvePromise => child.once('exit', resolvePromise)), new Promise(resolvePromise => setTimeout(resolvePromise, 5000))]);
}
