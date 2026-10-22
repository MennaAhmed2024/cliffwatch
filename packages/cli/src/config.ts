import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const envName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const schema = z.object({
  intervalSeconds: z.number().int().min(1).max(86400).default(300),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
  dashboardPort: z.number().int().min(1024).max(65535).default(3000),
  dataFile: z.string().min(1).optional(),
  thresholds: z.array(z.number().min(0).max(100)).nonempty().default([70, 85, 95]),
  providers: z.object({
    codex: z.object({ enabled: z.boolean().default(true), source: z.enum(['live', 'file']).default('live'), command: z.string().min(1).default('codex'), file: z.string().optional() }).strict().default({}),
    openrouter: z.object({ enabled: z.boolean().default(true), keyEnv: envName.default('OPENROUTER_API_KEY'), scope: z.enum(['key', 'account']).default('key') }).strict().default({}),
  }).strict().default({}),
  channels: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('webhook'), urlEnv: envName }).strict(),
    z.object({ type: z.literal('discord'), urlEnv: envName }).strict(),
    z.object({ type: z.literal('ntfy'), urlEnv: envName }).strict(),
    z.object({ type: z.literal('telegram'), botTokenEnv: envName, chatIdEnv: envName }).strict(),
    z.object({ type: z.literal('desktop') }).strict(),
  ])).default([]),
}).strict();
export type Config = z.infer<typeof schema>;
export function parseConfig(text: string): Config {
  try {
    const config = schema.parse(parse(text, { maxAliasCount: 0 }) ?? {});
    if (config.providers.codex.source === 'file' && !config.providers.codex.file) throw new Error();
    if (new Set(config.thresholds).size !== config.thresholds.length) throw new Error();
    config.thresholds.sort((a, b) => a - b);
    return config;
  } catch { throw new Error('Invalid config: check documented keys, types, env references and file source path.'); }
}
export async function loadConfig(path?: string): Promise<Config> {
  const file = path ? resolve(path) : join(homedir(), '.quotadog', 'config.yaml');
  try {
    const config = parseConfig(await readFile(/* turbopackIgnore: true */ file, 'utf8'));
    if (config.dataFile && !isAbsolute(config.dataFile)) config.dataFile = resolve(dirname(file), config.dataFile);
    return config;
  }
  catch (error) {
    if (!path && (error as NodeJS.ErrnoException).code === 'ENOENT') return parseConfig('');
    if (error instanceof Error && error.message.startsWith('Invalid config:')) throw error;
    throw new Error('Cannot read config file.');
  }
}
