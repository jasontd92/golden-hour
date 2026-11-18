# WS4 — App shell, PWA, Today, Week

## Scope
- Tab bar shell (Today, Week, Progress) with safe areas and the translucent bar, per README § Design and `.sprint/design/P2Today.dc.html` / `P2Week.dc.html`.
- PWA:
  - manifest (name "Golden Hour", `theme_color` and `background_color` set to `#06090b`, standalone, icons)
  - a service worker that precaches the app shell and the current plan JSON, so Today opens offline
  - use SvelteKit's `src/service-worker.ts`, no extra library
- Plan source: `PlanSession` files loaded at build time from `fixtures/plan/` (later the debate's output directory). Today's date picks the session. Before the plan starts (2026-12-07), show the first session with its date.
- Today:
  - block rows that expand on tap (one open at a time)
  - hard dot
  - "Why this session" disclosure
  - Start links to the log flow (WS5). Until WS5 lands, Start is hidden behind a feature flag in `features.yaml`.
- Week: seven rows, today highlighted, tap a row for that day's session view.

## Acceptance criteria
- [x] e2e on both mobile projects: Today renders the session title from the fixture; tapping a block expands its prescription; tapping again collapses it (mechanical, with screenshots).
- [x] e2e: with offline set (`context.setOffline(true)`) after the first load, a reload still renders Today (mechanical).
- [x] Lighthouse PWA installability passes, or the manifest and service worker are present and valid (mechanical: run Lighthouse CI or assert the manifest fields).
- [x] `features.yaml` has today and week entries (mechanical: check-features).
- [ ] HUMAN: CEO installs to the iPhone home screen. It opens full screen, and the status bar matches.

## Risks
iOS PWA quirks (standalone safe areas, service-worker update timing). Use `skipWaiting` only with a reload prompt, and never mid-session.
