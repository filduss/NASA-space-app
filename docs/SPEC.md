# Shipshape MVP spec (v0.1)

Shipshape is a crew check-in game for long missions. It compares each person with their own normal, checks the cabin air before blaming anyone, and rewards reporting, never the reading.

This file describes what the code on this branch does. Where the plan left room, the section "Readings of the plan" says which reading was built, so the team can steer.

## Decisions taken (plan v0.1, recommended options)

| # | Decision | Built |
| --- | --- | --- |
| 1 | Name | Shipshape |
| 2 | Hooks | Both: "Is it me, or the ship?" in the header, "rewards honesty, not perfection" in the footer and on check-in |
| 3 | Game depth | Full rules as tested functions; UI shows XP, weekly streak and one quest card |
| 4 | Mission setting | Mars transit, day 212. The CO₂ source (ISS) is stated on every screen |
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

### `accounts.json` (demo logins)

Written by `scripts/make_accounts.py` from the demo PINs listed in the README. Only salted hashes are stored.

```jsonc
{
  "meta": { "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "keyBytes": 32 } },
  "accounts": [{ "crewId": "anna", "role": "astronaut", "salt": "<base64, 16 random bytes>", "hash": "<base64>" }]
}
```

`role` is `astronaut`, `medical` or `surgeon`. Every crew member in `crew.json` has one account; Dana is the medical officer. People on Earth who log in but are not crew have an id outside `crew.json` and a `name` of their own: Mira is the flight surgeon at Mission Control (`{ "crewId": "mira", "role": "surgeon", "name": "Mira", … }`).

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

### Ship or me

1. **Ship:** at least half the crew drift on CO₂-linked indicators today and the cabin is above baseline.
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

### Crew timeline

