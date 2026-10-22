# M3 gate — local dashboard

## Works

- `quotadog dashboard [--config PATH]` launches the packaged Next.js standalone server on `127.0.0.1`, using `dashboardPort` from the local config. `npm run dev` launches the same app for development after CLI build.
- Overview reads the same SQLite as the daemon, shows provider/window cards, global worst state, last probe time, used/remaining percentages, reset time and pacing. It refreshes every 30 seconds.
- History shows seven-day per-metric line charts and the latest 100 alert events. Settings shows safe configuration metadata and a user-triggered test-alert action. Secret values stay server-side.
- Stale health, stale samples, expired reset windows, missing data and read failures render `UNKNOWN` without a green percentage. A synthetic fresh 42.5% sample rendered OK; aging its health record immediately changed the same card to UNKNOWN.
- Loopback binding, strict Host rejection and same-origin POST validation protect local reads and test-alert. Next telemetry is disabled. Lenis and GSAP are client-only and disabled for reduced motion.
- The screenshot at [docs/screenshots/m3-overview-fixture.png](docs/screenshots/m3-overview-fixture.png) uses a synthetic sample, not live provider data.

## Changed from requested UI libraries

React Bits source was removed after reviewing its current MIT + Commons Clause license, which restricts redistribution of the components themselves in open-source repositories. QuotaDog ships an original restrained spotlight hover component. Lenis and GSAP remain integrated.

## Verification

- `npm run build:dashboard`: passed; standalone bundle includes native SQLite binary and static assets.
- `npm run typecheck`, `npm run lint`, `npm test`: passed, 62 tests.
- HTTP smoke on packaged standalone: Overview, History and Settings returned 200; foreign Host and cross-origin test-alert returned 403; no-data returned UNKNOWN.
- Synthetic-data smoke: fresh 42.5% displayed OK; stale health produced UNKNOWN, with the percentage suppressed.
- npm tarball: approximately 6.9 MB compressed, 26.5 MB unpacked. A clean Windows install succeeded; its CLI help and status ran, and its packaged dashboard served the overview on port 3001. A same-origin test-alert request returned a controlled 502 because the synthetic config had no channel. With a local test webhook configured, the packaged dashboard delivered exactly one test alert.

## Stubbed / UNVERIFIED / risks

- No browser notification is sent automatically; test-alert requires a configured channel and explicit click.
- No authenticated OpenRouter success fixture or verified Codex quota semantics yet; the dashboard inherits adapter UNKNOWN behavior.
- Clean Node 20 installation and cross-platform native SQLite package builds remain UNVERIFIED. The standalone bundle is platform-specific and must be built per release target.
- No hosted mode, auth, team sync or dark mode; those are outside v1.

Stop at M3 gate. M4 packaging and release work starts after the next explicit continue.
