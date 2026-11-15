// The Guide: plain explanations of every reading, for the crew. Passive: it explains, it never reads a
// person's own data. Every sentence names where it comes from: a source in docs/CITATIONS.md, or "app" for
// what this app itself does. A sourced sentence shows only once a person has opened that source and the
// CITATIONS.md row says so (tests/guide.test.ts holds the two in step).

import { HRP_RISKS, type HrpRiskKey } from '../data/hrp.ts'
import { RULES } from '../engine/config.ts'
import { CAREER_LIMIT_MSV } from '../engine/mission.ts'
import type { IndicatorKey, SymptomKey } from '../engine/types.ts'

/** A source, found by `row`: text that appears in exactly one row of docs/CITATIONS.md. */
export interface GuideSource {
  row: string
  checked: boolean
}

export const SOURCES = {
  // Opened by the team before the Guide was written.
  co2Limit: { row: '1-hour average limited to 3 mmHg', checked: true },
  co2Symptoms: { row: 'Headaches with fatigue and malaise', checked: true },
  co2Why: { row: 'to keep incidence of headaches below 1.4%', checked: true },
  headacheRate: { row: '19 of 49 astronauts; 46 of 1,716 days', checked: true },
  fluidShift: { row: 'One headache never blames the air', checked: true },
  cabinLimits: { row: 'Crew health limits 18–27 °C', checked: true },
  cabinComfort: { row: '20–25 °C and 30–60% humidity support comfort', checked: true },
  sleepIss: { row: 'About 6.5 h in flight', checked: true },
  sleepEnv: { row: 'Temperature among what disturbs sleep', checked: true },
  pvtLapse: { row: 'PVT-B counts a lapse at 355 ms', checked: true },
  boneLoss: { row: 'weight-bearing bones lose on average 1% to 1.5%', checked: true },
  exerciseTime: { row: 'ISS crews exercise about two hours a day', checked: true },
  radLimit: { row: 'Career effective dose from spaceflight radiation under 600 mSv', checked: true },
  radEffects: { row: 'Dose raises cancer risk', checked: true },
  isolation: { row: 'Behavioral health risk text on the challenge page', checked: true },
  hrpTitles: { row: 'Risk titles and pages', checked: true },
  // Found for the Guide (docs/research/guidebook-sources.md); hidden until a person opens them.
  co2Modules: { row: 'CO₂ differs a little between ISS modules', checked: false },
  co2Ground: { row: 'Flight control team repairs or adds CO₂ scrubbing', checked: false },
  congestionCo2: { row: 'Odds of congestion doubled per 1 mmHg of CO₂', checked: false },
  issCabinRange: { row: 'ISS cabin 18–27 °C and 30–65% humidity', checked: false },
  sleepNeed: { row: 'Adults need 7–9 h; shuttle and ISS crews average 6–6.5 h', checked: false },
  sleepDebt: { row: 'Only good-quality sleep repays sleep debt', checked: false },
  blueLight: { row: 'Blue light before sleep; blue in the morning, red in the evening', checked: false },
  exercisePlan: { row: 'About 30 min aerobic and 30–60 min resistive', checked: false },
  exerciseKey: { row: 'Exercise is one of the most important countermeasures', checked: false },
  bhConcerns: { row: 'Common behavioral health concerns in spaceflight', checked: false },
  bhFactors: { row: 'Sleep, workload and CO₂ among behavioral health factors', checked: false },
  ppc: { row: 'Private psychological conferences on a routine schedule', checked: false },
  outlets: { row: 'Photographing Earth and journaling as outlets', checked: false },
  dryEye: { row: 'Dry eye on the ISS: how common, and its causes', checked: false },
  sans: { row: 'SANS usually has no symptoms; report vision changes', checked: false },
  sensorimotor: { row: 'Motion sickness and disorientation from gravity changes', checked: false },
  hypoxiaCauses: { row: 'What can expose crew to low oxygen', checked: false },
  hypoxiaSigns: { row: 'Signs of low oxygen', checked: false },
  spo2: { row: 'Blood oxygen 95–100% in most healthy people; read in context', checked: false },
  bioMonitor: { row: 'ISS garment measuring heart, breathing, skin temperature and blood oxygen', checked: false },
  cvRisk: { row: 'Spaceflight can decondition the heart and blood vessels', checked: false },
  hrv: { row: 'HRV changes can show cardiovascular deconditioning', checked: false },
} satisfies Record<string, GuideSource>

