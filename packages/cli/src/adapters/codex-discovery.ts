import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

export type CodexDiscovery = { path?: string; mtimeMs?: number; source?: 'path' | 'scan' | 'override'; reason?: string };
let latest: CodexDiscovery = {};

async function executable(path: string): Promise<{ path: string; mtimeMs: number } | undefined> {
  try { await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK); const info = await stat(path); return info.isFile() ? { path, mtimeMs: info.mtimeMs } : undefined; }
  catch { return undefined; }
}

async function onPath(command: string, env: NodeJS.ProcessEnv): Promise<CodexDiscovery | undefined> {
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const root of (env.PATH ?? '').split(delimiter).filter(Boolean)) for (const suffix of suffixes) {
    const found = await executable(join(root, command.endsWith(suffix) ? command : command + suffix));
    if (found) return { ...found, source: 'path' };
  }
}

export function knownCodexRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  if (process.platform === 'win32') return env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin'), join(env.LOCALAPPDATA, 'codex', 'app', 'bin')] : [];
  return [join(homedir(), '.local', 'bin'), '/usr/local/bin', '/opt/homebrew/bin'];
}

async function scanRoot(root: string): Promise<CodexDiscovery | undefined> {
  const name = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const direct = await executable(join(root, name));
  const candidates: { path: string; mtimeMs: number }[] = direct ? [direct] : [];
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = await executable(join(root, entry.name, name));
      if (candidate) candidates.push(candidate);
    }
  } catch { /* absent install root */ }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ? { ...candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]!, source: 'scan' } : undefined;
}

export async function discoverCodex(command: string, options: { env?: NodeJS.ProcessEnv; roots?: string[] } = {}): Promise<CodexDiscovery> {
  const env = options.env ?? process.env;
  if (!isAbsolute(command)) {
    const pathResult = await onPath(command, env);
    if (pathResult) return latest = pathResult;
  }
  for (const root of options.roots ?? knownCodexRoots(env)) {
    const scanned = await scanRoot(root);
    if (scanned) return latest = scanned;
  }
  if (isAbsolute(command)) {
    const override = await executable(command);
    if (override) return latest = { ...override, source: 'override' };
  }
  return latest = { reason: 'codex executable not found — run cliffwatch setup' };
}

export function lastCodexDiscovery(): CodexDiscovery { return { ...latest }; }
