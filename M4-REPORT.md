# M4 release report

## Outcome

CliffWatch v0.1.0 is a local npm release candidate. The CLI, daemon, SQLite history, alert outbox and loopback dashboard are packaged together. Publication is deliberately pending because this machine has no authenticated npm session and publishing is an external release action.

## Release surface

- Root and package MIT licenses.
- Public README with installation, configuration, privacy, positioning and a worked ETA example.
- A documented npm version and publication procedure in `RELEASING.md`.
- Windows and Linux CI covering build, type checking, lint, unit/integration tests and a Node 20 packed-package check.
- A clean-install verifier that packs the real npm workspace, installs the tarball into a temporary project, starts the packaged dashboard, reads a seeded SQLite database and confirms stale data fails closed.

## Portability correction

The first Next.js standalone build copied the build machine's Windows `better-sqlite3` binary into the dashboard. That artifact could install successfully on another operating system and then fail at runtime. The final build uses webpack externalization, removes SQLite and Sharp native packages from the standalone payload, and resolves `better-sqlite3` from the normal npm dependency installed for the target machine. The packed dashboard contains no `.node` files.

## Verification evidence

- Packed cold install passed locally on Windows with Node 24.18.0. Because no matching prebuilt SQLite binary was available, npm compiled it locally; the npm bin shim ran a fixture-backed `cliffwatch status`, and the packaged license, dashboard, SQLite read and stale-data behavior all passed.
- The webpack production dashboard build passed, and the packaged dashboard contains zero `.node` files.
- TypeScript checks and ESLint passed.
- All 62 tests in seven test files passed.
- `npm audit`, including development dependencies, reported zero known vulnerabilities.
- The CI matrix repeats the full checks on `windows-latest` and `ubuntu-latest`, then switches to Node 20 for packed-package verification. This workflow exists locally but cannot report a hosted green run until the repository is pushed to GitHub.

## Remaining release action

`npm view cliffwatch version` returned 404 when checked, and `npm whoami` reported no authenticated session. The package name is therefore not proven reserved and the public `npx cliffwatch status` path is not live. After npm authentication and explicit approval, follow `RELEASING.md`, publish, then verify the registry page and a cold `npx` invocation.