export type SourceKey = keyof typeof SOURCES

/** One sentence and where it comes from. */
export interface Line {
  text: string
  from: SourceKey | 'app'
}

export type Part = 'measure' | 'why' | 'limit' | 'canDo' | 'tellNow' | 'app'

/** The parts of an entry, in reading order, with their headings. */
export const PARTS: { key: Part; heading: string }[] = [
  { key: 'measure', heading: 'What it is' },
  { key: 'why', heading: 'Why it matters in space' },
  { key: 'limit', heading: 'Limit or target' },
  { key: 'canDo', heading: 'What you can do' },
  { key: 'tellNow', heading: 'Tell your medical officer now if' },
  { key: 'app', heading: 'What the app does with it' },
]

export type Section = 'cabin' | 'you' | 'risks'

export const SECTIONS: { key: Section; title: string }[] = [
  { key: 'cabin', title: 'Cabin' },
  { key: 'you', title: 'You' },
  { key: 'risks', title: 'NASA risks' },
]

export interface GuideEntry {
  id: string
  section: Section
  title: string
  /** Words people may search for that are not in the text. */
  words: string[]
  /** NASA Human System Risks this reading informs. */
  risks: HrpRiskKey[]
  parts: Partial<Record<Part, Line[]>>
}

const app = (text: string): Line => ({ text, from: 'app' })
const from = (src: SourceKey, text: string): Line => ({ text, from: src })

const [comfortLo, comfortHi] = RULES.tempComfortC
const [limitLo, limitHi] = RULES.tempLimitC
const [rhComfortLo, rhComfortHi] = RULES.rhComfortPct
const [rhLimitLo, rhLimitHi] = RULES.rhLimitPct
const CREW_SHARE = `${Math.round(RULES.crewShare * 100)}%`

/** Shown at the top of the Guide, always. */
export const EMERGENCY_LINE =
  'In an emergency, follow your onboard medical procedures and call your crew medical officer. This guide explains readings; it does not tell you what is wrong.'

