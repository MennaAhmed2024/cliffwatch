# CliffWatch — M2 gate

Implemented daemon polling, provider isolation and backoff, graceful signal shutdown, heartbeat warnings, SQLite samples/health/alert outbox through one Store interface, status pacing, history, threshold crossing with unique dedupe keys, retries and ordered fallback across free notification channels.

## Verified

- 60 tests passed across core, adapters, CLI, storage, delivery and pacing at this gate.
- Build, TypeScript checks and ESLint passed; `npm audit --omit=dev` reported zero known production vulnerabilities.
- Packed `cliffwatch@0.1.0`, installed its tarball in a separate scratch directory, ran `npx --no-install cliffwatch --help`, and opened the packaged SQLite module against an in-memory database.
- A repeated above-threshold poll produces one alert; reopening the same database and polling again still produces one.
- New reset periods and credit top-ups/refills can cross again; stale gaps and decreases do not create false crossings.
- Two simulated channel failures move a durable pending alert to the next configured channel. The delivery claim prevents simultaneous workers from selecting the same due alert.
- The CLI daemon `--once` and history command ran against a temporary SQLite database. A real local HTTP receiver verified test-alert in M1.

## Current behavior and limitations

- This machine's Codex App Server still reports a 300-minute quota with a reset farther than 300 minutes away, so the adapter returns UNKNOWN instead of presenting a suspect OK. The cause is UNVERIFIED.
- No OpenRouter key is configured here; authenticated success remains UNVERIFIED.
- Desktop notification success is UNVERIFIED in a graphical session; tests verify other channel request contracts with mocked transport.
- End-to-end external provider and remote alert delivery has not been claimed. SQLite is local and no public npm package has been published.
- No dashboard yet (M3). M4 owns README polish, MIT license, CI, release check and npm distribution.

The supplied build brief requests a gate pause here. M3 begins on continue.
