# Shipshape MVP spec (v0.1)

Shipshape is a crew check-in game for long missions. It compares each person with their own normal, checks the cabin air before blaming anyone, and rewards reporting, never the reading.

This file describes what the code on this branch does. Where the plan left room, the section "Readings of the plan" says which reading was built, so the team can steer.

## Decisions taken (plan v0.1, recommended options)

| # | Decision | Built |
| --- | --- | --- |
| 1 | Name | Shipshape |
| 2 | Hooks | Both: "Is it me, or the ship?" in the header, "rewards honesty, not perfection" in the footer and on check-in |
| 3 | Game depth | Full rules as tested functions; UI shows XP, weekly streak and one quest card |
| 4 | Mission setting | ISS, lunar surface or Mars transit (default), chosen in the demo controls. It changes the comm delay and the radiation card only. The CO₂ source (ISS) is stated on every screen |
| 5 | Board default | Sleep and symptoms shared; mood and stress private, shown as a count with no names |
| 6 | Live input | Live 30-second reaction test, kept in memory only |
| 7 | Wearable | None |
| 8 | AI | None. Summaries come from fixed templates |
| 9 | Demo format | Not built here: the app has a "Golden path" control with the four days a 30-second video needs |
| 10 | Earth use | Open: needs one use case with a sourced number |

## Data files

All data is static JSON in `public/data/`, produced by the Python scripts. Checksums are in `scripts/snapshots/SHA256SUMS`; `python3 scripts/snapshot_eda.py --verify` checks them.

### `cabin.json` (real)

ISS telemetry for the Rodent Research 7 payload from the NASA OSDR Environmental Data Application API.

```jsonc
{
  "meta": { "mission": "RR-7", "apiUrl": "...", "fetchedAt": "...", "rawSha256": "...", "conversion": "...",
            "replay": { "anchorDate": "2018-08-21", "anchorMissionDay": 213 } },
  "daily":  [{ "day": 213, "date": "2018-08-21", "hours": 24, "co2Mean": 4.321, "co2Max1h": 4.948, "temp": 22.6, "rh": 45.1 }],
  "hourly": [{ "t": "2018-08-20T08:00:00Z", "day": 213, "co2": 3.2, "temp": 22.6, "rh": 45 }]
}
```

- `co2Mean` is the mean over the 24 h before the 08:00 UTC check-in; null when fewer than 12 hours have data.
- CO₂ is published in ppm and converted with mmHg = ppm × 760 / 1e6. That is the only arithmetic besides averaging.
- Dropped, not repaired: samples under 400 ppm and runs of one identical value lasting 6 h or more (placeholders from before the hardware reached the station).
- The real dates are relabeled as mission days. Nothing else is shifted.

### `crew.json` (simulated)

```jsonc
{
  "meta": { "simulated": true, "seed": 402, "seedSearch": { "seedsTried": 402, "criteria": ["..."] } },
  "crew": [{ "id": "anna", "name": "Anna" }],
  "shieldDays": [{ "day": 200, "kind": "eva", "crewIds": ["anna", "dana"], "label": "Spacewalk" }],
  "checkIns": [{ "crewId": "anna", "day": 213, "sleepHours": 7, "sleepQuality": 7, "fatigue": 3, "irritability": 2,
                 "stress": 3, "mood": 7, "symptoms": ["headache"], "reactionMs": 262, "simulated": true }]
}
```

Sliders run 0-10. `symptoms` is any of `headache`, `dizziness`, `nausea`, `congestion`, `eye_strain`. A live check-in has `simulated: false`, `reactionMs: null` and may carry `safetyFlag: true`.

### `backtest.json` (simulated crews on real traces)

Scenarios with the four metrics, their definitions and the stated limits. See "Evidence".

### Engine output

`runEngine(input)` in `src/engine/escalation.ts` returns one `DayResult` per day: the cabin status, the ship-or-me decision, each person's status (indicators against their own normal, likely cause, day count, tier) and any flight-surgeon summaries. Types are in `src/engine/types.ts`.

## Rules

Every number is in `src/engine/config.ts`, either cited or labeled a demo parameter.

### Own normal

For each indicator, the baseline is the median of the person's last 14 usable check-ins within 28 days, with a robust spread (1.4826 × MAD). Days already judged off are left out, so a bad stretch does not become the new normal. Fewer than 7 usable days means "no baseline yet".

A reading drifts when it is 2.5 spreads from the median in the unwanted direction. The spread has a floor (0.5 h of sleep, 1 slider point, 4% of response speed).

| Indicator | Unwanted direction | Counts toward a ship alert | Board |
| --- | --- | --- | --- |
| Sleep duration | Low; also under 6 h on 3 of the last 7 nights | Yes | Shared |
| Sleep quality | Low | Yes | Shared |
| Fatigue | High | Yes | Shared |
| Irritability | High | Yes | Shared |
| Symptoms | Any tick | Headache only | Shared |
| Alertness (response speed) | Low | No | Shared |
| Stress | High | Never | Private |
| Mood | Low | Never | Private |

### Cabin

