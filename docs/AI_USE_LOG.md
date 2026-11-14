# AI use log

| Date | Tool | Used for | Human check |
| --- | --- | --- | --- |
| 14 Nov 2026 | Claude (plan v0.1) | Drafting the overall plan and finding sources by web search | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Fable 5.2) | Building the MVP on branch `mvp`: rules engine, game rules, unit tests, data scripts, the seven screens, docs | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Mission setting (ISS, lunar surface, Mars transit) and the radiation card, branch `mission-setting-radiation`: `src/engine/mission.ts`, `src/ui/Radiation.tsx`, tests, docs. Radiation sources found by web search; the NASA brief and NTRS paper were read | Team review pending |
| 14 Nov 2026 | Claude Code (Claude Opus 5.5) | Branch `ship-limit-followups`: the 3 mmHg limit in the ship-or-me rule (chosen by backtest), the alert-load comparison with one alert per person, the "Did the fix work?" follow-up, and checking the lunar and Mars dose papers | Team review pending |

## What AI does not do in the product

- No AI model runs in the app. The ship-or-me decision, tiers and summaries are plain rules and fixed templates.
- No AI-generated data is presented as real. The crew is produced by a seeded simulator (`scripts/shipshape_sim.py`) and labeled as simulated on every screen.
- The cabin CO₂ is real NASA data, downloaded by `scripts/snapshot_eda.py` and stored with checksums.

## To check by hand

- Each source in `docs/CITATIONS.md` (none opened yet).
- The readings of the plan listed in `docs/SPEC.md`.
- The wording of cards and summaries in `src/ui/text.ts` and `src/ui/Medical.tsx`.
- The Mars cruise dose rate in `src/engine/mission.ts`: only the abstract of Zeitlin et al. 2013 was read; the per-day figure comes from the press release (see `docs/CITATIONS.md`).
