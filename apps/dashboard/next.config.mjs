import path from 'node:path';

export default {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  serverExternalPackages: ['better-sqlite3'],
  devIndicators: false,
};
