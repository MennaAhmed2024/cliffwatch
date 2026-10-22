# QuotaDog

Local-first quota status, pacing, alerts and a loopback-only dashboard for Codex CLI and OpenRouter.

After publication, run `npx quotadog status`. The package is currently a local release candidate and is not yet published to npm. Commands: `status`, `daemon`, `history`, `test-alert`, `dashboard`; each accepts `--config PATH`. Configuration defaults to `~/.quotadog/config.yaml`, with secrets referenced by environment variable name. The dashboard requires Node 20.9+ and listens on `127.0.0.1`.

No telemetry or provider-account mutations. Missing or stale quota data is reported as `UNKNOWN`.

MIT licensed. See the repository's full README and adapter documentation before interpreting provider limits.
