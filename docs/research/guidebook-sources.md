# Guidebook sources (research notes)

Source research for an in-app guidebook that answers the challenge's "simple instructions and explanations covering measurements, health indicators, and risks". Gathered by an AI agent (Claude) on 15 Nov 2026. **Nothing here has been checked by the team.** Every new row is "Checked by team: No" until a person opens the source and confirms the quote, as `docs/CITATIONS.md` requires. Sources the team has already checked are pointed to, not repeated.

How the quotes were taken: NASA and CDC PDFs were downloaded and their text extracted with `pypdf`; HTML pages were fetched and stripped of tags. Quotes are copied from that text. PDF extraction can join or split words at line breaks, so a checker should compare against the PDF itself. "Opened by agent: yes" means the agent read the text the quote comes from. "Yes (summary tool)" means it came through a web-fetch tool that summarises the page; treat those quotes as less certain.

Ground rules carried into the guide:

- Say "likely" and never diagnose. Several sources below warn that the reading alone does not tell you what is wrong (pulse oximetry, dry eye, SANS); the guide should repeat that.
- Only state "what you can do" where a NASA (or regulator) source states the practice. Where none was found, the guide says nothing (see "Not found").
- No rule in the app reads the watch vitals or the HRP links; the guide must not imply they are judged.

## Findings the team should know before writing the guide

These are not changes; they are places where a source and the app's current choices differ. Decide before putting either on screen.

1. **Congestion is linked to CO₂ on ISS, not only to humidity.** Cole et al. (NASA, NTRS 20160012725): "For each 1-mm Hg increase in CO2, the odds of a crew member reporting congestion doubled. The average 7-day CO2 would need to be maintained below 1.5 mmHg to keep the risk of congestion below 1%." The app currently counts congestion only toward a humidity alert (CLAUDE.md, `SYMPTOM_LINKS`). The guide can mention the link without changing the rule, but it should not say congestion is "only" a humidity sign.
2. **Dry or sore eyes have several causes.** The Ax et al. 2023 review lists airflow, CO₂, lighting and screen work as well as humidity, and warns of "discordance between signs and symptoms of DED". The guide should not say sore eyes mean dry air.
3. **SANS is usually silent.** NASA's crew briefing: "Cases are typically asymptomatic unless they develop blurred vision". `src/data/hrp.ts` links headache to the SANS risk; none of the SANS sources opened here names headache as a SANS symptom (the CO₂ brief ties headache to fluid shift, which is also SANS's proposed cause). Keep the link if the team has its own source; otherwise the guide should tie SANS to vision changes, not headache.
4. **Exercise minutes.** OCHMO-TB-031 gives the in-flight prescription as about 30 min aerobic plus 30–60 min resistive. The app's 120-min target rests on the team-checked NASA page ("about two hours a day", schedule 2.5 h including setup). Both are true; the guide should say the 120 includes more than the workout itself if it quotes TB-031.

## Per reading

Column key: **Limit** = NASA standard number, target or practice; **Can do** = a crew action a source states. "Opened" = opened by agent.