const READINGS: GuideEntry[] = [
  {
    id: 'you-or-ship',
    section: 'cabin',
    title: 'Likely you, or likely the ship',
    words: ['verdict', 'alert', 'ship alert', 'status', 'why am i', 'how it works', 'normal', 'usual', 'drift'],
    risks: ['co2'],
    parts: {
      measure: [
        app(
          `Each day the app compares your check-in with your own usual: the middle of your last ${RULES.baselineWindowDays} check-ins. A reading far from your usual counts as off.`,
        ),
      ],
      app: [
        app(
          `It says “likely the ship” when the cabin air is outside its usual or NASA’s range and at least ${CREW_SHARE} of the crew are off on readings that air can explain, on the same day.`,
        ),
        app('It says “likely you” when only you are off. That is not a diagnosis: it means the air does not explain it.'),
        app(`If you are still off on day ${RULES.persistDays}, a short summary goes to your flight surgeon.`),
      ],
    },
  },
  {
    id: 'co2',
    section: 'cabin',
    title: 'Cabin CO₂',
    words: ['carbon dioxide', 'co2', 'air', 'scrubber', 'stuffy', 'mmhg'],
    risks: ['co2'],
    parts: {
      measure: [app('How much carbon dioxide is in the cabin air, as a daily average in mmHg.')],
      why: [
        from('co2Symptoms', 'On earlier missions, crews reported headaches at CO₂ between 2.8 and 4.5 mmHg, and fatigue, poorer sleep and nausea above 4.5 mmHg.'),
        from('fluidShift', 'Weightlessness causes similar headaches through the fluid shift, so one headache does not mean the air is to blame.'),
        from('co2Modules', 'CO₂ can differ a little between modules, depending on where the scrubbers are and how the air moves.'),
      ],
      limit: [
        from('co2Limit', `A 1-hour average of no more than ${RULES.co2LimitMmHg} mmHg.`),
        from('co2Why', 'NASA set it there to keep headaches below 1.4%.'),
        from('co2Ground', 'If CO₂ stays high for days, the flight control team repairs the scrubbers or turns on extra scrubbing.'),
      ],
      app: [
        app(
          `It compares today with the cabin’s own usual level: ${RULES.cabinMarginMmHg} mmHg above it, or over ${RULES.co2LimitMmHg} mmHg, makes CO₂ a suspect.`,
        ),
        app(`It counts toward “likely the ship” only when at least ${CREW_SHARE} of the crew are off on CO₂-linked readings: headache, sleep, fatigue, irritability.`),
      ],
    },
  },
  {
    id: 'temperature',
    section: 'cabin',
    title: 'Cabin temperature',
    words: ['hot', 'cold', 'warm', 'heat', 'celsius', 'thermal', 'sweating'],
    risks: ['sleep'],
    parts: {
      measure: [app('The cabin air temperature, as a daily average in °C.')],
      why: [
        from('cabinLimits', 'Outside NASA’s limits the crew can overheat and work less well.'),
        from('sleepEnv', 'Temperature is one of the things that disturb sleep in space, with noise, vibration and light.'),
      ],
      limit: [
        from('cabinComfort', `Comfort range ${comfortLo}–${comfortHi} °C.`),
        from('cabinLimits', `Health limit ${limitLo}–${limitHi} °C.`),
        from('issCabinRange', 'On the ISS the temperature stays between 18 and 27 °C.'),
      ],
      app: [app('Outside the comfort range it becomes a suspect for sleep changes. Outside the health limit it shows red.')],
    },
  },
  {
    id: 'humidity',
    section: 'cabin',
    title: 'Cabin humidity',
    words: ['dry air', 'damp', 'moisture', 'water vapour', 'relative humidity', 'rh'],
    risks: ['medical'],
    parts: {
      measure: [app('How much water vapour is in the cabin air, as relative humidity in percent.')],
      why: [from('cabinLimits', 'Air that is too dry or too humid can leave your nose and eyes dry, stuffy or irritated, and can cause skin rashes.')],
      limit: [
        from('cabinComfort', `Comfort range ${rhComfortLo}–${rhComfortHi}%.`),
        from('cabinLimits', `Health limit ${rhLimitLo}–${rhLimitHi}%.`),
        from('issCabinRange', 'On the ISS humidity stays between 30 and 65%.'),
      ],
      app: [app('Outside the comfort range it becomes a suspect for a stuffy nose and dry or sore eyes. Outside the health limit it shows red.')],
    },
  },
  {
    id: 'radiation',
    section: 'cabin',
    title: 'Radiation dose',
    words: ['radiation', 'dose', 'msv', 'sievert', 'solar storm', 'solar flare', 'cancer', 'shelter'],
    risks: ['radiation'],
    parts: {
      measure: [app('An estimate of the radiation dose you have taken on this mission, in millisieverts (mSv).')],
      why: [from('radEffects', 'Dose raises cancer risk and may affect thinking and behavior. A solar storm can cause nausea, vomiting and fatigue.')],
      limit: [from('radLimit', `A career limit of ${CAREER_LIMIT_MSV} mSv, the same for every age and sex.`)],
      canDo: [from('radEffects', 'When you are warned of a solar storm, go to the shelter.')],
      app: [
        app('The number is the ship’s typical daily dose times the mission day. It leaves out solar storms and earlier missions, so it is an estimate.'),
        app('It is shown, never judged: it is not part of any alert.'),
      ],
    },
  },
  {
    id: 'sleep',
    section: 'you',
    title: 'Sleep',
    words: ['tired', 'insomnia', 'cant sleep', 'sleepy', 'rest', 'nap', 'night', 'bed', 'wake', 'sleep quality'],
    risks: ['sleep'],
    parts: {
      measure: [app('How long you slept, from your watch, and how rested you feel, which you rate from 0 to 10 at check-in.')],
      why: [
        from('sleepIss', 'On six-month ISS missions astronauts slept about 6.5 h. Nights under 6 h went with slower responses, more stress and a heavier workload.'),
        from('sleepEnv', 'Noise, temperature, vibration and light all disturb sleep in space.'),
      ],
      limit: [from('sleepNeed', 'NASA’s sleep brief cites 7–9 h a night for adults.')],
      canDo: [
        from('sleepDebt', 'Short nights add up to a sleep debt. Only good-quality sleep pays it back.'),
        from('blueLight', 'Avoid blue light before sleep. NASA’s lighting guidance uses blue light in the morning and red light in the evening.'),
      ],
      app: [
        app(`It flags short sleep when you sleep under ${RULES.shortSleepHours} h on ${RULES.shortSleepNights} or more of the last ${RULES.shortSleepWindow} nights.`),
        app('It compares your sleep with your own usual. Cabin CO₂ and temperature can both explain a change.'),
      ],
    },
  },
  {
    id: 'reaction',
    section: 'you',
    title: 'Reaction test',
    words: ['alertness', 'reaction time', 'pvt', 'response', 'slow', 'focus', 'concentration', 'lapse'],
    risks: ['sleep'],
    parts: {
      measure: [app('A short test: tap as soon as the signal appears. The app measures how fast you respond and counts lapses.')],
      why: [from('sleepIss', 'Sleep loss slows responses: on the ISS, nights under 6 h went with slower responses.')],
      limit: [from('pvtLapse', 'The test works like PVT-B: a response of 355 ms or slower counts as a lapse.')],
      app: [app('It compares your speed with your own usual. No cabin factor explains it, so it never points at the ship.')],
    },
  },
  {
    id: 'fatigue',
    section: 'you',
    title: 'Fatigue and irritability',
    words: ['exhausted', 'tired', 'worn out', 'grumpy', 'irritable', 'annoyed', 'short tempered', 'energy'],
    risks: ['sleep', 'behavioral', 'team'],
    parts: {
      measure: [app('Two ratings from 0 to 10 in your check-in: how tired you feel and how easily irritated.')],
      why: [
        from('co2Symptoms', 'NASA lists fatigue among crew symptoms at higher cabin CO₂.'),
        from('sleepIss', 'Short sleep went with more stress and a heavier workload on the ISS.'),
      ],
      app: [
        app('Both count toward a CO₂ alert. NASA’s CO₂ list names fatigue but not irritability: linking irritability to CO₂ is this app’s own choice.'),
      ],
    },
  },
  {
    id: 'mood',
    section: 'you',
    title: 'Mood and stress',
    words: ['sad', 'down', 'low', 'anxious', 'anxiety', 'worried', 'lonely', 'homesick', 'stressed', 'depressed', 'feelings', 'mental health'],
    risks: ['behavioral', 'team'],
    parts: {
      measure: [app('Two private ratings from 0 to 10 in your check-in: your mood and how stressed you feel.')],
      why: [
        from('isolation', 'NASA: the isolation and confinement of spaceflight can affect thinking and behavior.'),
        from('bhConcerns', 'Stress, depression, anxiety, relationship problems and grief are common concerns on missions. They can be temporary and ease with time or support.'),
        from('bhFactors', 'Sleep, workload and cabin CO₂ are among the things that affect them.'),
      ],
      canDo: [
        from('ppc', 'Private psychological conferences are held on a routine schedule.'),
        from('outlets', 'NASA notes that photographing Earth and journaling are important outlets for stress.'),
      ],
      app: [
        app('They stay yours: the crew board shows only a count with no names, and they never count toward a ship alert.'),
        app(`It also tells you when your usual has slowly slipped since your first ${RULES.startNormalDays} check-ins.`),
        app(`If you are still off on day ${RULES.persistDays}, your flight surgeon is told.`),
        app('The check-in has a button to ask for a private conference.'),
      ],
    },
  },
  {
    id: 'exercise',
    section: 'you',
    title: 'Exercise',
    words: ['workout', 'training', 'treadmill', 'bike', 'resistance', 'bones', 'muscle', 'strength', 'fitness'],
    risks: ['bone', 'muscle', 'aerobic'],
    parts: {
      measure: [app(`Minutes of exercise each day, from your watch, against a target of ${RULES.exerciseTargetMin} minutes.`)],
      why: [
        from('boneLoss', 'In weightlessness, weight-bearing bones lose on average 1 to 1.5% of their mineral density a month.'),
        from('exerciseKey', 'Exercise is one of the most important ways to limit the loss of strength.'),
      ],
      limit: [from('exerciseTime', 'ISS crews exercise about two hours a day. The schedule allows 2.5 hours, 6 days a week, including setup.')],
      canDo: [from('exercisePlan', 'Do both kinds: about 30 minutes of aerobic exercise and 30–60 minutes of resistance training.')],
      app: [
        app(
          `Shown, never judged. The card turns to “watch” when you are under target on ${RULES.exerciseLapseDays} of the last ${RULES.exerciseWindowDays} days. It is not part of any alert.`,
        ),
      ],
    },
  },
  {
    id: 'headache',
    section: 'you',
    title: 'Headache',
    words: ['head', 'head hurts', 'migraine', 'head pain', 'pressure in head'],
    risks: ['co2', 'medical'],
    parts: {
      measure: [app('A symptom you tick in your check-in.')],
      why: [
        from('headacheRate', 'In one NASA review, 19 of 49 astronauts reported headaches.'),
        from('co2Symptoms', 'On earlier missions, crews reported headaches from 2.8 mmHg of CO₂.'),
        from('fluidShift', 'The fluid shift of weightlessness causes similar headaches.'),
      ],
      limit: [from('co2Limit', `For the air: a 1-hour CO₂ average of no more than ${RULES.co2LimitMmHg} mmHg.`)],
      app: [app(`One headache never blames the air. It counts toward a CO₂ alert only when at least ${CREW_SHARE} of the crew are off on CO₂-linked readings while CO₂ is up.`)],
    },
  },
  {
    id: 'congestion',
    section: 'you',
    title: 'Stuffy nose',
    words: ['congestion', 'blocked nose', 'runny nose', 'sinus', 'nose', 'cold', 'sneezing'],
    risks: ['medical'],
    parts: {
      measure: [app('A symptom you tick in your check-in.')],
      why: [
        from('cabinLimits', 'Air outside NASA’s humidity range can leave your nose dry, stuffy or irritated.'),
        from('congestionCo2', 'On the ISS the odds of reporting congestion doubled for each 1 mmHg more CO₂, and it kept being reported long after the early fluid shift settled.'),
      ],
      app: [app('It counts toward a humidity alert only. The app does not check it against CO₂.')],
    },
  },
  {
    id: 'eyes',
    section: 'you',
    title: 'Dry or sore eyes',
    words: ['eye', 'eyes', 'eye strain', 'itchy eyes', 'red eyes', 'gritty', 'screen'],
    risks: ['medical'],
    parts: {
      measure: [app('A symptom you tick in your check-in.')],
      why: [
        from('cabinLimits', 'Air outside NASA’s humidity range can leave your eyes dry or irritated.'),
        from('dryEye', 'Over 30% of ISS crew reported dry eye in space. Strong air flow, CO₂, lighting and screen work can all play a part, as well as humidity.'),
      ],
      app: [app('It counts toward a humidity alert only.')],
    },
  },
  {
    id: 'vision',
    section: 'you',
    title: 'Vision changes',
    words: ['blurry', 'blurred vision', 'sight', 'see', 'glasses', 'sans', 'eyesight'],
    risks: ['sans'],
    parts: {
      measure: [app('Not a check-in item. It is here so you know what to report.')],
      why: [from('sans', 'SANS is an eye and brain change seen only in spaceflight. It usually has no symptoms unless your vision blurs.')],
      canDo: [from('sans', 'Spare glasses of increasing strength fly with the mission.')],
      tellNow: [from('sans', 'Your vision changes in any way.')],
    },
  },
  {
    id: 'dizziness',
    section: 'you',
    title: 'Dizziness and nausea',
    words: ['dizzy', 'nauseous', 'sick', 'vomit', 'motion sickness', 'space sickness', 'spinning', 'balance', 'disoriented'],
    risks: ['sensorimotor'],
    parts: {
      measure: [app('Symptoms you tick in your check-in.')],
      why: [
        from('sensorimotor', 'Changes in gravity can cause motion sickness and disorientation. After landing it takes hours to days to readapt.'),
        from('co2Symptoms', 'NASA lists nausea among crew symptoms when CO₂ is above 4.5 mmHg.'),
        from('hypoxiaSigns', 'Dizziness and nausea are also among the signs of low oxygen.'),
      ],
      app: [app('They never count toward a ship alert.')],
    },
  },
  {
    id: 'spo2',
    section: 'you',
    title: 'Blood oxygen',
    words: ['spo2', 'oxygen', 'o2', 'saturation', 'pulse oximeter', 'breathless', 'short of breath', 'hypoxia'],
    risks: ['hypoxia'],
    parts: {
      measure: [app('Blood oxygen saturation (SpO₂) from your watch, in percent.')],
      why: [
        from('hypoxiaCauses', 'Low oxygen can follow a loss of cabin pressure, a life-support failure, a toxic exposure, or illness or injury.'),
        from('hypoxiaSigns', 'Its signs include fatigue, nausea, headache, dizziness, mood changes, poorer sleep and fast breathing. Changes in thinking can go unnoticed.'),
      ],
      limit: [from('spo2', 'For most healthy people it is 95–100%.')],
      canDo: [from('spo2', 'Poor circulation, skin temperature and skin thickness can throw a reading off, so read it together with how you feel.')],
      app: [app('Shown for information. No rule reads it.')],
    },
  },
  {
    id: 'vitals',
    section: 'you',
    title: 'Heart rate, HRV, breathing, skin temperature',
    words: ['heart', 'pulse', 'bpm', 'resting heart rate', 'heart rate variability', 'breathing rate', 'respiration', 'skin', 'watch', 'wearable'],
    risks: ['cv'],
    parts: {
      measure: [app('Resting heart rate, heart rate variability (HRV), breathing rate and skin temperature, from your watch.')],
      why: [
        from('bioMonitor', 'The Canadian Space Agency’s Bio-Monitor garment for the ISS measures these same kinds of signals.'),
        from('cvRisk', 'Spaceflight can decondition the heart and blood vessels.'),
        from('hrv', 'Changes in HRV can show that deconditioning.'),
      ],
      app: [
        app('Shown so you can see your own pattern. No rule reads them, and a wrist sensor can be off.'),
      ],
    },
  },
]

