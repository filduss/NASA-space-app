# Citations

Sources behind the rules and the "why" text. The links come from [plan v0.1](plan-v0.1.md) (found by web search on 14 Nov 2026). The "Checked" column says whether anyone on the team has opened the page and confirmed the claim; do that before quoting it on the project page.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| CO₂ limit | 1-hour average limited to 3 mmHg | [NASA OCHMO-TB-004, Carbon Dioxide: NASA-STD-3001 Vol 2 \[V2 6004\]](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Yes: opened by Frantisek Kares on 15 Nov 2026 |
| Headache rule, simulator | Odds of a reported headache doubled per 1 mmHg of CO₂; risk below 1% needs a 7-day average under 2.5 mmHg | [Law et al. 2014, J Occup Environ Med 56(5):477-83](https://doi.org/10.1097/JOM.0000000000000158) (full reference below) | Abstract only: read on PubMed (PMID 24806559) on 14 Nov 2026; both claims are in it. Full text not read |
| Mood is not in the ship rule | No CO₂ evidence for mood | [Smithsonian on Law et al. 2014](https://www.smithsonianmag.com/daily-planet/why-living-space-can-be-pain-head-180951507/) | No |
| Reaction test | PVT-B, flown as the ISS Reaction Self-Test, 3 minutes | [NASA Spinoff 2013](https://spinoff.nasa.gov/Spinoff2013/hm_1.html) | No |
| Sleep rule | Under 6 h linked to slower responses and higher stress | [Sleep deficiency in spaceflight: the ISS Reaction Self Test study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197) | No |
| Game design | Astronauts under-report symptoms for fear of losing missions | [Institute of Medicine, Safe Passage (2001)](https://www.nationalacademies.org/read/10218/chapter/8) | No |
| Framing | Behavioral support in astronaut health care | [NASA: how astronaut health care works in space](https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space) | No |
| Game design | Engagement does not guarantee benefit | [JMIR Mental Health 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6617915/), [npj Digital Medicine 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7878769), [MDPI Information 17(2):168](https://www.mdpi.com/2078-2489/17/2/168) | No |

## Full references

- Law J, Van Baalen M, Foy M, Mason SS, Mendez C, Wear ML, Meyers VE, Alexander D. Relationship between carbon dioxide levels and reported headaches on the International Space Station. *J Occup Environ Med.* 2014;56(5):477-483. doi:[10.1097/JOM.0000000000000158](https://doi.org/10.1097/JOM.0000000000000158). PMID: [24806559](https://pubmed.ncbi.nlm.nih.gov/24806559/). Erratum in *J Occup Environ Med.* 2014;56(9):e82.
  - What the abstract says: ISS crew headache reports and CO₂ measurements, averaged over 24-hour and 7-day periods, modeled with logistic regression. "For each 1-mm Hg increase in CO(2), the odds of a crew member reporting a headache doubled. To keep the risk of headache below 1%, average 7-day CO(2) would need to be maintained below 2.5 mm Hg (current ISS range: 1 to 9 mm Hg)."
  - The individual crew records behind the paper are medical data and are not public. The app uses only the published result.

## Data

| Data | Source | Checked |
| --- | --- | --- |
| ISS CO₂, temperature and humidity | [NASA OSDR Environmental Data Application](https://visualization.osdr.nasa.gov/eda), API `https://visualization.osdr.nasa.gov/eda/api/missions/{mission}/telemetry_data/` | Yes: downloaded 14 Nov 2026; the SHA-256 of each raw response is in `scripts/snapshots/*_hourly.json` |
| Demo cabin feed | Mission RR-7, [OSDR payload page](https://osdr.nasa.gov/bio/repo/data/payloads/RR-7) | Data yes; payload page not opened |
| Backtest traces | Missions RR-1, RR-3, RR-5, RR-6, RR-7, RR-9, RR-10, RR-12, RR-19, RR-23 | Yes |
| 3D skeleton (`public/models/skeleton.glb`, `/dashboard`) | Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0). Modified by [open-anatomy-3d](https://github.com/MervinR07/open-anatomy-3d) (CC BY 4.0, npm 0.1.0, male model). Skeleton extracted and re-exported. Credit shown in the dashboard footer. | Credit text from the model's README; source repo not opened |

## Statements that are ours, not a source's

- The simulator anchors headache risk at 1% per check-in at 2.5 mmHg and applies it to each day's 24 h mean. The abstract gives 1% at a 7-day average of 2.5 mmHg; using it per daily check-in is our simplification.
- The Earth-Mars one-way delay options (4, 12, 22 minutes) reflect the commonly cited range of roughly 3 to 22 minutes.
- Everything labeled "demo parameter" in `src/engine/config.ts` and `scripts/shipshape_sim.py`.

## Added with the judge fixes

Found during the judge-fixes work on 14-15 Nov 2026 (by an AI subagent and by web search), then opened and confirmed by the team before going on screen.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| Context for the real CO₂ rise (Ship screen, "Where the cabin data comes from") | On 16 Aug 2018, four days before the rise, the ISS was set up for a "split atmosphere" test of the Lab CO₂ removal assembly (CDRA), planned for at least 5 days. Shown as context, not cause: NASA's reports don't say whether the two are linked | [NASA ISS Daily Summary Report, 16 Aug 2018](https://www.nasa.gov/blogs/stationreport/2018/08/16/iss-daily-summary-report-8-16-2018/) | Yes: opened by Frantisek Kares on 15 Nov 2026 (first read by an AI subagent on 14 Nov) |
| Reaction test lapse | PVT-B counts a lapse at 355 ms; the app's test counts lapses the same way | Basner M, Mollicone DJ, Dinges DF. Validity and sensitivity of a brief psychomotor vigilance test (PVT-B) to total and partial sleep deprivation. *Acta Astronautica* 2011;69(11-12):949-959 | Yes: opened by Frantisek Kares on 15 Nov 2026 |
| Exercise "why we ask" on the check-in | In spaceflight, weight-bearing bones lose on average 1% to 1.5% of mineral density per month | [NASA, The Human Body in Space](https://www.nasa.gov/humans-in-space/the-human-body-in-space/); also [HRP Bone Fracture evidence report (2024)](https://humanresearchroadmap.nasa.gov/evidence/reports/Bone%20Fracture%20Evidence%20Report_07-18-2024.pdf) | Yes: NASA page opened by Frantisek Kares on 15 Nov 2026 |
| Exercise target (120 min a day) | ISS crews exercise about two hours a day; the schedule allows 2.5 hours a day, 6 days a week, including setup | [NASA, Counteracting Bone and Muscle Loss in Microgravity](https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/); also [NASA OCHMO-TB-031, Exercise Overview](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf) | Yes: NASA page opened by Frantisek Kares on 15 Nov 2026 |

## Radiation and mission settings

Added with the mission setting and the radiation card on the Ship screen.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| Career limit | Career effective dose from spaceflight radiation under 600 mSv, the same for all ages and sexes: NASA-STD-3001 Vol 1 Rev B [V1 4030] | [NASA OCHMO-TB-020 Rev E (2022), Design for Ionizing Radiation Protection](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) | Yes: text read on 14 Nov 2026 |
| Radiation card text | Dose raises cancer risk and may affect cognition and behavior; a solar particle event can cause nausea, vomiting and fatigue; crews shelter when warned; in a capsule example, water and stowage rearranged as a shelter cut each person's event dose to about a third | Same brief | Yes: text read on 14 Nov 2026 |
| ISS dose rate | 0.2 to 0.5 mSv a day of effective dose; the app uses 0.5 | [Simonsen, Zawaski and Weeks, NASA, NTRS 20250006168](https://ntrs.nasa.gov/citations/20250006168) | Yes: text read on 14 Nov 2026 |
| Lunar surface dose rate | 1,369 µSv a day of dose equivalent, measured by Chang'E-4 | [Zhang et al. 2020, Science Advances 6(39):eaaz1334](https://doi.org/10.1126/sciadv.aaz1334) | Yes: full text read on 14 Nov 2026 ([PMC7518862](https://pmc.ncbi.nlm.nih.gov/articles/PMC7518862/)): "an average dose equivalent of 1369 μSv/day on the surface of the Moon". The same paper gives 731 μSv/day on the ISS (DOSIS 3D DOSTEL) for the same period |
| Mars transit dose rate | About 1.8 mSv a day of dose equivalent in cruise, measured by Curiosity's RAD | [Zeitlin et al. 2013, Science 340(6136):1080-1084](https://doi.org/10.1126/science.1235989) | Partly: abstract read on PubMed (PMID [23723233](https://pubmed.ncbi.nlm.nih.gov/23723233/)) on 14 Nov 2026; it gives 0.66 ± 0.12 Sv for the shortest round trip. The 1.8 mSv/day cruise rate is the lead author's figure in the [SwRI press release](https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars); the full text is paywalled |

- The Moon delay (1.3 s) is the Earth-Moon distance divided by the speed of light. The ISS delay is shown as "less than a second", not as a measured figure.
- Dose so far is the rate times the mission day. It leaves out solar storms and earlier missions, and the Moon and Mars rates are dose equivalent while the limit is effective dose, so the card labels every number an estimate.

## Found for the check-in redesign

Found by web search on 15 Nov 2026 and read by an AI subagent. They shaped the check-in (which fields stay, sleep from a wearable, the conference request); none of their claims is on screen.

| Used for | Claim (docs only) | Source | Checked |
| --- | --- | --- | --- |
| Ratings | ISS crews rated sleep quality (morning), workload (evening), stress, mental fatigue, physical exhaustion, tiredness and sleepiness on 11-point scales before each PVT-B, every 4th day in flight; sleep duration was self-reported | Jones CW et al. Sleep deficiency in spaceflight is associated with degraded neurobehavioral functions and elevated stress in astronauts on six-month missions aboard the ISS. *Sleep* 2022;45(3):zsac006, [PMC8919197](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197/) (already listed above for the sleep rule) | No |
| Wearable | Spaceflight Standard Measures: a wrist actigraph records sleep timing, latency, awakenings, efficiency, light and activity in 14-day blocks; sleep logs and end-of-day surveys are self-reported; collection is about 87% complete | [Spaceflight Standard Measures, *npj Microgravity* 2025;11:78, PMC12612093](https://pmc.ncbi.nlm.nih.gov/articles/PMC12612093/) | No |
| Conference request | ISS crews have a weekly private medical conference with the flight surgeon, also on request, and a private psychological conference every two weeks | [NASA podcast: Mission Control crew health consoles](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/mission-control-crew-health-consoles); [NTRS 20170003866](https://ntrs.nasa.gov/api/citations/20170003866/downloads/20170003866.pdf) | No |
