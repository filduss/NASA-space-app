# Citations

Sources behind the rules and the "why" text. The links come from plan v0.1 (found by web search on 14 Nov 2026). The "Checked" column says whether anyone on the team has opened the page and confirmed the claim; do that before quoting it on the project page.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| CO₂ limit | 1-hour average limited to 3 mmHg | [NASA OCHMO-TB-004, Carbon Dioxide: NASA-STD-3001 Vol 2 \[V2 6004\]](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | No |
| Headache rule, simulator | Odds of a reported headache doubled per 1 mmHg of CO₂ | [Law et al. 2014 (ScienceDaily summary)](https://sciencedaily.com/releases/2014/05/140501100922.htm) | No |
| Mood is not in the ship rule | No CO₂ evidence for mood | [Smithsonian on Law et al. 2014](https://www.smithsonianmag.com/daily-planet/why-living-space-can-be-pain-head-180951507/) | No |
| Reaction test | PVT-B, flown as the ISS Reaction Self-Test, 3 minutes | [NASA Spinoff 2013](https://spinoff.nasa.gov/Spinoff2013/hm_1.html) | No |
| Sleep rule | Under 6 h linked to slower responses and higher stress | [Sleep deficiency in spaceflight: the ISS Reaction Self Test study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197) | No |
| Game design | Astronauts under-report symptoms for fear of losing missions | [Institute of Medicine, Safe Passage (2001)](https://www.nationalacademies.org/read/10218/chapter/8) | No |
| Framing | Behavioral support in astronaut health care | [NASA: how astronaut health care works in space](https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space) | No |
| Game design | Engagement does not guarantee benefit | [JMIR Mental Health 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6617915/), [npj Digital Medicine 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7878769), [MDPI Information 17(2):168](https://www.mdpi.com/2078-2489/17/2/168) | No |

## Data

| Data | Source | Checked |
| --- | --- | --- |
| ISS CO₂, temperature and humidity | [NASA OSDR Environmental Data Application](https://visualization.osdr.nasa.gov/eda), API `https://visualization.osdr.nasa.gov/eda/api/missions/{mission}/telemetry_data/` | Yes: downloaded 14 Nov 2026; the SHA-256 of each raw response is in `scripts/snapshots/*_hourly.json` |
| Demo cabin feed | Mission RR-7, [OSDR payload page](https://osdr.nasa.gov/bio/repo/data/payloads/RR-7) | Data yes; payload page not opened |
| Backtest traces | Missions RR-1, RR-3, RR-5, RR-6, RR-7, RR-9, RR-10, RR-12, RR-19, RR-23 | Yes |

## Statements that are ours, not a source's

- The simulator anchors headache risk at 1% per check-in at 2.5 mmHg. That figure is recalled from the Law et al. abstract and is not in the plan's notes; confirm it against the paper.
- The Earth-Mars one-way delay options (4, 12, 22 minutes) reflect the commonly cited range of roughly 3 to 22 minutes.
- Everything labeled "demo parameter" in `src/engine/config.ts` and `scripts/shipshape_sim.py`.
