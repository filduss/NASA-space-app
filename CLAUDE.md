# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shipshape is a NASA Space Apps Challenge entry: a crew check-in for long missions that says whether a bad day is "likely you" or "likely the ship". It is a static Vite + React + TypeScript web app, installable and offline-capable, with no backend and no AI model in the product. A PIN login runs entirely in the browser.

`docs/SPEC.md` is the source of truth for the rules, the JSON shapes, and the "Readings of the plan" (places where the build chose one interpretation of the plan). Read it before changing engine behavior, and update it in the same change.

## Commands

```bash
npm install
npm run dev                      # http://localhost:5173 is the login; demo PINs in README (Anna 1111 … Dana 4444, Mira 5555 on Earth)
npm test                         # vitest, all tests
npx vitest run tests/engine.test.ts          # one file
npx vitest run -t "held"                     # tests whose name matches
npm run typecheck                # tsc -b
npm run build                    # tsc -b && vite build (also generates the service worker)

npm run data:snapshot            # download ISS telemetry from NASA OSDR (needs network), write snapshots + checksums
npm run data:crew                # regenerate public/data/crew.json (seeded demo crew)
npm run data:backtest            # regenerate public/data/backtest.json
npm run data:accounts            # regenerate public/data/accounts.json (demo PIN hashes; new salts each run)
python3 scripts/snapshot_eda.py --verify     # check data files against scripts/snapshots/SHA256SUMS
```

There is no linter. CI (`.github/workflows/ci.yml`) runs `npm test`, `npm run build` and the checksum verify.

Imports use explicit `.ts`/`.tsx` extensions, and `erasableSyntaxOnly` is on (no enums, no parameter properties).

## Architecture

Data flows one way: Python scripts produce static JSON, the engine turns it into per-day results, the privacy helpers filter those results per viewer, and the UI draws them.

```
scripts/*.py ──> public/data/{cabin,crew,backtest}.json ──> src/state.tsx ──> runEngine ──> privacy.ts ──> src/ui, src/dashboard
```

### Engine (`src/engine/`)

Pure functions with no React and no I/O. `runEngine(input)` in `escalation.ts` returns one `DayResult` per day by composing:

- `baseline.ts` and `deviation.ts`: each person's own normal (robust median/MAD), their starting normal (first 14 check-ins, for slow changes in mood and stress), and which indicators drift.
- `shipOrMe.ts`: cabin status and the ship / me / shared decision.
- `escalation.ts`: episodes, day counts and tiers 0–4, flight-surgeon summaries.
- `privacy.ts`: the only path from engine output to another viewer's screen. UI code must not read another person's `PersonStatus` directly.
- `gravity.ts` and `mission.ts`: shown, never judged. Exercise against its daily target (the core and limbs zones on the dashboard) and the radiation dose budget; neither has a tier or any part in ship or me.

Every threshold lives in `config.ts` as `RULES`, each either cited or labeled a "demo parameter". Do not put rule numbers anywhere else.

### One rules implementation, shared with Python

`scripts/shipshape_sim.py:run_engine` shells out to `npx tsx scripts/engine_cli.ts`, so the demo-crew seed search (`simulate_crew.py`) and the backtest (`backtest.py`) run the real TypeScript engine. Consequences:

- Changing engine rules or `RULES` changes which seed produces the scripted demo path and changes the backtest numbers. After such a change, re-run `npm run data:crew` and `npm run data:backtest`, then check the golden path still holds.
- Regenerating any data file updates `scripts/snapshots/SHA256SUMS`; CI fails if committed data and checksums disagree.
- `scripts/.cache/` (raw API responses) is gitignored; `scripts/snapshots/*_hourly.json` is committed.

### State and UI

`src/state.tsx` (`StoreProvider` / `useStore`) loads the four JSON files (including `accounts.json`), holds the logged-in `user`, merges live check-ins, runs the engine, and holds the demo controls (role, mission day, comm delay). Live check-ins and conference requests persist only in `localStorage` under `shipshape.v1`; live reaction-test results stay in memory and are never stored. The check-in's form logic is `src/ui/checkInForm.ts` (answers start unset). The simulated wearable (`src/data/wearable.ts`) reads the simulated crew record for that person and day: sleep duration and exercise come from it, never from the form, and its vitals (`CheckIn.watch`: heart rate, HRV, blood oxygen, breathing, skin temperature) are shown for information. No rule may read `watch`; a test checks it.

`src/main.tsx` picks one of five pages by pathname (`src/auth/paths.ts`), without a router:

