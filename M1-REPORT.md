# CliffWatch — M1 gate

Implemented status, optional validated YAML configuration, Codex live/file adapters, OpenRouter key/account adapters, generic webhook test-alert, pure window/pacing functions and a distributable local npm package.

## Verification

- 47 Vitest tests: real sanitized Codex historical/live contracts, real OpenRouter 401, explicitly synthetic success cases, malformed/stale/future data, UTC/leap-year/year-end boundaries, reset discontinuities, dual ETA and budgets, HTTP failure/size handling, config validation.
- Failure injection: a spawned CLI reads garbled JSON, prints UNKNOWN without OK, and exits 0.
- Notification: a spawned CLI sends a real POST to an ephemeral loopback HTTP server and verifies received JSON.
- Build, TypeScript checks and ESLint passed. Dependency audit after updating test tooling: zero vulnerabilities.
- Actual Codex initialization and quota read succeeded; no inference or mutation RPCs.
- Local tarball installed into a separate scratch directory with only its production dependencies; npx --no-install cliffwatch status --json worked.

## Current machine results / open risks

- Codex returns a 300-minute window whose reset was more than 300 minutes away. Status deliberately returns UNKNOWN: timing suspect. The cause remains UNVERIFIED; no timestamps are adjusted to manufacture healthy output.
- No OpenRouter environment key is available. Authenticated success and real account/key permissions remain UNVERIFIED. Status honestly reports the missing key.
- The real webhook path is verified locally; no external destination was configured or messaged.
- No public repository issue URL exists. Unknown states point to adapter findings rather than an invented tracker link.
- Codex npm .cmd wrappers are not launched through a shell: Windows users need a native executable path when codex.exe is not on PATH.
- Both Codex window fields are required in this initial adapter; unsupported/missing windows fail closed. Other plan shapes need real fixtures before widening support.

## Deferred, not stubbed

M2 owns SQLite, daemon polling/backoff/heartbeat, history, crossing detection, dedupe and notification retries/fallback. Status pace is explicitly unknown; tested pure pacing functions are not presented as live historical predictions. M3 owns dashboard. M4 owns publication and CI/release checks. No registry publication or claim that public npx cliffwatch resolves to this project.

Ready for the M1 gate with these integration limitations disclosed. Wait for continue before M2.
