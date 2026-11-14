# Citations

Sources behind the rules and the "why" text. The links come from plan v0.1 (found by web search on 14 Nov 2026). The "Checked" column says whether anyone on the team has opened the page and confirmed the claim; do that before quoting it on the project page.

| Used for | Claim in the app | Source | Checked |
| --- | --- | --- | --- |
| CO₂ limit | 1-hour average limited to 3 mmHg | [NASA OCHMO-TB-004, Carbon Dioxide: NASA-STD-3001 Vol 2 \[V2 6004\]](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | No |
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

## Statements that are ours, not a source's

- The simulator anchors headache risk at 1% per check-in at 2.5 mmHg and applies it to each day's 24 h mean. The abstract gives 1% at a 7-day average of 2.5 mmHg; using it per daily check-in is our simplification.
- The Earth-Mars one-way delay options (4, 12, 22 minutes) reflect the commonly cited range of roughly 3 to 22 minutes.
- Everything labeled "demo parameter" in `src/engine/config.ts` and `scripts/shipshape_sim.py`.
