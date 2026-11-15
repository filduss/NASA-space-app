# Ship Or Me? MVP spec (v0.1)

Ship Or Me? is a crew check-in for long missions. It compares each person with their own normal and checks the cabin air before blaming anyone.

This file describes what the code on this branch does. Where the plan left room, the section "Readings of the plan" says which reading was built, so the team can steer.

## Decisions taken ([plan v0.1](plan-v0.1.md), recommended options)

| # | Decision | Built |
| --- | --- | --- |
| 1 | Name | Ship Or Me? |
| 2 | Hooks | "Is it me, or the ship?" in the login's tab title and the README; no page header carries it (15 Nov 2026). The second hook, "rewards honesty, not perfection", went with the game |
| 3 | Game depth | None. XP, the weekly streak, shield days, quests and kudos were built and then removed (15 Nov 2026): the check-in stands on its own |
| 4 | Mission setting | ISS, lunar surface, Mars transit (default) or an Antarctic station, chosen in the demo controls. It changes the comm delay and the radiation card only. The CO₂ source (ISS) is stated on every screen |
| 5 | Board default | Sleep and symptoms shared; mood and stress private, shown as a count with no names |
| 6 | Live input | Live 30-second reaction test, kept in memory only |
| 7 | Wearable | Simulated, no real device. Sleep duration and exercise come from a wrist wearable, modelled on NASA's actigraph, and are never asked; the check-in no longer shows them (15 Nov 2026), the dashboard does. It also shows resting heart rate, HRV, blood oxygen, breathing and skin temperature, for information only. In the demo the readings are the simulated crew's own records (`src/data/wearable.ts`) |
| 8 | AI | None. Summaries come from fixed templates |
| 9 | Demo format | Not built here: the app has a "Golden path" control with the four days a 30-second video needs |
| 10 | Earth use | Antarctic winter stations: Concordia's winter crew runs the base alone for three-quarters of a year (ESA). On the challenge page and as Mission → Antarctic station |

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
- `temp` (°C) and `rh` (% relative humidity) are the same samples' ISS-side temperature and humidity, averaged over the same hours. A sample dropped for its CO₂ takes its temperature and humidity with it; they have no filter of their own, and every hourly value across the 10 traces lies within 18.7–24.7 °C and 33–61%. The rule reads them only on days with a CO₂ mean (12 hours or more of data).
- The real dates are relabeled as mission days. Nothing else is shifted.

### `crew.json` (simulated)

```jsonc
{
  "meta": { "simulated": true, "seed": 402, "seedSearch": { "seedsTried": 402, "criteria": ["..."] } },
  "crew": [{ "id": "anna", "name": "Anna" }],
  "shieldDays": [{ "day": 200, "kind": "eva", "crewIds": ["anna", "dana"], "label": "Spacewalk" }],
  "checkIns": [{ "crewId": "anna", "day": 213, "sleepHours": 7, "sleepQuality": 7, "fatigue": 3, "irritability": 2,
                 "stress": 3, "mood": 7, "symptoms": ["headache"], "reactionMs": 262, "exerciseMin": 135,
                 "watch": { "restingHr": 61, "hrvMs": 36, "spo2": 98, "respRate": 15.9, "skinTempDelta": -0.2 }, "simulated": true }]
}
```

`shieldDays` is still written by the simulator and committed, but the app no longer reads it: a shielded day shows as a missed check-in. Ratings run 0-10. `symptoms` is any of `headache`, `dizziness`, `nausea`, `congestion`, `eye_strain`. `sleepHours` and `exerciseMin` are the wearable's readings: last night's sleep and the day before's exercise in minutes. `watch` holds the wearable's vitals: resting heart rate (bpm), HRV (RMSSD, ms), blood oxygen (%), breathing rate (per minute) and skin temperature against the person's usual (°C). The simulator draws exercise and the vitals each from a stream of its own, so adding them changed no other value; its vitals are demo parameters, nudged on short-sleep, sleep-loss and stress days. A live check-in has `simulated: false` and `reactionMs: null`, and takes `sleepHours`, `exerciseMin` and `watch` from the wearable's reading for that day: `null` when the wearable has none, which makes sleep duration "not measured" that day.

Conference requests are not part of a check-in. The app keeps them in `localStorage` as `{ "crewId": "ben", "day": 213, "urgent": true }` and passes them to the engine as `EngineInput.requests`; the simulated crew never makes one. A check-in saved by an older version with `safetyFlag: true` is read as an urgent request.

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

**A slow change.** A decline too slow to jump out on any one day becomes the rolling normal, so mood and stress are also compared with the person's **starting normal**: the median and spread of their first 14 check-ins. When today's own normal (the rolling one above) has moved 2 or more starting spreads the unwanted way, the indicator is off as a slow change ("your usual mood has slipped from 7/10 to 5/10 since your first 14 check-ins"). Those days stay in the rolling normal, so the flag does not switch itself off. Only mood and stress are checked: they are the isolation signals and never enter the ship rule, while a week of high CO₂ itself moves the usual of the CO₂-linked indicators and would read as a slow change. Both numbers are demo parameters, set on the tuning seeds.

| Indicator | Unwanted direction | Cabin factor that can explain it | Board |
| --- | --- | --- | --- |
| Sleep duration | Low; also under 6 h on 3 of the last 7 nights | CO₂, temperature | Shared |
| Sleep quality | Low | CO₂, temperature | Shared |
| Fatigue | High | CO₂ | Shared |
| Irritability | High | CO₂ | Shared |
| Symptoms | Any tick | Headache: CO₂. Congestion, dry or sore eyes: humidity. Dizziness, nausea: none | Shared |
| Alertness (response speed) | Low | None | Shared |
| Stress | High | Never | Private |
| Mood | Low | Never | Private |

