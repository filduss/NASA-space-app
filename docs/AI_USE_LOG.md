# AI use log

| Date | Tool | Used for | Human check |
| --- | --- | --- | --- |
| 14 Nov 2026 | Claude (plan v0.1) | Drafting the overall plan and finding sources by web search | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Fable 5.2) | Building the MVP on branch `mvp`: rules engine, game rules, unit tests, data scripts, the seven screens, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Mission setting (ISS, lunar surface, Mars transit) and the radiation card, branch `mission-setting-radiation`: `src/engine/mission.ts`, `src/ui/Radiation.tsx`, tests, docs. Radiation sources found by web search; the NASA brief and NTRS paper were read | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Branch `ship-limit-followups`: the 3 mmHg limit in the ship-or-me rule (chosen by backtest), the alert-load comparison with one alert per person, the "Did the fix work?" follow-up, and checking the lunar and Mars dose papers | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | PIN login on branch `personal-dashboard`: `src/auth/`, `scripts/make_accounts.py`, dashboard per logged-in person, crew app limited to the medical officer, tests, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Crew app (`/app`) restyled to match the personal dashboard: dark only with the dashboard's palette, orange / red sections taken from `dashboard/model.ts` levels | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Crew timeline (`ui/CrewTimeline.tsx`, `crewTimeline` in `privacy.ts`) replacing the body sketches; flight-surgeon login (Mira) with the Earth view and Houston times; tests, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Expandable dashboard charts: a chart sheet with time ranges (vitals 7D / 14D / 30D / All, cabin CO₂ 1D / 7D / 30D / All), flagged days taken from the engine's own levels, `dashboard/history.ts` and its tests | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Merging `personal-dashboard` into `main`: conflicts resolved with the team member; comm delay in seconds on the timeline, summaries and dashboard; the crew app's header and intro use the mission setting | Team review pending |
| 15 Nov 2026 | Claude Code (Claude Opus 5.5) | Branch `judge-fixes`, after an independent AI judge review and an AI agent's read of rival entries' public repos (to choose what to fix; nothing copied): judge's tour and public challenge page; crew app views per role; slow-change check against the starting normal; backtest masking, slow-decline and under-reporting scenarios (a "late in the alert" rule was tried and dropped on that evidence); one set of demo days on both pages; evidence line on the Ship screen; check-in sliders that start unset; Bone & muscle panel; CO₂ data notes; sources found by web search listed as unchecked; tests, docs, screenshots | Team review pending |
| 15 Nov 2026 | Claude Code (Claude Opus 5.5) | After the team opened the sources: their claims on screen (CO₂ context on the Ship screen, the PVT-B lapse at 355 ms, NASA's bone-loss and daily-exercise figures), `docs/CITATIONS.md` updated, the live link in the README; merging `judge-fixes` into `main` | Team review pending |
| 15 Nov 2026 | Claude Code (Claude Opus 5.5) | Branch `dashboard-trim`: Cabin air and Bone & muscle panels removed from `/dashboard` (with the CO₂ chart sheet only they opened); body stage capped at 660px wide, skeleton size unchanged; docs | Team review pending |

## What AI does not do in the product

- No AI model runs in the app. The ship-or-me decision, tiers and summaries are plain rules and fixed templates.
- No AI-generated data is presented as real. The crew is produced by a seeded simulator (`scripts/shipshape_sim.py`) and labeled as simulated on every screen.
- The cabin CO₂ is real NASA data, downloaded by `scripts/snapshot_eda.py` and stored with checksums.

## To check by hand

- Each source in `docs/CITATIONS.md` still marked "No".
- The readings of the plan listed in `docs/SPEC.md`.
- The wording of cards and summaries in `src/ui/text.ts` and `src/ui/Medical.tsx`.
- The Mars cruise dose rate in `src/engine/mission.ts`: only the abstract of Zeitlin et al. 2013 was read; the per-day figure comes from the press release (see `docs/CITATIONS.md`).
