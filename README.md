# QuotaDog

A local-first quota watchdog for AI coding tools: status, persistent pacing and threshold alerts.

**Current state: M2 CLI and daemon. Runnable locally; not published to npm.**

## Run

From this directory, with Node 22.13+ for development tooling (CLI runtime supports Node 20+):

```sh
npm ci
npm run build
npm exec --workspace=quotadog -- quotadog status
npm exec --workspace=quotadog -- quotadog status --json
npm exec --workspace=quotadog -- quotadog daemon
npm exec --workspace=quotadog -- quotadog history codex
```

Codex must be installed and signed in. Missing configuration uses defaults; missing provider credentials or suspect data display UNKNOWN and status exits 0. Invalid config/arguments and failed test-alert exit 1. Copy config.example.yaml to ~/.quotadog/config.yaml to customize. Keys and webhook URLs are environment-variable references, never literal secrets in YAML. Windows command must point to an executable, not a .cmd shell wrapper.

```sh
npm exec --workspace=quotadog -- quotadog test-alert
npm test
npm run typecheck
npm run lint
```

test-alert sends a real notification to the first configured channel. Supported free channels: generic webhook, ntfy, Telegram, Discord and desktop notification. No external destination was configured during development; webhook delivery is verified against a real local HTTP receiver. The daemon polls every five minutes by default, stores samples in SQLite, persists pending/delivered alerts, retries failures with bounded backoff and moves to the next channel after two failed attempts. Use `daemon --once` for one polling cycle. The dashboard arrives in M3.

## Honest status

No telemetry, no inference calls, no provider-account mutations. Configured provider reads and opt-in webhooks use the network. Status reports only the labeled quota scope. OpenRouter credit does not imply every request budget is healthy. Current success contracts for OpenRouter use synthetic tests and remain UNVERIFIED against authenticated service responses.

Pacing calculates a 7-day burn and a last-6h burn from persisted samples. It reports the ETA each produces and identifies the faster one. It requires at least 80% observed coverage of each horizon; sparse history stays unknown. Weekly status also shows today's UTC burn against the remaining daily allowance when coverage is sufficient. Codex uses provider resets but rejects expired or longer-than-window timing as suspect. File mode retains original event timestamps; historical data cannot become fresh through rereading.

Samples and alert state live at `~/.quotadog/quotadog.sqlite` unless `dataFile` overrides it. The daemon logs a warning at startup when the previous heartbeat is older than two intervals. SQLite uniqueness suppresses repeat threshold alerts within a reset period; a new credit refill/top-up starts a new period. External delivery is at least once: a crash after an external channel accepts a message but before SQLite marks it delivered can cause a duplicate. Keep webhook consumers idempotent where possible.

For a local Codex JSONL file, set providers.codex.source to file and providers.codex.file to its path. The conservative parser rejects incomplete lines and files over 8 MiB. Live mode is the default; no automatic scan or silent fallback conceals a live-source failure.

The project has no configured remote issue tracker yet, so UNKNOWN points to local adapter documentation rather than a fabricated issue URL. Public `npx quotadog status` is not a release claim; publishing and registry-name checks belong to M4.

See [M0 report](M0-REPORT.md), [Codex findings](docs/adapters/codex.md), [OpenRouter findings](docs/adapters/openrouter.md) and [decisions](DECISIONS.md).

Real sanitized fixtures are under packages/cli/src/fixtures. Codex samples are historical; OpenRouter contains an actual authentication failure, not an authenticated success.