- `/` → `src/auth/Login.tsx`: pick a crew member and enter a 4-digit PIN on the on-screen keypad or a keyboard; the fourth digit submits. Beside the login sits the judge's tour as help (`TOUR` in `src/auth/demo.ts`: one-click links that log in with a public demo PIN, via `auth/TourLink.tsx`).
- `/challenge` → `src/ui/Challenge.tsx`: the public challenge page (five questions, backtest evidence, Antarctic case). No login; its buttons are tour links.
- `/dashboard` → `src/dashboard/`: the logged-in person's own dashboard with a three.js skeleton point cloud (`public/models/skeleton.glb`), lazy-loaded. `dashboard/model.ts` maps engine output to body-zone levels and notices; it must not introduce rules of its own. The crew app reuses its `cabinLevel` / `indicatorLevel`, so orange (watch) and red (alert) mean the same on both pages.
- `/checkin` → `App.tsx` + `src/ui/`: a crew member's own check-in and Me (status and trends), for astronauts and the medical officer, always as themselves.
- `/app` → `App.tsx` + `src/ui/`: the crew app, which is the medical console, for the medical officer and the flight surgeon only. Astronauts cannot open it. Tabs depend on the view: `viewsFor(user, page)` in `auth/session.ts` gives the medical officer the crew medical officer, and the flight surgeon the flight surgeon, who sees everything the crew medical officer sees plus Summaries. Nobody views as another crew member. `?day=`, `?screen=` and `?mission=` are read once in `state.tsx`. The crew board uses `ui/CrewTimeline.tsx`, filled per viewer by `crewTimeline` in `privacy.ts`; times on the Earth side use `ui/clock.ts` (ship time UTC, Houston).

The golden path the demo depends on is mission days 212 → 213 → 221 → 223, the same on both pages (table in `docs/SPEC.md`; `tests/golden.test.ts` pins it on the committed data). The crew is seed 402 with scripted events recorded in `crew.json`.

### Login (`src/auth/`)

A privacy gate with no server behind it, not security. `docs/SPEC.md` "Login" has the access table and the stated limits.

- `pin.ts` checks a PIN with Web Crypto PBKDF2 against the salted hash in `public/data/accounts.json`. `session.ts` holds the session (sessionStorage: crew id and expiry only), the wrong-PIN lockout (localStorage) and `mayOpen(user, page)`.
- The role always comes from `accounts.json`, re-read on every load; the session carries only who is logged in.
- `RequireUser page=…` wraps `/dashboard`, `/checkin` and `/app`; a person who may not open a page goes to `homePage(user)`. A new page needs a `Page` in `paths.ts` (type, `PAGE_PATHS`, `pageOf`; that list is also the `?next=` allowlist) and a rule in `mayOpen`.
- Roles: `astronaut` and `medical` are crew; `surgeon` is Earth staff with no dashboard and no check-in. Earth accounts have an id outside `crew.json` and a `name` in `accounts.json`; `nameOf` covers both.
- Log out through the store's `logOut`, which ends the session and loads a clean login. Clearing `user` in state instead lets `RequireUser` redirect first, with a `?next=` back to the page.
- sessionStorage is per tab: every new tab or browser context logs in again, including in browser automation.
- The demo PINs live in three places that change together: `DEMO_ACCOUNTS` and `EARTH_ACCOUNTS` in `scripts/make_accounts.py`, `DEMO_PINS` in `src/auth/demo.ts` (person cards and the tour; the tests import it), and the README table. `make_accounts.py` refuses to run unless `DEMO_ACCOUNTS` matches the crew ids in `crew.json` and no Earth id reuses one. Each run draws new salts, so `accounts.json` and its checksum change even when nothing else did.

## Project constraints

These come from the plan and are easy to break by accident:

- **Never rescale or repair real data.** Cabin CO₂ is ISS telemetry (mission RR-7) converted from ppm to mmHg and averaged, nothing else. Invalid samples are dropped, not fixed. Real dates are only relabeled as mission days.
- **Label simulated data everywhere.** Every screen showing the crew carries the "simulated" marker; real data carries its source.
- **The app says "likely" and never diagnoses.** No AI-generated text in decisions or summaries; summaries come from fixed templates.
- **Each dashboard and check-in shows only the logged-in person.** The crew app (`/app`) is for the medical officer (as the crew medical officer) and the flight surgeon (the same access, plus summaries); everyone else's data reaches it through `privacy.ts`.
- **Mood and stress are private.** They appear on the crew board only as a count with no names, and never count toward a ship alert. Only headache among symptoms counts toward one.
- **No game.** XP, streaks and quests were removed. Do not add points, rankings, rewards or celebrations.
- **Sources:** `docs/CITATIONS.md` tracks whether a human has opened each source. Do not mark one as checked or add a sourced claim to UI text unless it has been verified. Log AI contributions in `docs/AI_USE_LOG.md`.
- Charts follow one-series, one-axis conventions with status shown by shape and word as well as color, and need to work at 390 px width. Every page is dark only, with `/dashboard` as the colour reference: `src/styles.css` (crew app) uses the same values as the `--d-*` tokens in `dashboard.css`.