The cabin's baseline is the median of its last 14 normal days. The cabin is "above baseline" when the 24 h mean is 0.5 mmHg or more above it. Separately, a 1-hour average above 3 mmHg is flagged (NASA-STD-3001 Vol 2 [V2 6004]).

The air is a suspect when it is above baseline or its 24 h mean is over 3 mmHg. A cabin that stays high for weeks becomes its own baseline; the limit check keeps it a suspect.

### Ship or me

1. **Ship:** at least half the crew drift on CO₂-linked indicators today and the air is a suspect (above baseline, or a 24 h mean over 3 mmHg).
2. **Me:** one person drifts.
3. **Shared, not the air:** two or more drift, and the rule cannot blame the air.

### Tiers

| Tier | Trigger | Who sees it |
| --- | --- | --- |
| 0 | Nothing off | You |
| 1 | Any drift: a private Watch card | You |
| 2 | A ship alert or shared pattern, or a Watch you chose to share | Crew medical officer |
| 3 | Still off on day 3 of the same likely cause; again every 3 days | Flight surgeon, with the comm delay |
| 4 | The safety answer | Crew medical officer and flight surgeon, immediately; game paused |

### Privacy

`src/engine/privacy.ts` is the only path from engine output to another person's screen.

| Data | You | Crew board | Crew medical officer | Flight surgeon |
| --- | --- | --- | --- | --- |
| Mood and stress | Everything | Count only, no names | Only if you share | In tier 3 summaries |
| Sleep and symptoms | Everything | Yes | Yes | In tier 3 summaries |
| Ship alerts and quests | Yes | Yes | Yes | In summaries |
| Safety answer | Yes | Never | Immediately | Immediately |

## Mission setting and radiation

`src/engine/mission.ts` holds the three settings. The setting never changes the rules, the tiers or the game, and the cabin CO₂ is the same ISS replay in every setting.

