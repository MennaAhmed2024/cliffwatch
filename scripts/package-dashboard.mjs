import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(workspace, 'apps', 'dashboard', '.next', 'standalone');
const target = join(workspace, 'packages', 'cli', 'dashboard');
if (!existsSync(join(source, 'apps', 'dashboard', 'server.js'))) throw new Error('Dashboard standalone build is missing.');
if (!target.startsWith(join(workspace, 'packages', 'cli') + sep)) throw new Error('Invalid dashboard package target.');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
// The CLI dependency is installed by npm for the user's OS/Node version.
// Keep the standalone server's JS, but never ship the builder's native SQLite binary.
const bundledSqlite = join(target, 'node_modules', 'better-sqlite3');
if (existsSync(bundledSqlite)) rmSync(bundledSqlite, { recursive: true, force: true });
// This dashboard uses no Next image optimization; builder-platform Sharp binaries
// would otherwise make the tarball platform-specific.
for (const name of ['sharp', '@img']) {
  const bundledImage = join(target, 'node_modules', name);
  if (existsSync(bundledImage)) rmSync(bundledImage, { recursive: true, force: true });
}
const staticSource = join(workspace, 'apps', 'dashboard', '.next', 'static');
cpSync(staticSource, join(target, 'apps', 'dashboard', '.next', 'static'), { recursive: true });
// Next standalone output does not copy public assets automatically.
const publicSource = join(workspace, 'apps', 'dashboard', 'public');
if (existsSync(publicSource)) cpSync(publicSource, join(target, 'apps', 'dashboard', 'public'), { recursive: true });
console.log('Packaged local dashboard alongside CLI.');