### Cabin CO₂ (mmHg)

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Carbon dioxide in the cabin air, from ISS telemetry | CO₂ risk; headaches, fatigue, poor sleep | [V2 6004] 1-h average ≤ 3 mmHg | — (the source names a ground action, not a crew one) | Already in CITATIONS.md (OCHMO-TB-004, checked) | — | Yes (existing) |
| CO₂ differs by module | Why one module can read higher than the station average | — | — | [OCHMO-TB-004 Rev D](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf): "Note: There is a slight variation across the different nodes of the ISS due to location of CO 2 scrubbing equipment and ventilation patterns." | Yes | No |
| What happens when it stays high | Reassurance: the fix is the ship's, not the crew member's | — | Ground fixes it | Same brief: "If the average ppCO2 is exceeded over several days for unknown reasons, the Flight Control Team will take corrective actions to either identify, diagnose, and repair degraded CO2 scrubbing equipment or activate supplemental CO2 scrubbing equipment as needed." | Yes | No |
| Congestion with CO₂ | See finding 1 | 7-day average below 1.5 mmHg keeps congestion risk below 1% (study estimate, not a standard) | — | [Cole, Wear, Young, Cobel, Mason, NTRS 20160012725](https://ntrs.nasa.gov/citations/20160012725) (abstract, 2017): "For each 1-mm Hg increase in CO2, the odds of a crew member reporting congestion doubled. The average 7-day CO2 would need to be maintained below 1.5 mmHg to keep the risk of congestion below 1%." Also: "While the cause of congestion is multifactorial, this study showed congestion is associated with CO2 levels on ISS." | Yes (abstract via NTRS API) | No |

### Cabin temperature and humidity

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Air temperature and relative humidity | Dry, stuffy or irritated nose and eyes; thermal discomfort; lower performance | [V2 6012] 18–27 °C, 25–75 %; [V2 6013] comfort 20–25 °C, 30–60 % | none published for crew | Already in CITATIONS.md (NASA-STD-3001 Vol 2, checked) | — | Yes (existing) |
| Temperature and sleep | Temperature among what disturbs sleep | — | — | Already in CITATIONS.md (NASA sleep risk page, checked) | — | Yes (existing) |
| ISS range | Context | — | — | [Sleep Accommodations technical brief (Rev A1, 2021)](https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf): "ISS: Temperature on the ISS is between 18°and 27°Celsius and the humidity between 30 and 65%." | Yes | No |

### Sleep duration (wearable)

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Hours asleep, from the wrist wearable | Sleep risk: fatigue and errors | No NASA in-flight minimum; brief cites 7–9 h for adults | — | ~6.5 h in flight and <6 h linked to slower responses: already in CITATIONS.md (Jones et al. 2022 abstract, checked) | — | Yes (existing) |
| Need and in-flight average | Plain context | 7–9 h (NSF/AASM, cited by NASA) | — | [Sleep Accommodations TB](https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf): "According to the National Sleep Foundation and American Academy of Sleep Medicine, an average adult needs7-9 hours of sleepfor optimal daytime functioning." and "Average nightly sleep duration for both shuttle and ISS is 6-6.5 hours." | Yes | No |
| Sleep debt | Why several short nights matter (matches the 3-of-7 rule's spirit) | — | Good-quality sleep | Same brief: "Sleep debt is the cumulative effect of reduced sleep that can accumulate faster than one might expect. The only way to repay sleep debt is with good-quality sleep." | Yes | No |
| Why crews sleep less | — | — | — | Same brief: "Reasons cited by ISS crewmembers for reduced sleep on orbit: voids, noise, temperature, physical discomfort, and mission conditi[ons]" (text cut at a page break in extraction; check wording) | Yes | No |

### Sleep quality (rating)

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| How rested you feel, 0–10, morning rating | Same sleep risk; ISS crews rated it the same way | none published | Light timing (below) | ISS crews rated sleep quality on 11-point scales: CITATIONS.md "Found for the check-in redesign" (Jones et al. 2022, PMC8919197) | Not re-opened (PMC served a bot check before) | No (existing, unchecked) |
| Light and the body clock | Light at the wrong time disrupts sleep | [V2 8055] circadian lighting | Avoid blue light before sleep; blue in the "morning", red in the "evening" | [Lighting Design TB (Rev A1, 2021)](https://www.nasa.gov/wp-content/uploads/2023/03/lighting-design-technical-brief-ochmo.pdf): "Light has a large effect on the human circadian rhythm. For example, blue light inhibits the production of melatonin, and should be avoided before crewmembers go to sleep." and "Blue light can be used in the “morning” to help wake the crew up, and red light can be used in the “evening” before bed to help promote melatonin production." | Yes | No |
| Sleep environment | — | — | — | Sleep Accommodations TB: "Exposure to light at inappropriate times leads to circadian misalignment, which causes sleep disruption." Its list of causes of sleep loss includes "Individual vulnerabilities: Medication use, sleep hygiene." | Yes | No |

Note: the lighting statements are design guidance for the vehicle, written about "the crew"; the guide may phrase them as "NASA's lighting guidance says…", not as a personal prescription.

### Reaction test (PVT-B style)

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| How fast you tap when a signal appears; lapses at 355 ms | Sleep risk: alertness | Lapse at 355 ms (PVT-B) | — | Already in CITATIONS.md (Basner et al. 2011, checked; Jones et al. 2022 abstract, checked) | — | Yes (existing) |

### Exercise minutes vs 120-min target

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Minutes of exercise logged by the wearable | Bone, muscle and aerobic risks; 1–1.5 % bone loss a month | ~2 h a day | Exercise is the countermeasure | Already in CITATIONS.md (NASA pages, checked) | — | Yes (existing) |
| What the daily session contains | See finding 4 | ~30 min aerobic + 30–60 min resistive | Both kinds | [OCHMO-TB-031 Exercise Overview](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf): "Inflight Training Time Prescriptions Metabolic: Approximately 30 minutes of interval or steady-state exercise Resistive/Strength: 30-60 minutes load-bearing training" | Yes | No |
| Why | — | — | — | Same brief: "Exercise is one of the most important countermeasures used to minimize loss of strength." | Yes | No |

### Radiation dose vs 600 mSv

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Estimated career dose so far | Cancer risk; solar events cause nausea, vomiting, fatigue | [V1 4030] 600 mSv career | Shelter when warned | Already in CITATIONS.md (OCHMO-TB-020, checked) | — | Yes (existing) |

### Mood and stress (private ratings)

| What | Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Your own 0–10 ratings, seen only by you and medical | Behavioral health risk | [V1 4011] cognitive status "within clinically accepted values as judged by behavioral health evaluation" — judged by a clinician, not by a self-rating | Private psychological conference; journaling and photography as outlets | Isolation text: CITATIONS.md (behavioral risk page, checked) | — | Yes (existing) |
| Common conditions | Normalises a bad stretch without labelling it | — | — | [OCHMO-TB-016 Rev B](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-016-behavioral-health.pdf): "Common behavioral health conditions or concerns in the spaceflight environment may include stress, depression, anxiety, relationship problems, and grief. The condition can be temporary, resolving with time and/or intervention, or can develop into a psychiatric disorder. Assessing predictive and contributing factors related to behavioral health can help prevent the onset of distress." | Yes | No |
| Contributing factors | Why sleep and the air sit on the same screen | — | — | Same brief, "Behavioral Health Decrements Contributing Factors": "Sleep • Workload • … • Medical conditions • Hypoxia • Food and nutrition • Carbon dioxide exposure" | Yes | No |
| Support that exists | What to do with a low rating | [V1 6010] PPC schedule; [V1 6004] support programs | Ask for a private conference | Same brief: "[V1 6010] Psychological Communication Schedule A PPC shall be scheduled on a routine basis, as determined by the Behavioral Health Provider, at a frequency dictated for short or long duration missions." and "Private psychological conferences (PPCs) are currently provided; additional psychological support includes crew care packages, crew support events …" | Yes | No |
| Self-help outlet | Only crew-facing practice found | — | Journaling, photographing Earth | Same brief (photo caption): "Photographing Earth and Journaling are important outlets for astronauts to manage their stress." | Yes | No |

### Symptoms

| Symptom | What / Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| Headache | CO₂ and fluid shift both cause it | 3 mmHg CO₂ | — | CO₂ symptom list, headache base rate and fluid shift: CITATIONS.md (OCHMO-TB-004, checked) | — | Yes (existing) |
| Congestion | Fluid shift early; CO₂ later in the mission | — | — | Cole et al., quoted above under CO₂. Also: "Although congestion has been attributed to fluid shifts during spaceflight, fluid status reaches equilibrium during the first week after launch while congestion continues to be reported throughout long duration missions." Humidity link: [V2 6012] rationale (checked) | Yes | No |
| Dry or sore eyes | Common on ISS; many causes; not SANS | none published | — (eye drops are hard to use in flight per the review; no NASA practice found) | [Ax T, Ganse B, Fries FN, et al. Dry eye disease in astronauts: a narrative review. Front Physiol 2023, doi:10.3389/fphys.2023.1281327](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1281327/full): "Symptoms of DED include feelings of eye irritation, eye strain, foreign body sensation and blurred vision." "Upon return to Earth, over 30% of International Space Station (ISS) expedition crew members and approximately 15% of shuttle crew members reported experiencing signs or symptoms of dry eye disease (DED) while in space". Causes: "strong air currents (air exchanged 45–77 times per hour in crew quarters) coupled with a relative humidity of about 60% (ISS), increased CO 2 exposure, artificial lighting, cosmic radiation, and extensive screen work". Caution: "there is discordance between signs and symptoms of DED". Not a NASA publication. | Yes | No |
| Vision change (not a check-in item) | SANS: usually no symptoms; report blur | — | Tell the crew surgeon; spare "space anticipation glasses" | [Brunstetter T, "SANS: A Briefing for Astronaut Candidates", NASA, NTRS 20230006218 (slides, 2023)](https://ntrs.nasa.gov/api/citations/20230006218/downloads/Brunstetter%20-%20Crewmember%20SANS%20Overview%20-%20Export%20Control%20-FINAL%20-%2001May23.pdf): "Cases are typically asymptomatic unless they develop blurred vision • Inform your crew surgeons about any vision changes"; "Bottom-line: Report vision changes to your crew surgeons"; "SAGs: Extra glasses supplied for mission, each w/ increasing power". [NASA SANS risk page](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-spaceflight-associated-neuro-ocular-syndrome/): "SANS is a syndrome unique to humans that fly in space, and there is no terrestrial disease equivalent." | Yes | No |
| Dizziness, nausea | Sensorimotor risk: worst around gravity changes | — | none published on the risk page | [NASA sensorimotor risk page](https://www.nasa.gov/directorates/esdmd/hhp/sensorimotor-risk/): "Exposure to altered gravity leads to changes in sensorimotor/vestibular function that manifest in motion sickness, spatial disorientation, decrements in postural control and locomotion, and manual and fine motor control deficits." "It takes hours to days for the body to readapt to gravity upon landing, with associated balance issues and visual inconsistencies." Also: nausea is on the CO₂ list above 4.5 mmHg (checked) and on the hypoxia list (below). | Yes | No |

### Watch vitals (shown for information only; no rule reads them)

| Reading | What / Why | Limit | Can do | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- | --- | --- | --- |
| All five | ISS has flown a garment measuring these; context that the measurements are real practice | none for crew self-reading | — | [Canadian Space Agency, Bio-Monitor](https://asc-csa.gc.ca/eng/sciences/astroskin.asp): "The system measures the following: pulse and electrical activity of the heart blood pressure breathing rate and volume skin temperature blood oxygen saturation physical activity levels The garments can also be worn during sleep and exercise." (list flattened in extraction) | Yes | No |
| Blood oxygen (SpO₂) | Hypoxia risk (exploration atmospheres, depressurisation, illness) | none published for wearables; FDA: 95–100 % for most healthy people | Read in context; warm, still hand | [NASA hypoxia risk page](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-reduced-crew-health-and-performance-due-to-hypoxia/): "there are additional factors that can result in hypoxic exposure to the crewmember, such as cabin depressurization, Environmental Control, and Life Support System (ECLSS) failure, toxic exposure, or crewmember illness/injury." [OCHMO-TB-003 Rev A](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf): "CNS: mental changes, at times undetectable to crew … Nonspecific: fatigue, nausea, headache, dizziness, mood alterations • Sleep: decrease in quality • Breathing: hyperventilation". [FDA, Pulse Oximeter Basics (current as of 03/26/2025)](https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics): "Oxygen saturation values are between 95% and 100% for most healthy individuals"; "multiple factors can affect the accuracy of a pulse oximeter reading, such as poor circulation, skin pigmentation, skin thickness, skin temperature, current tobacco use, and use of fingernail polish"; "Pulse oximeter readings should be considered in context with other information, including signs and symptoms of low oxygen." | NASA: yes. FDA: yes (summary tool; quotes partly trimmed by it) | No |
| Breathing rate | Hypoxia lists hyperventilation | none published | — | OCHMO-TB-003 line above ("Breathing: hyperventilation") | Yes | No |
| Resting heart rate | Cardiovascular risk | none published for crew | — | [NASA CV risk page](https://www.nasa.gov/directorates/esdmd/hhp/cv-risk/): "Exposure to the spaceflight environment can contribute to cardiovascular deconditioning, dysfunction, and remodeling." The page does not mention heart rate. | Yes | No |
| HRV | Research marker of the autonomic nervous system; changes in flight | none published | — | [Otsuka K, Cornelissen G, Kubo Y, Hayashi M, et al. npj Microgravity, PMC5516430](https://pmc.ncbi.nlm.nih.gov/articles/PMC5516430/): "Without appropriate adaptation, marked cardiovascular deconditioning may occur that can be detected by changes in heart rate variability (HRV)." Seven astronauts; Japanese-led, not NASA. | Yes | No |
| Skin temperature | — | none published | — | Only the CSA list above; FDA lists skin temperature as a factor that skews oximeter readings | Yes | No |

Suggested guide wording for vitals (derived, not a quote): "Shown so you can see your own pattern. The app does not judge these numbers, and a wrist sensor can be off. If a reading worries you, or you feel unwell, talk to your medical officer."

## Writing best practice

| Principle | Source and exact quote | Opened | Checked by team |
| --- | --- | --- | --- |
| A scored checklist for health materials; 90 is passing | [CDC Clear Communication Index](https://www.cdc.gov/ccindex/index.html): "The CDC Clear Communication Index (Index) is a research-based tool to help you develop and assess public communication materials." "The Index has 4 introductory questions and 20 scored items drawn from scientific literature in communication and related disciplines." [User Guide PDF](https://www.cdc.gov/ccindex/pdf/clear-communication-user-guide.pdf): "Although 100 is an ideal score, 90 or higher is passing." | Index page: yes (summary tool; curl got 403). User guide: yes (PDF text) | No |
| One main message, at the top | User Guide: "Does the material contain one main message statement?" "Is the main message at the top, beginning, or front of the material?" "People look for the most important information at the top, beginning, or front of a material." | Yes | No |
| Say what to do, and why | User Guide: "Does the material include one or more behavioral recommendations for the primary audience?" "Does the material explain why the behavioral recommendation(s) is important to the primary audience?" | Yes | No |
| Explain risk, admit uncertainty | User Guide: "Does the material explain the nature of the risk?" "Acknowledge uncertainty about data, findings, recommendations, guidance and action steps." | Yes | No |
| Plain language | [Digital.gov plain language: writing](https://digital.gov/guides/plain-language/writing) (successor to plainlanguage.gov): "Plain language writing requires communicating clearly for your specific audience." "Active voice makes it clear who should do what." "Writing in the present tense saves your audience work and helps make your point clearly." | Yes (summary tool) | No |
| NASA's own crew-facing style | Brunstetter's SANS briefing to astronaut candidates is a NASA example of crew-facing health text: a plain "Bottom-line" line and one action ("Report vision changes to your crew surgeons"). | Yes | No |

Applying this to each guide card: one main line first ("what it measures"), then why it matters in spaceflight, then the NASA number, then one action only where a source gives one, then what the app does not do with it.

## Not found / no NASA source (the guide should say nothing here)

- Any crew-facing NASA action for high CO₂ (for example moving to a better-ventilated module, fan placement, avoiding CO₂ pockets in sleep quarters). TB-004 says CO₂ varies by node and that the ground fixes scrubbers; it gives no crew instruction.
- Any NASA crew self-care for congestion or dry eyes.
- NASA in-flight minimum sleep hours as a standard (the 7–9 h figure is NSF/AASM, cited by NASA).
- NASA normal ranges or limits for crew-read resting heart rate, HRV, breathing rate, skin temperature or wrist SpO₂.
- A NASA source naming headache as a SANS symptom (see finding 3).
- A NASA source on how crews should interpret their own mood or stress ratings. [V1 4011] puts that judgment with a behavioral health evaluation.
- A dedicated NASA hypoxia technical brief (hypoxia is covered inside OCHMO-TB-003).
- A NASA countermeasure for space motion sickness on the sensorimotor risk page.

## Could not open

- CDC pages via direct download returned HTTP 403 (opened through a summarising fetch tool instead; the User Guide PDF text was read in full).
- The FDA safety communication URLs from search (2021 brief and the safety-communication page) returned 404; the current "Pulse Oximeter Basics" page was used instead.
- NIH "Clear & Simple" returned 403; not used.
- NTRS 20200001669 ("Nasal Congestion on the International Space Station", Cole et al. 2019): metadata only, "No abstract available"; PDF not read.
- NTRS 20170003866 (Beven, behavioral health operations): no abstract; not re-read (already listed in CITATIONS.md).
- Spaceflight Standard Measures (PMC12612093) and Jones et al. full text (PMC8919197): not re-opened.
- Sleep Accommodations brief: the copy opened is Rev A/A1 (2021). Search results mention a Rev B (Oct 2023, OCHMO-TB-041) that was not opened; check the quotes still appear there.
- Lighting Design brief: the copy opened is Rev A1 (2021); a Rev C exists per search and was not opened.

## Suggested first cut (team-checked already; could ship today)

All from `docs/CITATIONS.md` rows marked checked:

1. CO₂: the 1-hour limit of 3 mmHg [V2 6004], set "to keep incidence of headaches below 1.4%" (OCHMO-TB-004).
2. CO₂ symptoms: headaches at 2.8–4.5 mmHg; fatigue, decreased sleep and nausea above 4.5 mmHg (OCHMO-TB-004).
3. Headache base rate: 19 of 49 astronauts; and "Fluid shift … largely contributes to symptoms similar to CO2 over-exposure, including headaches" (OCHMO-TB-004), so one headache never blames the air.
4. Temperature and humidity: health limits 18–27 °C, 25–75 % [V2 6012], with "dry, stuffy and/or irritated mucous membranes" outside them; comfort 20–25 °C, 30–60 % [V2 6013].
5. Sleep: ISS crews sleep ~6.5 h; under 6 h linked to slower responses, more stress, higher workload (Jones et al. 2022, abstract). Noise, temperature, vibration and light inhibit sleep (NASA sleep risk page).
6. Reaction test: PVT-B, a lapse is a response of 355 ms or more (Basner et al. 2011).
7. Exercise: bones lose 1–1.5 % mineral density a month; ISS crews exercise about two hours a day (NASA pages).
8. Radiation: 600 mSv career limit [V1 4030]; solar events cause nausea, vomiting, fatigue; crews shelter when warned (OCHMO-TB-020).
9. Mood: "Exposure to the isolation and confinement of spaceflight can result in decrements in cognitive and behavioral functioning." (NASA behavioral health risk page).
10. Each reading's NASA Human System Risk title and link (NASA Human System Risks page, as in `src/data/hrp.ts`).

Not team-checked but already in CITATIONS.md (do not use until checked): ratings on 11-point scales (Jones et al.), wrist actigraphy in Standard Measures, the weekly private medical conference.
