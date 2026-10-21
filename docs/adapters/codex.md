# Codex feasibility spike — 2026-10-21

## M1 update

Verified initialize → initialized → account/rateLimits/read against the installed executable. No inference or write RPCs were invoked. The real sanitized live capture is codex-live-real-sanitized.json in the fixture directory (account identifiers and unrelated metadata excluded). It reports a reset farther away than its 300-minute duration, so the runtime marks it UNKNOWN with a timing reason. The fixture intentionally proves fail-closed behavior, not a current healthy reading. Why this timing occurs remains UNVERIFIED. Runtime explicitly disables App Server analytics and OTEL export for its subprocess.

## Observed locally

Inspected directory entries under the default Codex home, auth field names only, relevant config key names, and quota events in recent session JSONL files. No credentials or conversation text were copied. Auth has auth_mode, OPENAI_API_KEY, tokens, last_refresh; auth is not a quota source. No matching status/quota/limit/auth config assignments were found by the targeted scan. SQLite databases exist but their private schema was not inspected.

Found 106 token_count events containing rate_limits in one readable session. Three consecutive real events are captured in ../../packages/cli/src/fixtures/codex-real-sanitized.json. Projection retains timestamp, event type and rate_limits only; removes token details, messages, paths and identifiers. Percentages and reset timestamps are unchanged. The newest captured event is 2026-10-16T12:39:02.805Z, so these are historical fixtures, not current status. Search was bounded to eight recent files and stopped after a readable match; this is not an exhaustive newest-record guarantee. One active session file failed with a sharing violation.

Observed primary.window_minutes=300 and secondary.window_minutes=10080, used_percent, and resets_at (epoch seconds). Preserve limit_id to avoid mixing buckets. Null limits are unknown, not zero. Never derive account quota from session token counts or assumed plan limits.

## Documented source and recommended approach

[Official App Server documentation](https://learn.chatgpt.com/docs/app-server) documents account/rateLimits/read and account/rateLimits/updated. Prefer the multi-bucket rateLimitsByLimitId response when available. Fields usedPercent, windowDurationMins and resetsAt supply usage, duration and reset time. This is the preferred fresh-read integration; local CLI protocol compatibility remains UNVERIFIED in this spike.

Fallback: parse local session events, retaining the event timestamp as source freshness. A fresh file read does not make an old event fresh. Add sourceObservedAt alongside probe observedAt; reject sources older than two polling cycles, future timestamps, invalid percentages, malformed payloads and expired reset periods. Handle locked files, truncated trailing lines and bounded reads explicitly. If no valid fresh event exists, return unknown with a reason.

## Reset semantics

Use the provider reset instant. First-message anchoring and exact weekly start semantics are UNVERIFIED by this sample; do not fabricate resets from local time or Monday midnight. A pure firstUse+5h function can exist only when firstUse is actually known. Map windows by duration, not primary/secondary position. Unexpected durations must remain identifiable.

## Verdict

Feasible with verified local historical evidence and a documented live protocol. Unattended fresh polling through App Server needs an integration test in M1. Local-log-only mode cannot promise fresh status when Codex is idle. No adapter implementation or live successful protocol fixture yet.
