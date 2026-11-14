# Shipshape — overall plan v0.1 (for team input)

Nov 14, 2026 · @Frantisek Kares

## Summary

Shipshape is a crew check-in game for long missions. It rewards honest reporting and tells the crew whether a bad day is likely them or the ship.

This is draft v0.1 from 12:45 Saturday and nothing is locked yet. Comment anywhere; the next section lists the calls only you can make.

- **Users:** a 4-person crew on a long Mars mission without real-time ground contact, their crew medical officer, and the flight surgeon on Earth, reached with a delay.
- **Hooks:** "Rewards honesty, not perfection." "Is it me, or the ship?"
- **NASA data:** real ISS cabin CO₂ from NASA's Open Science Data Repository (OSDR) drives the ship-or-me decision. Thresholds come from NASA-STD-3001 and NASA flight studies.
- **Framing:** a behavioral-health piece of NASA's planned onboard decision support for Earth-independent medical operations. It combines environmental and behavioral data and supports the flight surgeon, never replaces one.
- **Not:** an AI doctor, a diagnosis tool or a leaderboard.
- **Projected score:** about 21 of 25 if the demo path ships as planned (see Scores and risks).

## Decisions we need from you

Ten calls are open. Each row has my recommendation; mark any you'd change before G2 at 13:30.

| # | Decision | Options | Recommendation | Why |
| --- | --- | --- | --- | --- |
| 1 | Name | Shipshape, Candor, Tether | Shipshape | "Ship" plus "in good order" matches the hook |
| 2 | The two hooks | Keep both, drop one, swap one | Keep both | One answers generic dashboards, the other under-reporting |
| 3 | Game depth | Full rules or a minimal set | Full rules, light UI | The rules are small tested functions; the UI shows XP, a weekly streak and one quest card |
| 4 | Mission setting | Mars mission, lunar surface, Gateway | Mars mission | Longest isolation and delay. We say plainly that the CO₂ data comes from the ISS |
| 5 | What the crew board shares by default | Everything; sleep and symptoms; nothing | Sleep and symptoms shared, mood and stress private | Mood appears only as counts, never with names |
| 6 | Live input in the demo | Presenter's own reaction test, or all simulated | Live reaction test | A real measurement at no extra cost, never stored |
| 7 | Wearable | Bluetooth heart-rate strap, or none | None, unless you own a strap | About 2 h of work and Chrome-only |
| 8 | AI | None, or an LLM that only words the summaries | None in decisions; LLM wording is a Next item | NASA flags hallucination risk; rules stay explainable |
| 9 | Demo format | 30-second video or 7 slides | 30-second video | It shows the app working and still works if the live link fails |
| 10 | Earth use | Submarines, polar stations, offices and classrooms | Pick one with a sourced number | Impact needs one concrete case |

Facts still missing: your local cutoff, whether there is a live pitch, and the list on the challenge's Resources tab.

## How it works

Every morning check-in is compared with that person's own normal. When people drift, the ship-or-me rule checks the rest of the crew and the cabin air before naming a likely cause.

&#91;embedded content: ship-or-me flow · 2 inputs, 1 decision, 3 outcomes\]

CO₂-linked readings decide ship or me; mood never does. Every outcome is re-checked at the next check-in, and anything still off on day 3 goes to the flight surgeon.

| Data | You | Crew board | Crew medical officer | Flight surgeon |
| --- | --- | --- | --- | --- |
| Your mood and stress | Everything | Counts only, no names | Only if you share | In tier 3 summaries |
| Your sleep and symptoms | Everything | Yes, by default | Yes | In tier 3 summaries |
| Ship alerts and quests | Yes | Yes | Yes | In summaries |
| Safety answers | Yes | Never | Immediately | Immediately |

The game sits around this flow, never inside it. It counts check-ins and actions and never changes a status.

## What we build

Seven screens make up the golden path. Nothing else gets built until that path runs end to end.

| Screen | What it shows | In the golden path |
| --- | --- | --- |
| Crew board | Four body sketches. Each shows the person's shared indicators as shape, icon and word, plus the ship banner, the quest card and an XP and streak strip | Yes |
| Check-in | Sliders for sleep, fatigue, irritability, stress and mood; symptom ticks; the reaction test; a "why we ask" line on each | Yes |
| Me | Personal trend charts with a "your normal" band, private cards, my XP | Yes |
| Ship alert | CO₂ against the cabin's usual level and the 3 mmHg line, how many crew are affected, the quest checklist | Yes |
| Learn cards | 20-second explainers: why this test, how CO₂ and sleep affect you | Two cards |
| Flight-surgeon summary | A one-page summary sent with the delay | Yes, simple |
| Role switcher | Anna, Ben, Chen, Dana, the crew medical officer and the flight surgeon; mission day and comm delay | Yes |

