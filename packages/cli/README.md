# QuotaDog CLI — M2

Commands: `quotadog status [--json] [--config PATH]`, `quotadog daemon [--once] [--config PATH]`, `quotadog history [provider] [--json] [--config PATH]`, and `quotadog test-alert [--config PATH]`.

Node 20+ runtime. Codex live mode requires the signed-in Codex executable on PATH (or a configured executable path). OpenRouter reads OPENROUTER_API_KEY by default. Missing credentials produce UNKNOWN; monitoring does not require paid inference.

Default configuration is optional at ~/.quotadog/config.yaml. Channels can be webhook, ntfy, Telegram, Discord or desktop. Secrets are environment variable references. test-alert sends one real message to the first channel. Only HTTPS is allowed except numeric loopback HTTP for local testing. Daemon alerts retry and move to fallback channels in configuration order.

SQLite stores samples, health, heartbeat and an alert outbox. Pacing remains unknown until enough observed history exists. Dashboard arrives in M3. No telemetry. Provider polling and configured remote alert delivery use the network; credentials are sent only to their intended endpoint. Account credit status does not describe all provider budget/rate limits.
