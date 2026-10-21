# QuotaDog CLI — M1

Commands: `quotadog status [--json] [--config PATH]` and `quotadog test-alert [--config PATH]`.

Node 20+ runtime. Codex live mode requires the signed-in Codex executable on PATH (or a configured executable path). OpenRouter reads OPENROUTER_API_KEY by default. Missing credentials produce UNKNOWN; monitoring does not require paid inference.

Default configuration is optional at ~/.quotadog/config.yaml. A webhook needs channels with type: webhook and urlEnv naming its URL environment variable. test-alert sends one real JSON POST to the first channel. Only HTTPS is allowed except numeric loopback HTTP for local testing. No retries/fallback until M2.

No daemon, database, history or dashboard yet. Pacing is unknown in status until historical storage arrives. No telemetry. Provider polling and configured webhook delivery use the network; credentials are sent only to their intended endpoint. Account credit status does not describe all provider budget/rate limits.
