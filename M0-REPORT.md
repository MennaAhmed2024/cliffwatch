# CliffWatch — M0 gate report

Research completed on 2026-10-21. Both providers have a documented source or explicit fallback. This is a conditional feasibility result, not a working product or proof of successful live integration.

## Delivered

- Codex local data inspection and three sanitized real historical quota events.
- OpenRouter official source/permission findings and a real unauthenticated 401 fixture.
- Adapter findings, freshness/reset rules and engineering trade-offs in DECISIONS.md.

## Not implemented / not verified

- No adapters, CLI, daemon, dashboard, npm package or tests yet; no fake success stubs.
- Codex live App Server handshake/read compatibility remains UNVERIFIED.
- OpenRouter authenticated success and quota headers remain UNVERIFIED because no environment key was available.
- Codex first-message/weekly anchoring is not established by the sample; provider reset timestamps are authoritative.

## Main risks before M1

1. A local log read must retain source age; historical fixtures must never become current status.
2. /credits requires a management key according to current documentation; ordinary keys need /key with explicit scope.
3. Account credit is not a complete view of every budget or request cap.
4. The specification needs explicit networking exceptions for provider reads and selected remote alerts.
5. npm publication/name availability and clean-machine install will require separate release verification; nothing was published.

## Next milestone

On continue: build M1 status, configuration, one real alert path, fixture contracts and pure window/pacing tests. Validate the Codex live protocol first. Keep OpenRouter successful integration marked unverified until a suitable local environment key is configured. Do not send a real external test alert until the user has selected a destination.