| Stage | Items |
| --- | --- |
| Built now (by Sun 12:00) | The seven screens, the rules engine, the seeded crew simulator, the backtest with metrics, the real CO₂ replay, unit tests, a public deploy |
| Next | Bluetooth heart-rate input; a radiation channel from DONKI and RadLab (partner-agency data); LLM wording of the flight-surgeon summary with a template fallback; a "did it work" check after each action; game seasons per mission phase |
| Vision | Runs offline on the vehicle network; a pilot in a NASA analog habitat; part of an onboard decision-support system; an Earth version, "Is it me or the building?" |

## Science: indicators, rules, escalation

Every threshold is either cited or labeled a demo parameter. The app says "likely" and never diagnoses.

| Indicator | How it's measured in flight | Rule in the app | Source or label |
| --- | --- | --- | --- |
| Sleep duration and quality | Morning self-report, as in NASA's Reaction Self Test; wrist actigraphy later | Watch after under 6 h on 3 or more nights, or below own normal for 3 or more days | ISS study: under 6 h linked to slower responses and higher stress |
| Alertness | Reaction test: 3 minutes in the flight protocol, 30 seconds in the demo | Response speed below own normal for 3 or more days | Demo parameter; browser timing is an estimate |
| Headache and symptoms | Tick list | Counts toward the crew cluster | Law et al. 2014: headache odds doubled per 1 mmHg of CO₂ |
| Fatigue and irritability | Sliders | Own normal; counts toward the crew cluster | Higher CO₂ also linked to sleep problems, fatigue and irritability |
| Mood and stress | Private sliders | Own normal only; not used in the ship rule | Demo parameter; no CO₂ evidence for mood |
| Cabin CO₂ | Cabin sensors; real ISS data from NASA OSDR | Above the cabin's own baseline; flagged above a 3 mmHg one-hour average | NASA-STD-3001 Vol 2 \[V2 6004\] |

The ship-or-me rule decides between three outcomes:

1. **Ship:** at least half the crew drift on CO₂-linked indicators within 24 h, while cabin CO₂ is above its baseline.
2. **Me:** one person drifts and the cabin is normal.
3. **Shared, not the air:** several drift but the cabin is normal. The crew medical officer gets the pattern, with no names.

Microgravity fluid shifts also cause headaches, so the rule needs crew-wide timing plus the CO₂ rise.

| Tier | Trigger | What happens | Who sees it |
| --- | --- | --- | --- |
| 0 | Everything within normal | Monitor | You |
| 1 | Watch on any indicator | Private self-care card | You |
| 2 | A crew pattern, or a Watch you chose to share | Crew medical officer informed | Crew medical officer |
| 3 | Still off on day 3 | Delayed summary to the flight surgeon; you're told it was sent | Flight surgeon |
| 4 | A safety answer such as self-harm | Game paused; immediate private escalation | Flight surgeon and crew medical officer |

Cards say "below your usual for 4 days", never a diagnosis. Each shows how fresh its data is, and simulated data is labeled everywhere.

## Game rules: honesty first

The game rewards measuring and acting, never the reading itself. A bad-day report earns the same XP as a good one.

| Mechanic | Rule |
| --- | --- |
| XP | Earned for a check-in (the same on good and bad days), an action done, a learn card read, kudos given |
| Never rewarded | Green readings, improving numbers, streaks of good days |
| Streak | Weekly: 5 of 7 days counts. Shields cover spacewalk, comm-blackout and heavy-workload days |
| Crew quests | Shared goals, from ship alerts ("Clear the air") or habits ("everyone logs sleep 5 nights") |
| Kudos | Crewmates thank each other for countermeasures (the Strava part) |
| Learn cards | 20-second explainers that earn XP (the Duolingo part). They answer the challenge's five questions |
| Leaderboards | None; nobody is ranked |
| Rewards | Symbolic badges or crew-chosen leisure. Never family calls, care packages or private conferences: those are support, not prizes |
| Alerts | No celebration on alerts; a safety answer skips the game entirely |