The links come from NASA's own sources (`docs/CITATIONS.md`): its CO₂ brief reports headaches with fatigue and malaise at 2.8–4.5 mmHg, fatigue, decreased sleep and nausea above 4.5 mmHg, and poor sleep and frontal headaches at 3.5 mmHg (OCHMO-TB-004 Rev D, anecdotal evidence from earlier missions); its sleep risk names temperature among the "environmental factors" that "inhibit sleep and impact well-being in space"; its cabin standard expects "dry, stuffy and/or irritated mucous membranes" outside its humidity range (NASA-STD-3001 Vol 2 [V2 6012]). Irritability is the exception: the plan links it to CO₂, NASA's list does not.

### Cabin

The rule checks three cabin factors, all 24 h means from the same ISS telemetry.

- **CO₂.** The cabin's baseline is the median of its last 14 normal days. The cabin is "above baseline" when the 24 h mean is 0.5 mmHg or more above it. Separately, a 1-hour average above 3 mmHg is flagged (NASA-STD-3001 Vol 2 [V2 6004]). CO₂ is a suspect when it is above baseline or its 24 h mean is over 3 mmHg. A cabin that stays high for weeks becomes its own baseline; the limit check keeps it a suspect.
- **Temperature and humidity.** A suspect when the 24 h mean is outside the comfort range NASA-STD-3001 Vol 2 cites for comfort and performance, 20–25 °C and 30–60% ([V2 6013], rationale). Outside the crew health limits, 18–27 °C and 25–75% ([V2 6012]), they are shown as over the limit (red). They have no baseline of their own: a cabin's usual temperature is held by its thermal control, and NASA's ranges are absolute.

### Ship or me

1. **Ship:** a cabin factor is a suspect and at least half the crew drift today on indicators that factor can explain (table above). The alert names every factor that qualifies.
2. **Me:** one person drifts.
3. **Shared, not the air:** two or more drift, and the rule cannot blame the air.

### Tiers

| Tier | Trigger | Who sees it |
| --- | --- | --- |
| 0 | Nothing off | You |
| 1 | Any drift, or a slow change against your starting normal: a private Watch on your own dashboard | You |
| 2 | A ship alert or shared pattern, or a Watch you chose to share | Crew medical officer |
| 3 | Still off on day 3 of the same likely cause; again every 3 days | Flight surgeon, with the comm delay |
| 4 | An urgent conference request | Crew medical officer and flight surgeon, immediately |

A routine conference request has no tier: it reaches the flight surgeon as a request with no readings, and nobody on board is told.

### Privacy

`src/engine/privacy.ts` is the only path from engine output to another person's screen.

| Data | You | Crew board | Crew medical officer | Flight surgeon |
| --- | --- | --- | --- | --- |
| Mood and stress | Everything | Count only, no names | Only if you share | Only if you share, and in tier 3 summaries |
| Sleep and symptoms | Everything | Yes | Yes | Yes |
| Ship alerts | Yes | Yes | Yes | Yes |
| Urgent conference request | Yes | Never | Immediately | Immediately, with today's off indicators |
| Routine conference request | Yes | Never | Never | Immediately, the request only |

The flight surgeon sees everything the crew medical officer sees (crew board, inbox, Ship screen), plus the summaries sent to Earth. The inbox's table lists, per person, sleep, sleep quality, symptoms and which shared indicators are off their own usual (`boardPerson`, the board's own path); mood and stress show as "private". The crew board is seen only by those two: astronauts do not open the crew app.

## Mission setting and radiation

`src/engine/mission.ts` holds the three settings. The setting never changes the rules or the tiers, and the cabin CO₂ is the same ISS replay in every setting.

