# Releasing CliffWatch

The release artifact is the `cliffwatch` npm workspace package. The repository is still local-only; publication requires an npm account with permission to publish the package name.

1. Verify the working tree is clean and CI is green on Windows and Linux.
2. Choose the next version with npm's built-in versioning, for example `npm version patch --workspace cliffwatch --no-git-tag-version`. Commit the package and lockfile changes.
3. Run `npm ci`, `npm run build:dashboard`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run verify:package` on the release commit. Package verification installs the tarball into a fresh directory and checks the CLI, license, SQLite and local dashboard.
4. Inspect the tarball with `npm pack --workspace cliffwatch --dry-run --json`. Confirm no config files, tokens, local databases, `.env` files or build-machine native binaries are included.
5. After explicit publication approval and npm login, run `npm publish --workspace cliffwatch --access public`. Verify the registry page and a cold `npx cliffwatch status` installation.

`npm view cliffwatch version` currently returns 404, which only means no public package was visible at the time of checking. It does not reserve the name. `npm whoami` currently reports no authenticated npm session, so publication cannot be completed from this machine yet.

The CLI's declared runtime supports Node 20+, while the dashboard needs Node 20.9+ because its bundled Next.js runtime requires that minor version. Each npm install builds or downloads `better-sqlite3` for the target OS/Node version. The packaged dashboard deliberately excludes build-machine native SQLite and Sharp binaries and resolves SQLite from the installed CLI dependency.