| Setting | One-way delay to Earth | Radiation dose a day | Source of the rate |
| --- | --- | --- | --- |
| ISS | Less than a second | 0.5 mSv, the high end of NASA's 0.2 to 0.5 (effective dose) | Simonsen, Zawaski and Weeks, NASA (2025) |
| Lunar surface | 1.3 s | 1.37 mSv (dose equivalent, Chang'E-4) | Zhang et al. 2020 |
| Mars transit (default) | 4, 12 or 22 min; 12 by default | 1.8 mSv (dose equivalent, Curiosity's RAD in cruise) | Zeitlin et al. 2013 |

The radiation card on the Ship screen shows the dose rate, the dose so far (rate × mission day), its share of NASA's 600 mSv career limit (NASA-STD-3001 Vol 1 [V1 4030]) and the mission day the limit would be reached. It says what to do in a solar storm: go to the storm shelter until the all-clear. Every number there is labeled an estimate. Sources are in `docs/CITATIONS.md`.

## Readings of the plan

These are the places where the plan could be read two ways, or where the build goes beyond it.

- **"Watch" is one day of drift.** The plan's indicator table says Watch after 3 or more days below normal; its demo needs a private card before day 3. Built: one day of drift opens a private card (tier 1), three days sends the summary (tier 3). The cited "under 6 h on 3 nights" rule is kept as written.
- **A ship alert is held.** Once raised, it stays on while the cabin is above baseline, even on a day when fewer than half the crew drift. Without this the banner flickered during the 8-day rise in the real trace.
- **Day 3 counts per likely cause.** When a ship alert ends and someone is still off, their count restarts at day 1 as "me". This is what makes the golden path's "day 3" land two days after the air clears.
- **One person drifting under high CO₂ is "me".** The card says the cabin is above its usual level and that the rule does not blame the air yet.
- **Headache is the only symptom that counts toward a ship alert.** It is the one with a published dose-response. Other ticks open a private Watch.
- **The live reaction test is shown, not compared.** The presenter has no baseline, and the result is never stored, so it does not feed the rules.
- **Quest steps are illustrative,** not a flight procedure, and say so.
- **Did the fix work?** For 7 days after a ship alert ends, the board and the Ship screen say whether the air is back to its usual level and how many of the crew it touched are back to theirs. Counts only, judged on shared indicators as the board does (`shipFollowUp` in `src/engine/privacy.ts`). Anyone still off is already "likely you" with a new 3-day count. This is the re-check the quest's last step asks for; it does not claim the fix caused the recovery.
- **The limit check uses the 24 h mean.** NASA writes the limit as a 1-hour average, but a single 1-hour peak would make the air a suspect on many quiet days. In the backtest the 24 h mean raised fewer false ship alarms (table under "Evidence"). The highest 1-hour average is still shown on the Ship screen and in summaries.
- **Radiation is shown, not judged.** It has no tier, no card per person and no part in ship or me: the whole crew gets about the same dose and nobody can feel it at everyday levels. A solar-storm warning would be a second "ship" cause; that is not built.

## Game

Rules are in `src/game/`. Nothing there can read a check-in's values: `checkInEvent` accepts only who and when.

| Mechanic | Rule |
| --- | --- |
| XP | Check-in 10, quest step 15, learn card 5, kudos 3. Repeats earn nothing |
| Streak | Weekly, 5 of 7 days. Spacewalk, comm-blackout and heavy-workload days are shielded |
| Quests | "Clear the air" opens with a ship alert; otherwise "Everyone logs sleep 5 nights" |
| Kudos | Thank a crewmate for a quest step they did |
| Not built | Leaderboards, rewards for readings, celebrations on alerts |
| Safety answer | No XP that day; the XP strip is hidden for that person |

## Golden path

The "Golden path" control jumps between the four days of the demo. The crew is seed 402 of the simulator.

| Mission day | Real date | What the app shows |
| --- | --- | --- |
| 212 | 2018-08-20 | Everyone OK. CO₂ has started to climb; a 1-hour average is above 3 mmHg |
| 213 | 2018-08-21 | CO₂ 4.3 mmHg against a usual 2.4. Anna, Ben and Dana drift. "Likely the ship, not you". Quest opens |
| 221 | 2018-08-29 | CO₂ back to 2.3 mmHg. Chen is still short on sleep: a private card, "likely you". The board and the Ship screen show the re-check: the air is back to usual, 3 of the 4 crew who felt it are back to theirs |
| 223 | 2018-08-31 | Chen's day 3: a summary goes to the flight surgeon and Chen is told |

The real rise lasts from day 213 to day 220; the quest cannot shorten a recording. Chen's sleep loss (days 219-226) and Ben's stress dip (days 188-192) are scripted events, listed in `crew.json`.

## Evidence

`scripts/backtest.py` runs 200 simulated crews over 10 real ISS CO₂ traces through the app's own engine (`scripts/engine_cli.ts`), with five scenarios. The numbers are in `public/data/backtest.json` and on the Learn screen.

- A ship event is a run of days at least 1 mmHg above that trace's median. An individual event is an injected 4-7 day sleep loss, run of headaches or stress dip.
- Thresholds were set on seeds 5000-5199; the reported seeds are 1000-1199.
- Each crew runs over one whole real trace (27-73 days), not 90 days: real data is never stitched or looped.
- The 10 traces contain 3 distinct CO₂ rises of 1 mmHg or more. That is a small sample, replayed for many crews.
- Unit tests in `tests/` cover every rule, including "XP never depends on a reading" and "mood never decides ship or me".

### Alert load against one alert per person

Most health apps give each person their own alert. The backtest runs the same crews through a comparator that does that (`perPersonOnly` in `EngineInput`: every drifting person is their own case and the ship is never blamed) and counts what happens during the 60 ship events of the base case:

| During CO₂ rises | Shipshape | One alert per person |
| --- | --- | --- |
| Person-days treated as a personal problem | 94 | 342 |
| Individual summaries to the flight surgeon (they carry private readings) | 5 | 39 |
| Crew-level ship summaries | 71 | 0 |

Shipshape has 73% fewer personal cases and 87% fewer individual summaries in the base case; the reduction in personal cases is 41% to 95% across the five scenarios. It does send more messages in total, because the ship summary repeats every 3 days while an alert lasts; each is one crew-level note about the cabin, not a medical case.

### Which reading of the 3 mmHg limit

Three versions of the rule, base case, on the tuning seeds (5000-5199) and the reported seeds (1000-1199):

| Air counts as a suspect when | Accuracy | Ship events missed | False ship alarms per crew-day |
| --- | --- | --- | --- |
| Above its own baseline only (before) | 0.920 / 0.906 | 26.7% / 23.3% | 0.0122 / 0.0148 |
| ... or the highest 1-hour average is over 3 mmHg | 0.905 / 0.894 | 23.3% / 23.3% | 0.0163 / 0.0192 |
| ... or the 24 h mean is over 3 mmHg (built) | 0.923 / 0.904 | 23.3% / 23.3% | 0.0131 / 0.0152 |

The scorer counts a ship event only as a rise of 1 mmHg above the trace's median, so an alert on a cabin that is high all along counts as false here even though the simulated crew's headache risk is raised. The cost of the limit check is therefore an upper bound. Days with a 24 h mean over 3 mmHg occur in 3 of the 10 traces (29 days); days with a 1-hour peak over 3 mmHg occur in 5 (64 days).

## Limits

- The crew is simulated. Only the cabin data and the thresholds are real.
- The CO₂ series is the ISS-side telemetry published for a rodent-research payload. It may differ from a cabin-wide average, and its rise on 2018-08-20 starts as a step at 00:00 UTC. It is replayed as published.
- Headache risk follows the published odds per check-in day; the paper used 7-day averages.
- Effect sizes for sleep, fatigue and irritability are demo parameters.
- The rule is not validated on real crews. Browser reaction times are estimates.
- Radiation figures are published averages per setting, not dosimeter readings, and leave out solar storms. The Moon and Mars rates are dose equivalent; NASA's limit is effective dose.

## Open items

- A deploy to Vercel and the `v1.0-submission` tag.
- One Earth use with a sourced number (decision 10).
- The table mapping the challenge's five questions to screens: the questions are not in the plan.
- The 30-second video.
- Opening each source in `docs/CITATIONS.md` before quoting it on the project page.