| Setting | One-way delay to Earth | Radiation dose a day | Source of the rate |
| --- | --- | --- | --- |
| ISS | Less than a second | 0.5 mSv, the high end of NASA's 0.2 to 0.5 (effective dose) | Simonsen, Zawaski and Weeks, NASA (2025) |
| Lunar surface | 1.3 s | 1.37 mSv (dose equivalent, Chang'E-4) | Zhang et al. 2020 |
| Mars transit (default) | 4, 12 or 22 min; 12 by default | 1.8 mSv (dose equivalent, Curiosity's RAD in cruise) | Zeitlin et al. 2013 |
| Antarctic station | Less than a second | None: on Earth the atmosphere and magnetic field shield the station | - |

The setting also says how much gravity loads the bones: none in orbit and in cruise, a sixth of Earth's on the Moon, Earth's in Antarctica. No screen shows it at present; the dashboard's Bone & muscle panel that worded itself by it was removed.

The radiation card on the Ship screen shows the dose rate, the dose so far (rate × mission day), its share of NASA's 600 mSv career limit (NASA-STD-3001 Vol 1 [V1 4030]) and the mission day the limit would be reached. The card is these four numbers only (15 Nov 2026): no text around them, no table comparing the settings and no "Estimate" tag. Sources are in `docs/CITATIONS.md`.

### Crew timeline

The crew board shows one chart: the last 14 days of cabin CO₂ (24 h mean, with the cabin's usual level and the 3 mmHg limit), how many crew drift on CO₂-linked indicators (with the rule's threshold), and one row per person. Each cell is a symbol and a word: ● within own usual, ▲ off own usual, ◆ day 3 or later, ○ no check-in. `crewTimeline` in `privacy.ts` fills it per viewer, inside the privacy table above:

| Part | Crew member | Crew medical officer and flight surgeon |
| --- | --- | --- |
| Cabin CO₂ | Yes | Yes |
| Crew drifting, no names | Every day | Every day |
| Ship-alert band | Every day | Every day |
| Rows | Their own only | Everyone, shared indicators only |

The crew member's column is kept in `crewTimeline` for completeness; no page shows it at present, since astronauts do not open the crew board.

A row cell shows ◆ when a shared indicator has been off 3 days **and** it is day 3 of the same likely cause, which is the day a summary goes to Earth. Urgent conference requests never show in board rows.

Times: on board, ship time is UTC and the check-in is at 08:00. The flight surgeon's screen gives each time also in Houston local time, where Mission Control sits, after the comm delay. The real date behind a mission day (`cabin.json` replay) decides summer or winter time.

### Guide

`/guide` explains every reading in plain words for the crew, without assuming they know how to assess their own health: what it is, how to check it (how to answer the check-in item, or where the reading comes from; the app's own steps, first in every open entry), why it matters in space, NASA's limit or target, what you can do and when to tell the medical officer now (the last two only where a NASA source names them). There is no "What the app does with it" part (removed on 15 Nov 2026). Each NASA risk opens with its title said in plain words, with NASA's own title below. The page has no emergency note at the top and no footer (both removed on 15 Nov 2026). It never shows the reader's own numbers. Sections: Start here (Ship or me), You, Cabin, NASA risks, as a grouped list of topics under a search box, beside a reading pane for the open topic; on a phone the list and the topic take turns, with a way back to the list. The open topic is the URL's hash. The content is `src/guide/entries.ts`; every sentence is the app's own or names a row of `docs/CITATIONS.md`, and a sourced sentence shows only once that row says a person opened the source (`tests/guide.test.ts`). A reading with nothing shown beyond its first line is left out until its sources are checked. Search is BM25 over the entries with a hand-written synonym list and prefix matching, no model ([ADR 0001](adr/0001-guide-search-without-a-model.md)). The shared toolbar (`src/ui/Toolbar.tsx`) has a Guide button on the dashboard and the check-in; `/guide#sleep` opens one entry. The Guide has no demo dock: it shows no mission day or person. Each check-in item has a "?" that opens its entry in a sheet over the check-in, so a half-filled check-in is not lost. On the dashboard, a vital tile that is off its usual (watch or alert) gets a "What this means" button that opens the entry the same way, with a link on to the Guide. The Symptoms tile, when something is reported, opens on a tap to a sheet listing today's symptoms, one row per Guide entry (dizziness and nausea share one) with its button; there is no chart of symptoms. The button follows the levels the engine already gives; it is not a rule. No rule reads the Guide.

### Login

`/` is the login, `/challenge` the challenge page, `/dashboard` the personal dashboard, `/checkin` the person's own check-in, `/guide` the crew's Guide and `/app` the crew app (the medical console). The challenge page needs no login. The last four need a logged-in person; without one they send you to the login and back afterwards (only to our own pages). A logged-in person who may not open a page is sent to their own home page.

| | Astronaut | Medical officer | Flight surgeon (Earth) |
| --- | --- | --- | --- |
| Own dashboard (`/dashboard`) | Yes | Yes | None: not crew, sent to the crew app |
| Anyone else's dashboard | No | No | No |
| Own check-in (`/checkin`): check-in, conference request | Yes | Yes | None: not crew |
| Guide (`/guide`) | Yes | Yes | None: written for the crew |
| Crew app (`/app`): crew board, inbox, Ship | No, sent to their dashboard | Yes, as the crew medical officer | Yes, the same as the crew medical officer, plus Summaries |
| Challenge page (`/challenge`) | Yes | Yes | Yes, and with no login |

`viewsFor(user, page)` in `src/auth/session.ts` gives the one view a login takes on a page: on `/checkin` the person themselves, in `/app` the crew medical officer or the flight surgeon. Nobody can view as another crew member. "Reset my inputs" is not offered to the flight surgeon. The mission day, mission setting and comm delay controls stay for the demo. The personal dashboard links to the person's own check-in with a large card in its left column, under the status box (above the body stage on a phone): filled blue with "Check in" until the person sends today's check-in, then quiet with a done mark and "Checked in today". The card says when the last check-in was ("Last check-in yesterday", "3 days ago (day 218)") and shows the last 7 mission days as circles (filled for a check-in, empty for none) with a plain count, "5 of the last 7 days". There is no streak: the game was removed (see "No game" in CLAUDE.md). The head row has no check-in button. On `/dashboard` the demo's controls (the mission-day stepper and the four golden-path days) are not in the head row: they sit in a separate demo dock at the bottom of the screen, marked "Not part of the app" with the same "?" as the judge's tour, and can be folded away. The dock's "About the data" says which data is simulated and which is real ISS cabin air, with its source, and holds the skeleton's licence credit; it is the only place that says so, as screens carry no simulated / real labels (team decision, 15 Nov 2026). The page has no footer. The page has no top bar (15 Nov 2026): its head row, on the page itself, has the person's avatar (their initial), name, mission and mission day on the left and the toolbar on the right, as wide as the three columns below, so it lines up with the left edge of the Ship or me card and the right edge of the Vitals panel; it has no "Ship Or Me?".

**Judge's tour.** The login page has no tour (removed on 15 Nov 2026: the page is only the name, one line on what the app is, and the login card, centred). The tour starts from the "Judge's tour" button at the top of the challenge page, which opens its first stop; the challenge page's other buttons open single screens logged in as the right person. It is five stops that walk the golden path: day 213 as Dana (Ship screen), day 221 as Chen (dashboard), day 223 as Mira (the summaries sent to Earth), the Guide as Chen, and the challenge page. Each stop logs in with that person's demo PIN through the same check as typing it, then opens the page. The demo PINs are printed on each person's card on the login; they are public on purpose (`src/auth/demo.ts`, the README and `scripts/make_accounts.py` list the same PINs). `?day=`, `?screen=` and `?mission=` open a page on a given mission day, screen and setting. A page opened from the tour also carries `?tour=N`: it then shows a strip across the top with the stop's name and a "Next" link to the following stop (`src/auth/TourBar.tsx`), so the five stops can be walked without returning to the start page; the last stop links back to the start. The strip closes with ×. The "Next" link logs in as the next person through the store's `logIn(crewId, pin, goTo)`, which loads the new page without changing who the current page shows.

- The PIN is entered on an on-screen number keypad (1 to 9, 0 and delete) or typed on a keyboard; the system keyboard is suppressed on phones so it does not cover the keypad. The fourth digit submits.
- The PIN is checked in the browser with Web Crypto: PBKDF2-SHA256 against the salted hash in `accounts.json`, compared over every byte. The PIN is never stored, logged or kept in state after the check.
- The session is in `sessionStorage` (`shipshape.session.v1`): the crew id and an expiry 8 hours on, nothing else. The role is read from `accounts.json` on every load, never from the session. Closing the tab logs out; each tab logs in on its own.
- Five wrong PINs in a row lock that person out for 30 s, doubling with each further wrong PIN up to 15 min. The count is in `localStorage` (`shipshape.lockout.v1`) so closing the tab does not reset it, and a correct PIN clears it.
- **Limit:** with no server this is a privacy gate, not security. Anyone can download `accounts.json` and try all 10 000 four-digit PINs offline, or edit browser storage.

## When something fails

- **No WebGL.** Where the browser cannot make a WebGL context (hardware acceleration off, some remote desktops), the dashboard's 3D figure is replaced by one line of text. The answer box, the zone chips and the vitals tiles are unchanged, since they never depended on the figure.
- **A render error.** `src/ui/ErrorBoundary.tsx` wraps every page: instead of an empty screen the person gets Reload, a link to the start page, and "Clear my saved inputs and reload", which removes `shipshape.v1` from `localStorage` (live check-ins and conference requests saved by this or an older build).
- **Data files not loaded.** A plain message and "Try again". The files are precached by the service worker after the first visit, so this only happens on a first visit with a broken connection.

## Readings of the plan

These are the places where the plan could be read two ways, or where the build goes beyond it.

- **A slow change is drift too.** The plan's own normal is the last 14 check-ins, which follows a slow decline down, so a slide never shows. Built: mood and stress are also compared with the starting normal, and a slow change opens the same private card and, if it lasts to day 3, the same summary to the flight surgeon, where the privacy table already allows mood and stress. Numbers under "Evidence".
- **"Watch" is one day of drift.** The plan's indicator table says Watch after 3 or more days below normal; its demo needs a private card before day 3. Built: one day of drift opens a private card (tier 1), three days sends the summary (tier 3). The cited "under 6 h on 3 nights" rule is kept as written.
- **A ship alert is held.** Once raised, it stays on while the factor behind it is still a suspect, even on a day when fewer than half the crew drift. Without this the banner flickered during the 8-day rise in the real trace. An alert raised for one factor ends when that factor recovers, even if another is a suspect.
- **Temperature and humidity are ship causes too.** The plan names only CO₂. Built: the same telemetry's temperature and humidity are checked against NASA's ranges, each with its own readings (table under "Own normal"), and the Ship screen, the summaries and the dashboard say which factor is blamed and which are ruled out. On the 10 real traces they rarely leave NASA's comfort range (numbers under "Evidence"), so on real ISS data the call is about CO₂ and the other two are ruled out by name.
- **The comfort range is the trigger, not the health limit.** NASA's rationale for [V2 6013] says operating outside 20–25 °C and 30–60% "will cause performance decrements"; the wider health limits of [V2 6012] would leave a cabin at 19 °C unchecked. The figure behind [V2 6012] is read as the box between its corners (18 °C / 75% and 27 °C / 25%).
- **Irritability stays linked to CO₂.** NASA's CO₂ brief lists headache, fatigue, malaise, poor or decreased sleep and nausea, not irritability. Dropping it would change every CO₂ result and the seeded demo, so it stays, and the check-in says so. Nausea, in NASA's list above 4.5 mmHg, is not added: the rule keeps headache as the one symptom with a published dose-response.
- **Day 3 counts per likely cause.** When a ship alert ends and someone is still off, their count restarts at day 1 as "me". This is what makes the golden path's "day 3" land two days after the air clears.
- **One person drifting under high CO₂ is "me".** The card says the cabin is above its usual level and that the rule does not blame the air yet.
- **The Ship or me box shows cabin CO₂ only.** The personal dashboard's status box has one chip, "Cabin CO₂ level" (`cabinLevel`, as on the crew app). The You chip was removed on 15 Nov 2026: the body zones and vitals tiles carry the person's own readings. Temperature and humidity have no chip, to keep the box short; they still count toward the headline and the box's colour, and the crew app's Ship screen shows them. On a day with no usable CO₂ reading the chip says "No data" with a dashed circle, not a tick.
- **Real ISS crews are a reference, never a threshold.** The sleep tile shows the published ISS figure (about 6.5 h, Jones et al. 2022) beside the person's own usual, for context. The rules still compare each person only with their own normal.
- **Headache is the only symptom that counts toward a CO₂ ship alert.** It is the one with a published dose-response. Congestion and dry or sore eyes count toward a humidity alert ([V2 6012]); dizziness and nausea open a private Watch only.
- **Check-in answers start unset.** A rating that starts at the person's usual lets a rushed check-in report "as usual" without anyone choosing it, which is the under-reporting the check-in is meant to counter. Built: each of the five ratings is a row of 0-10 tap targets with nothing chosen, and every rating is tapped by hand: there is no "as usual" shortcut (an "As usual" chip and "Set the rest to my usual" were built and removed on 15 Nov 2026). Symptoms work the same way: "None today" is its own tile, exclusive of the five symptoms, and unticking the last symptom leaves the question unanswered rather than "none". Send waits until all six are answered. The logic is `src/ui/checkInForm.ts`.
- **The check-in asks only what a person can tell.** Sleep duration and exercise are measured by the wearable and not shown on the check-in; there is no way to correct them, which would bring the self-report back. The five ratings follow the domains of the ISS Reaction Self Test's 0-10 self-ratings where they overlap (sleep quality, fatigue, stress; Jones et al. 2022, not yet checked in `docs/CITATIONS.md`); irritability and mood are ours. The check-in shows no "why we ask" text: the team judged it out of scope for the MVP.
- **A night with no wearable reading is not measured.** On a day with no reading, sleep duration is "not measured", as a skipped reaction test is, and the short-sleep rule does not count that night as short.
- **The safety question is a conference request.** NASA crews have a weekly private medical conference with their flight surgeon and can ask for one at any time. The checkbox "I am not safe, or I need to talk to someone now" became two buttons side by side on the check-in, each sending its request with one tap and with no step to open them (15 Nov 2026): "Next conference" (flight surgeon only, no tier) or "Urgent: now" (tier 4, the old safety path). It is sent on its own, so asking for help never waits for the ratings, and it works on a day with no check-in.
- **After sending, a receipt.** The confirmation lists what was sent, with "See my dashboard" and "Change today's answers". Answers can be changed until the mission day changes.
- **The reaction test counts a lapse at 355 ms**, as PVT-B, the brief test behind the ISS Reaction Self-Test, does (Basner, Mollicone and Dinges 2011).
- **The live reaction test is shown, not compared.** The presenter has no baseline, and the result is never stored, so it does not feed the rules.
- **Did the fix work?** For 7 days after a ship alert ends, the board and the Ship screen say whether the air is back to its usual level and how many of the crew it touched are back to theirs. Counts only, judged on shared indicators as the board does (`shipFollowUp` in `src/engine/privacy.ts`). Anyone still off is already "likely you" with a new 3-day count. It does not claim the fix caused the recovery.
- **The limit check uses the 24 h mean.** NASA writes the limit as a 1-hour average, but a single 1-hour peak would make the air a suspect on many quiet days. In the backtest the 24 h mean raised fewer false ship alarms (table under "Evidence"). The highest 1-hour average is still shown on the Ship screen and in summaries.
- **The dashboard's status box is "Ship or me".** The pitch asks "likely you or likely the ship?", but on a person's own screen "Likely you" read as blame. So on `/dashboard` the box, labeled "Ship or me" ("Ship check" until 15 Nov 2026), always has the ship as its subject and answers one question. The fixed templates are in `verdict` in `src/dashboard/model.ts`:

  | Engine result | Headline |
  | --- | --- |
  | No check-in today | Check in to check the ship |
  | Likely the ship | Likely the ship, not you |
  | Likely not the ship (one person, or several the air does not explain) | Likely not the ship |
  | The same, but the day has no cabin data | No cabin data to check |
  | Within your normal, a cabin factor orange or red | You're within your normal |
  | Within your normal, the cabin at its usual | All good |

  The shared case says nothing about the others. Under the headline is the Cabin CO₂ level chip. The box takes the colour of the side the answer points at (your own readings against your normal, exercise left out, or the air): the air's on a likely-ship day, otherwise yours, so a box that says you are fine is never orange or red because of the air. It never shows a day count or who was told: a ship episode's day 3 stays "Likely the ship, not you", and the day-3 summary to Earth is shown to the flight surgeon, not in the box.

  Conference requests are a separate feature: the box ignores them (the check-in page confirms a request, and the drop-in banner says "Urgent request sent"). The cabin air has no body zone on the skeleton. The four zone chips under the body say only Normal, Watch or Alert, and the labels on the skeleton only the zone's name; what is off (the indicator or symptom, or the exercise count) shows in a card on the stage once a zone is tapped and the view zooms in on it. There is no notifications list: the box, the body zones and the vitals tiles carry the same facts, and the wearable panel sits under the box.
- **The wearable's vitals are shown, not judged.** Besides sleep and exercise, the simulated wearable reports resting heart rate, HRV, blood oxygen, breathing and skin temperature, shown in the dashboard's "From your wearable" panel as today's values only. They are there to show what a wearable could add: no rule reads them, no threshold, no tier, no part in ship or me. The next step would be to compare each with the person's own normal, as the check-in readings are, once a real device feeds them. Sleep quality stays the person's own rating, not a wearable reading.
- **Bone and muscle are shown, not judged.** The gravity hazard is covered through its countermeasure, exercise: the wearable logs the day before's exercise, and the engine counts how many of the last 7 logged days reached 120 minutes. Below target on 3 of them turns the core (hip and spine) and limbs zones of the personal dashboard orange, never red, and the zone names the count. Like radiation it has no tier, no card on the crew board, nothing for the crew medical officer and no part in ship or me. The 120-minute target follows NASA's figure of about two hours of exercise a day on the ISS; the 3-of-7 count is a demo parameter.
- **Radiation is shown, not judged.** It has no tier, no card per person and no part in ship or me: the whole crew gets about the same dose and nobody can feel it at everyday levels. A solar-storm warning would be a second "ship" cause; that is not built.
- **The flight surgeon sees what the crew medical officer sees.** The plan names the flight surgeon as a reader of summaries; the build gives the role a login (Mira, on Earth) with the crew medical officer's access (crew board, inbox, Ship screen) plus the summaries, which include conference requests. This goes beyond the plan, which sends only summaries to Earth.
- **The medical officer is one of the crew.** The plan's crew medical officer is a role, not a person; the build gives it to Dana. Her login opens her own dashboard and check-in like anyone's, plus the crew app as the crew medical officer. She cannot view as another crew member, because that would show their private mood and stress; the judge's tour (from the challenge page) opens the other people's screens with their own logins.
- **No Me screen, no share toggle.** The check-in page used to have a Me tab (status card, self-care idea, 28-day trends, and the toggle to share private cards, mood and stress with the crew medical officer). It was removed on 15 Nov 2026: the person's status is on their dashboard. The engine still honours `shareWatch` (tier 2 for a shared Watch, mood and stress in the inbox), but no screen sets it, so in the demo nobody shares.
- **Astronauts do not open the crew app.** The check-in, the reaction test and the conference request live on `/checkin`, in the person's own view, which has no other tabs. The crew board and the Ship screen are for the crew medical officer and the flight surgeon; an astronaut sees the cabin air and a likely-ship result on their own dashboard.

## Golden path

The demo dock (`src/ui/DemoDock.tsx`) jumps between the four days of the demo, on the personal dashboard, the check-in page and the crew app alike. On the check-in page and in the crew app its settings button holds the mission setting, the comm delay, the challenge-page link and "Reset my inputs" (`src/ui/DemoSettings.tsx`); on the check-in page the floating Send button sits just above the dock on a narrow screen; the reaction test keeps one box of a fixed height for start, running and result. On a wide screen (900 px and up) the check-in is two columns, the ratings beside the symptoms, reaction test and conference, with Send at the foot of the second column, and fits on one screen from 1280 × 720 without scrolling. No page has a top bar or a logo (15 Nov 2026). Every page (dashboard, check-in, Guide, crew app, challenge) opens with the same head row on the page itself: who and what on the left (on the check-in, the Guide, the crew app and the challenge page with the page's title under it; on the dashboard the person's avatar and name) and the toolbar on the right, lined up with the edges of the boxes below; no page shows "Ship Or Me?" at the top; Log out, which has no fill, is drawn out to that edge. The crew app's screens (Crew board, Inbox, Ship, Summaries) are tabs in a row of their own under the head row. On a phone the challenge page's links take a row of their own. The first time a browser opens a page with the dock, a spotlight walkthrough steps through its main parts (`src/ui/Walkthrough.tsx`, steps in `src/ui/walkthroughs.tsx`): the page dims except the part in question, and a card beside it says what it does, with Back, Next and Skip. On the dashboard: the status box, the check-in card, the body, the vitals and the wearable; on the check-in page: the ratings, the symptoms, the conference and Send; in the crew app: the screens, the ship banner, the crew timeline and the private mood-and-stress count. Each ends on the demo dock. A step whose part is not on screen is left out. Each page's walkthrough is shown once per browser (Skip or Escape counts); the "?" on the dock shows it again. The steps describe what is on screen and make no sourced claims. The crew is seed 402 of the simulator; `tests/golden.test.ts` checks these days on the committed data.

| Mission day | Real date | What the app shows |
| --- | --- | --- |
| 212 | 2018-08-20 | Everyone OK. CO₂ has started to climb; a 1-hour average is above 3 mmHg |
| 213 | 2018-08-21 | CO₂ 4.3 mmHg against a usual 2.4. Anna, Ben and Dana drift. "Likely the ship, not you" |
| 221 | 2018-08-29 | CO₂ back to 2.3 mmHg. Chen is still short on sleep: his own dashboard says "Likely not the ship". The board and the Ship screen show the re-check: the air is back to usual, 3 of the 4 crew who felt it are back to theirs |
| 223 | 2018-08-31 | Chen's day 3: a summary goes to the flight surgeon; his dashboard still says "Likely not the ship" |

The real rise lasts from day 213 to day 220; nothing in the app can shorten a recording. Chen's sleep loss (days 219-226) and Ben's stress dip (days 188-192) are scripted events, listed in `crew.json`.

Chen's sleep loss starts on day 219, while the ship alert is still on, so the app puts it down to the ship on days 219-220 and his day 3 counts from day 221, when the air is back to normal. Day 223 is the fifth day of his problem. This is the masking measured under "Evidence".

## Evidence

`scripts/backtest.py` runs 200 simulated crews over 10 real ISS cabin traces (CO₂, temperature, humidity) through the app's own engine (`scripts/engine_cli.ts`), with seven scenarios. The numbers are in `public/data/backtest.json` and on the challenge page (`/challenge`); the Ship screen quotes the base case in one line, read from the same file.

- A ship event is a run of days at least 1 mmHg above that trace's median. An individual event is an injected 4-7 day sleep loss, run of headaches or stress dip.
- Thresholds were set on seeds 5000-5199; the reported seeds are 1000-1199.
- Each crew runs over one whole real trace (27-73 days), not 90 days: real data is never stitched or looped.
- The 10 traces contain 3 distinct CO₂ rises of 1 mmHg or more. That is a small sample, replayed for many crews.
- Unit tests in `tests/` cover every rule, including "mood never decides ship or me".

### Right cause, by kind of day

The headline accuracy pools two kinds of day. Split, in the base case on the reported seeds:

| Kind of day | The right answer | Alerts judged | Right |
| --- | --- | --- | --- |
| A CO₂ rise | "the ship" | 260 | 74% |
| One person's own problem | anything but "the ship" | 924 | 95% |
| Pooled | | 1,184 | 90% |

The ship-day figure is the one that tests the rule; it falls to 34% when the CO₂ effect is halved and rises to 97% when it is doubled. The challenge page quotes the split, not only the pooled figure.

### Temperature and humidity on real ISS data

Counted by the engine's own cabin status over every day of the 10 traces (416 days with data, September 2014 to January 2021):

| Factor | Days a suspect | Range of daily means |
| --- | --- | --- |
| CO₂ | 63 (29 with a 24 h mean over 3 mmHg) | |
| Temperature (outside 20–25 °C) | 4, all in RR-3 (May 2016, about 19 °C) | 19.0–23.9 °C |
| Humidity (outside 30–60%) | 0 | 35–49% |

Adding the two checks changed no number in the backtest: no ship alert blamed temperature or humidity, and none was added or lost. No crew effect of temperature or humidity is simulated (there is no published effect size for crews), so the backtest measures what the checks cost, not what they catch. On the ISS, CO₂ is the cabin factor that moves.

### Simulated crews beside real ISS crews

The simulator is not tuned to these figures; the backtest sets them side by side (`meta.issCrews`, `crewStats`):

| | Real ISS crews | Simulated crews (base case, every check-in) |
| --- | --- | --- |
| Sleep in flight | about 6.5 h a night (Jones et al. 2022: 24 astronauts on six-month missions, 2,856 Reaction Self-Tests) | 7.2 h |
| Days with a reported headache | 46 of 1,716 days, 2.7% (NASA OCHMO-TB-004: case reports, ISS Expeditions 2–31, 49 astronauts) | 2.1% |

Headaches come out close. The simulated crews sleep about 40 minutes more than ISS astronauts reported, so on real crews the cited "under 6 h on 3 of the last 7 nights" rule would fire more often. Retuning the simulator would change the seeded demo and every number above, so it is stated instead.

### Alert load against one alert per person

Most health apps give each person their own alert. The backtest runs the same crews through a comparator that does that (`perPersonOnly` in `EngineInput`: every drifting person is their own case and the ship is never blamed) and counts what happens during the 60 ship events of the base case:

| During CO₂ rises | Ship Or Me? | One alert per person |
| --- | --- | --- |
| Person-days treated as a personal problem | 95 | 343 |
| Individual summaries to the flight surgeon (they carry private readings) | 5 | 39 |
| Crew-level ship summaries | 71 | 0 |

Ship Or Me? has 72% fewer personal cases and 87% fewer individual summaries in the base case; the reduction in personal cases is 41% to 95% across the seven scenarios. It does send more messages in total, because the ship summary repeats every 3 days while an alert lasts; each is one crew-level note about the cabin, not a medical case.

### Which reading of the 3 mmHg limit

Three versions of the rule, base case, on the tuning seeds (5000-5199) and the reported seeds (1000-1199):

| Air counts as a suspect when | Accuracy | Ship events missed | False ship alarms per crew-day |
| --- | --- | --- | --- |
| Above its own baseline only (before) | 0.920 / 0.906 | 26.7% / 23.3% | 0.0122 / 0.0148 |
| ... or the highest 1-hour average is over 3 mmHg | 0.905 / 0.894 | 23.3% / 23.3% | 0.0163 / 0.0192 |
| ... or the 24 h mean is over 3 mmHg (built) | 0.923 / 0.904 | 23.3% / 23.3% | 0.0131 / 0.0152 |

These were measured before the slow-change check; with it, the built rule scores 0.923 / 0.903.

The scorer counts a ship event only as a rise of 1 mmHg above the trace's median, so an alert on a cabin that is high all along counts as false here even though the simulated crew's headache risk is raised. The cost of the limit check is therefore an upper bound. Days with a 24 h mean over 3 mmHg occur in 3 of the 10 traces (29 days); days with a 1-hour peak over 3 mmHg occur in 5 (64 days).

### Masking: a personal problem during a ship alert

During a ship alert, anyone with a CO₂-linked change is put down to the ship, and the day-3 count runs per likely cause. A personal problem that starts during an alert is therefore labelled "the ship" until the air recovers. Base case:

| Personal events (4-7 days) | Overlapping a ship alert | With no ship alert |
| --- | --- | --- |
| Events | 32 | 220 |
| Put down to the ship on at least one day | 28 | 0 |
| Never labelled personal | 8 | 17 |
| Never reached the flight surgeon | 25 | 97 |

The headline accuracy leaves out the 59 person-days on which a personal event and a CO₂ rise coincide. We tried a rule that puts a change down to the person when it starts days into an alert, after the CO₂ peaked: on the reported seeds it left "never labelled personal" at 8 of 32, got one more event to the flight surgeon and lowered accuracy from 0.903 to 0.893, so it is not built.

### A slow decline

One crew member's mood falls and stress rises by 0.1 slider points a day from day 15 of the trace. Scored on the 80 declines whose trace leaves at least 30 days:

| | Before the slow-change check | Built |
| --- | --- | --- |
| Flagged as a slow change | 0% | 94%, median 25 days after the decline started |
| Reached the flight surgeon | 9%, median 33 days | 93%, median 26 days |

In the base case the check leaves accuracy at 0.903 (0.904 before) and raises needless surgeon summaries from 0.0015 to 0.0017 per crew-day.

### One crew member under-reports

One crew member never ticks a symptom and reports every slider one point better than it is. CO₂ rises missed go from 23% to 30%, and personal events missed from 8% to 12%. The rule needs half the crew, so one silent person makes a ship alert harder to reach. Nothing in the app makes silence less likely; the check-in only makes reporting quick.

## NASA Human System Risks

`src/data/hrp.ts` links every reading to the NASA Human System Risk it informs, with the titles and pages as on NASA's [Human System Risks](https://www.nasa.gov/hhp/human-system-risks/) list (read 15 Nov 2026). The challenge page lists them all (the check-in no longer shows them, 15 Nov 2026) with what NASA's sources say. No rule reads the file.

| Reading | NASA Human System Risk |
| --- | --- |
| Sleep duration and quality, alertness | Sleep Loss, Circadian Desynchronization, and Work Overload |
| Fatigue | Sleep Loss; CO₂ Risk |
| Mood and stress | Behavioral Health Risk |
| Irritability | Behavioral Health Risk; Team Risk |
| Headache | CO₂ Risk; SANS Risk (fluid shift) |
| Congestion, dry or sore eyes | Inflight Medical Conditions (the humidity link is [V2 6012]) |
| Dizziness, nausea | Sensorimotor Risk |
| Exercise | Bone Fracture; Muscle Risk; Aerobic Risk |
| Cabin CO₂ | CO₂ Risk |
| Cabin temperature | Sleep Loss (temperature is among the factors that inhibit sleep) |
| Cabin humidity | Inflight Medical Conditions; no risk of its own |
| Radiation dose | Radiation Carcinogenesis |
| Distance from Earth (message delay) | Earth Independent Human-Systems Operations (EIHSO Risk) |
| Watch: heart rate, HRV / blood oxygen (shown only) | CV Risk / Hypoxia |

## Limits

- The crew is simulated. Only the cabin data (CO₂, temperature, humidity) and the thresholds are real.
- Temperature and humidity are checked but cannot be validated here: on the real traces they rarely leave NASA's comfort range, and no crew effect of them is simulated.
- The simulated crews sleep about 40 minutes more than ISS astronauts reported; the comparison is on the challenge page.
- The CO₂ series is the ISS-side telemetry published for a rodent-research payload. It may differ from a cabin-wide average. Its rise starts as a step at 00:00 UTC on 2018-08-20 (2.6 to 4.9 mmHg), it steps down at 00:00 UTC the next day (4.9 to 4.3 mmHg), and it holds at 4.94-4.95 mmHg for several hours at a time. These may be artifacts of how the data was recorded or published; the 1-hour peak that flags day 212 comes from them. The series is replayed as published. The Ship screen no longer carries these notes or the data source (its "Where the cabin data comes from" and "Why the app says this" cards were removed on 15 Nov 2026); the source is in the demo dock's "About the data".
- As context, not cause: NASA's ISS Daily Summary Report of 16 Aug 2018, four days before the rise, describes a "split atmosphere" test of the Lab CO₂ removal assembly (CDRA), planned to last at least 5 days. NASA's reports don't say whether the two are linked, and the app does not claim they are.
- Headache risk follows the published odds per check-in day; the paper used 7-day averages.
- Effect sizes for sleep, fatigue and irritability are demo parameters.
- The rule is not validated on real crews. Browser reaction times are estimates.
- Radiation figures are published averages per setting, not dosimeter readings, and leave out solar storms. The Moon and Mars rates are dose equivalent; NASA's limit is effective dose.
- A personal problem that starts during a ship alert is put down to the ship until the air recovers (masking, under "Evidence").
- A slow change is judged against the first 14 check-ins. If those were unusually good days, a return to normal can read as a slow change.

## Open items

- **The crew board still shares sleep and symptoms.** `CONTEXT.md` says a check-in's answers reach the flight surgeon and never crewmates. The board and the crew medical officer's inbox still follow the privacy table above (sleep, fatigue, irritability, alertness and symptoms shared). That privacy change is not built yet. The check-in page used to say what the build does in its first line ("Sleep, fatigue, irritability and symptoms go to your crew medical officer and your flight surgeon. Mood and stress stay yours, unless you are still off on day 3"); that line was removed at the team's request, so the page no longer says who receives the answers.

- The `v1.0-submission` tag.
- README sections for the challenge map and the Antarctic case (both are in the app: the demo dock's settings → How it answers the challenge), and the Antarctic sources in `docs/CITATIONS.md`.
- The 30-second video.
- Opening each source in `docs/CITATIONS.md` that is still marked "No" before quoting it on the project page.