Why this design: astronauts under-report symptoms for fear of losing missions (Institute of Medicine, 2001). Reviews also find that engagement does not guarantee benefit, so we claim the mechanism, not a proven outcome.

## Data and architecture

Only the cabin data and the thresholds are real. The crew is simulated, seeded and labeled as simulated everywhere.

| Data | Real or simulated | Used for | Source |
| --- | --- | --- | --- |
| ISS cabin CO₂, temperature, humidity | Real | The ship signal, replayed as the cabin feed | [NASA OSDR Environmental Data Application](https://visualization.osdr.nasa.gov/eda) |
| Thresholds and evidence | Real documents | Rules and the "why" panels | NASA-STD-3001, Law et al. 2014, the Reaction Self Test (see Sources) |
| Four-person crew check-ins | Simulated, seeded | Demo and backtest | Our generator, calibrated to published ISS figures |
| Presenter's reaction test | Live, never stored | Demo | None |
| DONKI, RadLab, OSD-569 | Real | Next, not in the golden path | CCMC and NASA OSDR |

Data rules: never rescale real data. If the CO₂ trace has no usable rise, we overlay a labeled simulated scrubber fault on the real baseline. Snapshots carry checksums, and the demo runs from snapshots.

- Vite + React + TypeScript web app that installs and works offline. Data ships as static JSON, with no backend and no login.
- The engine is a set of small tested TypeScript functions: baseline, deviation, ship-or-me, escalation. The game rules sit beside it: XP, streak, quests.
- Python scripts produce the JSON: the CO₂ snapshot, the seeded crew simulator and the backtest metrics.
- No LLM in the decision path. Deploys on Vercel from main; we tag v1.0-submission when we submit.
- At G2 we fix the JSON shapes for check-ins, cabin readings and engine output, so all three tracks can build in parallel.

```
src/engine/   baseline.ts  deviation.ts  shipOrMe.ts  escalation.ts
src/game/     xp.ts  streak.ts  quests.ts
src/ui/       CrewBoard  CheckIn  MeView  ShipAlert  LearnCards  SurgeonSummary
scripts/      snapshot_eda.py  simulate_crew.py  backtest.py
public/data/  cabin.json  crew.json  backtest.json
docs/         SPEC.md  CITATIONS.md  AI_USE_LOG.md
```

## Evidence plan

We publish measured numbers from a seeded backtest: how often the rule names the right cause, how fast it alerts, and how often it alerts for nothing.

- **Unit tests** cover every rule: baseline, persistence, ship-or-me, escalation, and "XP never depends on a reading".
- **Backtest:** 200 simulated crews over 90 days each, seeded. The CO₂ comes from real ISS traces, symptom risk follows the published odds (doubling per 1 mmHg), and individual events are injected (sleep loss, runs of symptoms).
- **Sensitivity checks:** the CO₂ effect halved and doubled, 20% of check-ins missed, noisier self-reports.

| Metric | What it means |
| --- | --- |
| Ship-or-me accuracy | Share of events where the rule names the right cause |
| Detection delay | Days from an event's start to the alert |
| False alarms | Alerts with no event, per crew-day |
| Missed events | Events that never trigger an alert |

Stated limits: the crew data is simulated, and effect sizes come from published ISS data. The rule is not validated on real crews, and browser reaction times are estimates.

## Demo: the 30-second golden path

One scripted path shows trigger, detection, explanation, action and escalation in 28 seconds, with real NASA data on screen.

| Time | On screen | Caption or voice |
| --- | --- | --- |
| 0:00–0:05 | Crew board, day 212 of a Mars mission; four bodies, all ● OK (simulated crew, labeled) | Team and challenge captions; "Far from Earth, the crew looks after itself." |
| 0:05–0:12 | The real ISS CO₂ trace (NASA OSDR, labeled) climbs. After the check-ins, three heads show ▲ for headache and poor sleep, and the banner reads "It's the ship, not you" | "Is it me, or the ship?" |
| 0:12–0:18 | The why panel shows CO₂ against usual, the 3 mmHg line and the NASA headache study. The "Clear the air" quest gets done and the crew earns XP | Title and tagline |
| 0:18–0:25 | CO₂ is back to normal but one body still shows ▲. A private card appears; on day 3 a summary goes to the flight surgeon | "If it's you, only you see it." |
| 0:25–0:28 | "+XP: honest report", then the Earth use | "Shipshape rewards honesty, not perfection." |

Captions follow the official order: team at 0:00, challenge at 0:02, title at 0:05, how it works from 0:10, the future from 0:20. Subtitles are burned in, and we check the host's displayed length before submitting.

## Timeline, gates and roles

The golden path must be live by Sat 19:00, and we submit by Sun 20:00, about 4 hours before the portal closes.

&#91;embedded content: hackathon plan · 7 blocks, 6 gates\]

Each block ends at a gate. If a gate slips, we cut scope in the order under Scores and risks, not sleep. The times move once you confirm your local cutoff.

| Person | Owns | First task at 13:30 | Branch |
| --- | --- | --- | --- |
| AI/ML | Engine, crew simulator, backtest, CO₂ snapshot | CO₂ snapshot and the crew simulator | engine |
| Software engineer | Crew board, check-in with the reaction test, Me view, cards | Crew board on fixture data | ui |
| DevOps | Repo, CI and deploy, game rules, story and submission | Game rules and the deploy pipeline | game |

We merge twice on Saturday: at 16:00 (engine and UI on fixture data) and at 19:00 (the golden path). Each of you runs your own Claude Code session on your own branch.

## Scores and risks

Projected about 21 of 25 if the golden path ships. Today it scores 15, because nothing is built yet and the rubric caps unproven ideas at 3.

| Criterion | Today | If it ships | What lifts it |
| --- | --- | --- | --- |
| Impact | 3 | 4 | One Earth use with a sourced number |
| Creativity | 3 | 4 | The demo opens on ship-or-me, not on points |
| Validity | 3 | 4 | Backtest with sensitivity checks and stated limits |
| Relevance | 3 | 4–5 | Dataset ID on screen; a table mapping the challenge's five questions to screens |
| Presentation | 3 | 4–5 | 28-second video, burned-in subtitles, a one-page judge's summary |

| Risk | Mitigation |
| --- | --- |
| Judges read it as "another mood app" | Lead with ship-or-me; points appear once, as the honesty reward |
| Crew data is simulated | Calibrate to published ISS figures, use real CO₂, state the limits |
| Overclaiming a CO₂ effect on mood | The ship signal uses headache, sleep, fatigue and irritability only |
| Privacy and stigma | Opt-in sharing; counts, not names; private escalation |
| The CO₂ trace has no usable rise | A labeled simulated fault on top of the real baseline |
| Falling behind schedule | The cut order below |
| Demo runs over 30 seconds | Target 28 seconds; check the host's displayed length |

Cut order if we fall behind: kudos first, then learn cards beyond two, then polish on the flight-surgeon summary, then the trend charts. Never cut the golden path, the real CO₂ data, the labels, the demo or the submission checklist.

## Sources

All found through web search on 14 Nov. Open each page before quoting it on the project page.

- [NASA OCHMO-TB-004, Carbon Dioxide: NASA-STD-3001 \[V2 6004\], the 3 mmHg one-hour limit](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf)
- [Law et al. 2014, ISS CO₂ levels and reported headaches (ScienceDaily summary)](https://sciencedaily.com/releases/2014/05/140501100922.htm)
- [Smithsonian on Law et al. 2014, including her comment on CO₂ and emotions](https://www.smithsonianmag.com/daily-planet/why-living-space-can-be-pain-head-180951507/)
- [NASA Spinoff: the PVT-B reaction test, flown as the ISS Reaction Self-Test](https://spinoff.nasa.gov/Spinoff2013/hm_1.html)
- [Sleep deficiency in spaceflight: the ISS Reaction Self Test study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197)
- [Institute of Medicine, Safe Passage (2001): pressure to under-report](https://www.nationalacademies.org/read/10218/chapter/8)
- [NASA: how astronaut health care works in space, including behavioral support](https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space)
- [NASA OSDR Environmental Data Application](https://visualization.osdr.nasa.gov/eda)
- [Gamification for mental health: systematic review, JMIR Mental Health 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6617915/)
- [Engagement features in mental-health apps: meta-analysis, npj Digital Medicine 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7878769)
- [The engagement–efficacy–ethics trilemma in gamified mental-health tools: systematic review](https://www.mdpi.com/2078-2489/17/2/168)
