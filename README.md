# QuotaDog

A local-first quota watchdog for AI coding tools: status now, persistent pacing and crossing alerts in M2.

**Current state: M1 CLI. Runnable locally; not published to npm.**

## Run

From this directory, with Node 22.13+ for development tooling (CLI runtime supports Node 20+):

```sh
npm ci
npm run build
npm exec --workspace=quotadog -- quotadog status
npm exec --workspace=quotadog -- quotadog status --json
```

Codex must be installed and signed in. Missing configuration uses defaults; missing provider credentials or suspect data display UNKNOWN and status exits 0. Invalid config/arguments and failed test-alert exit 1. Copy config.example.yaml to ~/.quotadog/config.yaml to customize. Keys and webhook URLs are environment-variable references, never literal secrets in YAML. Windows command must point to an executable, not a .cmd shell wrapper.

```sh
npm exec --workspace=quotadog -- quotadog test-alert
npm test
npm run typecheck
npm run lint
```

test-alert posts a real JSON notification to the first configured generic webhook. No external destination was configured during development; delivery is verified against a real local HTTP receiver. Other channels, retry/fallback, SQLite, daemon, history and dashboard arrive later.

## Honest status

No telemetry, no inference calls, no provider-account mutations. Configured provider reads and opt-in webhooks use the network. Status reports only the labeled quota scope. OpenRouter credit does not imply every request budget is healthy. Current success contracts for OpenRouter use synthetic tests and remain UNVERIFIED against authenticated service responses.

Pacing calculations are implemented and tested independently; CLI pacing stays unknown until M2 supplies historical data. Codex uses authoritative resets but rejects expired or longer-than-window timing as suspect. File mode retains original event timestamps; historical data cannot become fresh through rereading.

For a local Codex JSONL file, set providers.codex.source to file and providers.codex.file to its path. The conservative parser rejects incomplete lines and files over 8 MiB. Live mode is the default; no automatic scan or silent fallback conceals a live-source failure.

The project has no configured remote issue tracker yet, so UNKNOWN points to local adapter documentation rather than a fabricated issue URL. Public `npx quotadog status` is not a release claim; publishing and registry-name checks belong to M4.

See [M0 report](M0-REPORT.md), [Codex findings](docs/adapters/codex.md), [OpenRouter findings](docs/adapters/openrouter.md) and [decisions](DECISIONS.md).

Real sanitized fixtures are under packages/cli/src/fixtures. Codex samples are historical; OpenRouter contains an actual authentication failure, not an authenticated success.
