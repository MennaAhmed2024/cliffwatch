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
const staticSource = join(workspace, 'apps', 'dashboard', '.next', 'static');
cpSync(staticSource, join(target, 'apps', 'dashboard', '.next', 'static'), { recursive: true });
console.log('Packaged local dashboard alongside CLI.');