The crew board and the flight surgeon's screen share one chart: the last 14 days of cabin CO₂ (24 h mean, with the cabin's usual level and the 3 mmHg limit), how many crew drift on CO₂-linked indicators (with the rule's threshold), and one row per person. Each cell is a symbol and a word: ● within own usual, ▲ off own usual, ◆ day 3 or later, ○ no check-in, a shield for a shielded day, ■ safety answer, – nothing received. `crewTimeline` in `privacy.ts` fills it per viewer, inside the privacy table above:

| Part | Crew member | Crew medical officer | Flight surgeon |
| --- | --- | --- | --- |
| Cabin CO₂ | Yes | Yes | Yes (ship telemetry, not a person's data) |
| Crew drifting, no names | Every day | Every day | Only on days a ship summary was sent, with the count it gives |
| Ship-alert band | Every day | Every day | The days a ship summary covers ("day N of the alert") |
| Rows | Their own only | Everyone, shared indicators only, as on the board | Only people a summary names, and only the days and indicators that summary states |

A row cell shows ◆ when a shared indicator has been off 3 days **and** it is day 3 of the same likely cause, which is the day a summary goes to Earth. Safety answers never show in board rows; the flight surgeon's row shows ■ the day the immediate summary was sent.

Times: on board, ship time is UTC and the check-in is at 08:00. The flight surgeon's screen gives each time also in Houston local time, where Mission Control sits, after the comm delay. The real date behind a mission day (`cabin.json` replay) decides summer or winter time.

### Login

`/` is the login, `/dashboard` the personal dashboard and `/app` the crew app. Both need a logged-in person; without one they send you to the login and back afterwards (only to those two pages).

| | Astronaut | Medical officer | Flight surgeon (Earth) |
| --- | --- | --- | --- |
| Own dashboard (`/dashboard`) | Yes | Yes | None: not crew, sent to the crew app |
| Anyone else's dashboard | No | No | No |
| Crew app (`/app`) | No: sent to their own dashboard | Yes, with its **Viewing as** control | Yes, always viewing as the flight surgeon |

The crew app is the only thing the medical role adds. The flight surgeon's login opens the crew app fixed to the flight surgeon's view: summaries, the timeline of what reached Earth, and the Learn cards. **Viewing as** and "Reset my inputs" are not offered; the mission day and comm delay controls stay for the demo. Inside the app, the screens and the privacy table work as before.

- The PIN is checked in the browser with Web Crypto: PBKDF2-SHA256 against the salted hash in `accounts.json`, compared over every byte. The PIN is never stored, logged or kept in state after the check.
- The session is in `sessionStorage` (`shipshape.session.v1`): the crew id and an expiry 8 hours on, nothing else. The role is read from `accounts.json` on every load, never from the session. Closing the tab logs out; each tab logs in on its own.
- Five wrong PINs in a row lock that person out for 30 s, doubling with each further wrong PIN up to 15 min. The count is in `localStorage` (`shipshape.lockout.v1`) so closing the tab does not reset it, and a correct PIN clears it.
- **Limit:** with no server this is a privacy gate, not security. Anyone can download `accounts.json` and try all 10 000 four-digit PINs offline, or edit browser storage.

## Readings of the plan

These are the places where the plan could be read two ways, or where the build goes beyond it.

- **"Watch" is one day of drift.** The plan's indicator table says Watch after 3 or more days below normal; its demo needs a private card before day 3. Built: one day of drift opens a private card (tier 1), three days sends the summary (tier 3). The cited "under 6 h on 3 nights" rule is kept as written.
- **A ship alert is held.** Once raised, it stays on while the cabin is above baseline, even on a day when fewer than half the crew drift. Without this the banner flickered during the 8-day rise in the real trace.
- **Day 3 counts per likely cause.** When a ship alert ends and someone is still off, their count restarts at day 1 as "me". This is what makes the golden path's "day 3" land two days after the air clears.
- **One person drifting under high CO₂ is "me".** The card says the cabin is above its usual level and that the rule does not blame the air yet.
- **Headache is the only symptom that counts toward a ship alert.** It is the one with a published dose-response. Other ticks open a private Watch.
- **The live reaction test is shown, not compared.** The presenter has no baseline, and the result is never stored, so it does not feed the rules.
- **Quest steps are illustrative,** not a flight procedure, and say so.
- **The flight surgeon has a login.** The plan names the flight surgeon as a reader of summaries; the build gives the role a login (Mira, on Earth) so the Earth view can be shown on its own. It adds no access: the login sees what the "Flight surgeon" column of the privacy table allows.
- **The flight surgeon's timeline is rebuilt from summaries.** Nothing reaches Earth between summaries, so a row's cells come only from what a summary states: a day-3 summary covers the days each listed indicator has been off; a ship summary names who had CO₂-linked changes that day and how long the alert has run.
- **The medical officer is one of the crew.** The plan's crew medical officer is a role, not a person; the build gives it to Dana. Her login opens her own dashboard like anyone's, plus the crew app. The crew app keeps its demo **Viewing as** control, so as the medical officer she can still show every screen of the demo.

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
| 221 | 2018-08-29 | CO₂ back to 2.3 mmHg. Chen is still short on sleep: a private card, "likely you" |
| 223 | 2018-08-31 | Chen's day 3: a summary goes to the flight surgeon and Chen is told |

The real rise lasts from day 213 to day 220; the quest cannot shorten a recording. Chen's sleep loss (days 219-226) and Ben's stress dip (days 188-192) are scripted events, listed in `crew.json`.

## Evidence

`scripts/backtest.py` runs 200 simulated crews over 10 real ISS CO₂ traces through the app's own engine (`scripts/engine_cli.ts`), with five scenarios. The numbers are in `public/data/backtest.json` and on the Learn screen.

- A ship event is a run of days at least 1 mmHg above that trace's median. An individual event is an injected 4-7 day sleep loss, run of headaches or stress dip.
- Thresholds were set on seeds 5000-5199; the reported seeds are 1000-1199.
- Each crew runs over one whole real trace (27-73 days), not 90 days: real data is never stitched or looped.
- The 10 traces contain 3 distinct CO₂ rises of 1 mmHg or more. That is a small sample, replayed for many crews.
- Unit tests in `tests/` cover every rule, including "XP never depends on a reading" and "mood never decides ship or me".

## Limits

- The crew is simulated. Only the cabin data and the thresholds are real.
- The CO₂ series is the ISS-side telemetry published for a rodent-research payload. It may differ from a cabin-wide average, and its rise on 2018-08-20 starts as a step at 00:00 UTC. It is replayed as published.
- Headache risk follows the published odds per check-in day; the paper used 7-day averages.
- Effect sizes for sleep, fatigue and irritability are demo parameters.
- The rule is not validated on real crews. Browser reaction times are estimates.

## Open items

- A deploy to Vercel and the `v1.0-submission` tag.
- One Earth use with a sourced number (decision 10).
- The table mapping the challenge's five questions to screens: the questions are not in the plan.
- The 30-second video.
- Opening each source in `docs/CITATIONS.md` before quoting it on the project page.