/** One plain sentence per risk, where a checked source gives one. The NASA title is always shown. */
const RISK_WHY: Partial<Record<HrpRiskKey, Line[]>> = {
  sleep: [from('sleepEnv', 'Sleep loss and a disturbed body clock lead to fatigue and errors.')],
  behavioral: [from('isolation', 'The isolation and confinement of spaceflight can affect thinking and behavior.')],
  co2: [from('co2Symptoms', 'Crews on earlier missions reported headaches, fatigue, poorer sleep and nausea at higher CO₂.')],
  bone: [from('boneLoss', 'Weight-bearing bones lose 1 to 1.5% of their mineral density a month.')],
  radiation: [from('radEffects', 'Dose raises cancer risk and may affect thinking and behavior.')],
  sans: [from('sans', 'An eye and brain change seen only in spaceflight, usually without symptoms.')],
  sensorimotor: [from('sensorimotor', 'Motion sickness and disorientation when gravity changes.')],
  cv: [from('cvRisk', 'Deconditioning of the heart and blood vessels.')],
  hypoxia: [from('hypoxiaCauses', 'Low oxygen after pressure loss, a life-support failure, a toxic exposure, or illness.')],
}

/** A risk entry per NASA risk a reading informs, in the order the readings name them. */
function riskEntries(): GuideEntry[] {
  const keys = [...new Set(READINGS.flatMap((e) => e.risks))]
  return keys.map((key) => ({
    id: `risk-${key}`,
    section: 'risks' as const,
    title: HRP_RISKS[key].short,
    words: ['risk', 'nasa risk', 'hrp'],
    risks: [key],
    parts: {
      measure: [from('hrpTitles', HRP_RISKS[key].title)],
      why: RISK_WHY[key],
    },
  }))
}

