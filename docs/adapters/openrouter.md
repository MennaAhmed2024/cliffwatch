# OpenRouter feasibility spike — 2026-10-21

## M1 update

Implemented read-only /key (default) and /credits (explicit account scope), bounded responses, timeout and status error mapping. Authenticated successes remain UNVERIFIED; unit success cases are labeled synthetic. Finite non-resetting key budgets are supported; resetting key budgets return unknown until window semantics are validated. A real 401 fixture is exercised through the adapter request boundary. Provider response bodies and credentials are never included in error messages.

## Evidence

[Credits API](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits) documents GET /api/v1/credits, total_credits and total_usage, and currently requires a management key. A normal inference key must not be assumed sufficient. Remaining account credit is total_credits minus total_usage. A credit balance has no inferred daily reset.

[Limits documentation](https://openrouter.ai/docs/api_reference/limits) distinguishes account credit, key/budget restrictions and request limits. GET /api/v1/key is the documented fallback for key-scoped limits; it is not interchangeable with account-wide credit. Rate-limit headers are documented on error responses, not guaranteed on every credits response.

OPENROUTER_API_KEY was absent from this process. Made one real unauthenticated GET to /api/v1/credits: HTTP 401 with an error JSON body. Captured ../../packages/cli/src/fixtures/openrouter-real-401.json, retaining status, capture time, body and an allowlist of content-type/rate-limit/retry headers. No rate-limit or retry headers were observed. No generation calls or purchases were made.

## Verdict and fallback

Documented source available; successful authenticated response, key permissions and real rate-limit headers remain UNVERIFIED. No success fixture was invented. M1 can implement missing-key and 401 handling against real evidence; successful integration requires a configured credential supplied through an environment reference, never pasted into documentation.

Prefer /key for ordinary keys with explicitly labeled key scope and finite limits. Use /credits only when configured with appropriate permission; account credits alone cannot certify all requests will succeed. Missing/zero denominator, unlimited key limits, invalid fields and unsupported quota dimensions yield unknown percentage, not 0%. Do not invent daily request usage from dollar spending. Failed authentication, timeout, 429, 403 and malformed JSON must produce unknown with bounded retry and useful reason.

Credit top-ups change the percentage denominator: estimate credit exhaustion from absolute spend deltas, not percentage deltas. Non-resetting credit also requires a persisted baseline/period identity for alert dedupe; an absent resetsAt is not a timestamp. These are M1/M2 design requirements, not implemented behavior.
