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

## Radiation and mission settings

Added with the mission setting and the radiation card on the Ship screen.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| Career limit | Career effective dose from spaceflight radiation under 600 mSv, the same for all ages and sexes: NASA-STD-3001 Vol 1 Rev B [V1 4030] | [NASA OCHMO-TB-020 Rev E (2022), Design for Ionizing Radiation Protection](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) | Yes: text read on 14 Nov 2026 |
| Radiation card text | Dose raises cancer risk and may affect cognition and behavior; a solar particle event can cause nausea, vomiting and fatigue; crews shelter when warned; in a capsule example, water and stowage rearranged as a shelter cut each person's event dose to about a third | Same brief | Yes: text read on 14 Nov 2026 |
| ISS dose rate | 0.2 to 0.5 mSv a day of effective dose; the app uses 0.5 | [Simonsen, Zawaski and Weeks, NASA, NTRS 20250006168](https://ntrs.nasa.gov/citations/20250006168) | Yes: text read on 14 Nov 2026 |
| Lunar surface dose rate | 1,369 µSv a day of dose equivalent, measured by Chang'E-4 | [Zhang et al. 2020, Science Advances 6(39):eaaz1334](https://doi.org/10.1126/sciadv.aaz1334) | Figure confirmed in news coverage of the paper; paper not opened |
| Mars transit dose rate | About 1.8 mSv a day of dose equivalent in cruise, measured by Curiosity's RAD | [Zeitlin et al. 2013, Science 340(6136):1080-1084](https://doi.org/10.1126/science.1235989) | Figure confirmed in the SwRI press release quoting the lead author; paper not opened |

- The Moon delay (1.3 s) is the Earth-Moon distance divided by the speed of light. The ISS delay is shown as "less than a second", not as a measured figure.
- Dose so far is the rate times the mission day. It leaves out solar storms and earlier missions, and the Moon and Mars rates are dose equivalent while the limit is effective dose, so the card labels every number an estimate.
