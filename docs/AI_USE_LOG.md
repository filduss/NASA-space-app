# AI use log

| Date | Tool | Used for | Human check |
| --- | --- | --- | --- |
| 14 Nov 2026 | Claude (plan v0.1) | Drafting the overall plan and finding sources by web search | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Fable 5.2) | Building the MVP on branch `mvp`: rules engine, game rules, unit tests, data scripts, the seven screens, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | PIN login on branch `personal-dashboard`: `src/auth/`, `scripts/make_accounts.py`, dashboard per logged-in person, crew app limited to the medical officer, tests, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Crew app (`/app`) restyled to match the personal dashboard: dark only with the dashboard's palette, orange / red sections taken from `dashboard/model.ts` levels | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Crew timeline (`ui/CrewTimeline.tsx`, `crewTimeline` in `privacy.ts`) replacing the body sketches; flight-surgeon login (Mira) with the Earth view and Houston times; tests, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Expandable dashboard charts: a chart sheet with time ranges (vitals 7D / 14D / 30D / All, cabin CO₂ 1D / 7D / 30D / All), flagged days taken from the engine's own levels, `dashboard/history.ts` and its tests | Team review pending |

## What AI does not do in the product

- No AI model runs in the app. The ship-or-me decision, tiers and summaries are plain rules and fixed templates.
- No AI-generated data is presented as real. The crew is produced by a seeded simulator (`scripts/shipshape_sim.py`) and labeled as simulated on every screen.
- The cabin CO₂ is real NASA data, downloaded by `scripts/snapshot_eda.py` and stored with checksums.

## To check by hand

- Each source in `docs/CITATIONS.md` (none opened yet).
- The readings of the plan listed in `docs/SPEC.md`.
- The wording of cards and summaries in `src/ui/text.ts` and `src/ui/Medical.tsx`.