export const ENTRIES: GuideEntry[] = [...READINGS, ...riskEntries()]

/** The entry a check-in item's "?" opens. */
export const ENTRY_FOR: Record<IndicatorKey | SymptomKey, string> = {
  sleepHours: 'sleep',
  sleepQuality: 'sleep',
  fatigue: 'fatigue',
  irritability: 'fatigue',
  symptoms: 'headache',
  reaction: 'reaction',
  stress: 'mood',
  mood: 'mood',
  headache: 'headache',
  dizziness: 'dizziness',
  nausea: 'dizziness',
  congestion: 'congestion',
  eye_strain: 'eyes',
}

/** The readings that inform a risk: the entries a risk entry points back to. */
export function readingsFor(risk: HrpRiskKey): GuideEntry[] {
  return READINGS.filter((e) => e.risks.includes(risk))
}

/** A line shows when it is the app's own or its source has been opened by a person. */
export function shown(line: Line): boolean {
  return line.from === 'app' || SOURCES[line.from].checked
}

/** Said where a reading has no limit or target to show, so an empty part is never mistaken for "no risk". */
export const NO_LIMIT: Line = app('The app has no NASA limit or target for this one.')

/** The parts of an entry that have something to show, each with only its shown lines. */
export function visibleParts(entry: GuideEntry): { key: Part; heading: string; lines: Line[] }[] {
  const lines = (key: Part) => (entry.parts[key] ?? []).filter(shown)
  // A reading that says why it matters also says when it has no limit; the overview entry and risks do not.
  const isReading = entry.section !== 'risks' && lines('why').length > 0
  return PARTS.map((p) => ({ ...p, lines: p.key === 'limit' && isReading && lines('limit').length === 0 ? [NO_LIMIT] : lines(p.key) })).filter(
    (p) => p.lines.length > 0,
  )
}

export function entryById(id: string): GuideEntry | undefined {
  return ENTRIES.find((e) => e.id === id)
}

/**
 * Whether the Guide lists an entry. A reading whose only shown line is its first says nothing yet (its
 * sources are unchecked), so it waits; a risk always lists the readings that inform it.
 */
export function listed(entry: GuideEntry): boolean {
  return entry.section === 'risks' || visibleParts(entry).length > 1
}

/** The first line a reader sees under the title. */
export function summary(entry: GuideEntry): string {
  return visibleParts(entry)[0]?.lines[0]?.text ?? ''
}
