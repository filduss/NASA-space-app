import { startingBaseline, trailingBaseline, type Sample } from './baseline.ts'
import { RULES } from './config.ts'
import type { CabinFactor, CheckIn, IndicatorKey, IndicatorResult, PersonDay, SymptomKey } from './types.ts'

/** The cabin factors the ship-or-me rule checks, in the order it names them. */
export const CABIN_FACTORS: CabinFactor[] = ['co2', 'temp', 'rh']

export interface IndicatorSpec {
  key: IndicatorKey
  label: string
  /** Which direction is unwanted. */
  direction: 'lowBad' | 'highBad'
  /**
   * The cabin factors that could explain drift in this indicator, so the ship-or-me rule may use it for
   * them. Each link has a source in docs/SPEC.md; mood, stress and alertness have none.
   */
  linkedTo: CabinFactor[]
  /** Shared on the crew board by default, or private to the person. */
  privacy: 'shared' | 'private'
  /**
   * Also checked for a slow change against the starting normal. Mood and stress only: they are the
   * isolation signals and never enter the ship rule, while a CO2 week itself shifts the usual of the
   * CO2-linked indicators and would look like a slow change.
   */
  slowDrift?: boolean
  /** Floor for the own-normal spread, in the indicator's units (or a fraction of the median). */
  minSpread: number
  minSpreadRelative?: boolean
  unit: string
  /** Wording for cards: "<offText> your usual". Never a diagnosis. */
  offText: string
  whyWeAsk: string
  source: string
}

export const INDICATORS: IndicatorSpec[] = [
  {
    key: 'sleepHours',
    label: 'Sleep duration',
    direction: 'lowBad',
    linkedTo: ['co2', 'temp'],
    privacy: 'shared',
    minSpread: 0.5,
    unit: 'h',
    offText: 'Sleep shorter than',
    whyWeAsk: 'On six-month ISS missions astronauts slept about 6.5 h, and nights under 6 h went with slower responses and more stress.',
    source: 'ISS Reaction Self-Test study, 24 astronauts (Jones et al. 2022); NASA lists poor sleep among CO₂ symptoms and temperature among what disturbs sleep in space',
  },
  {
    key: 'sleepQuality',
    label: 'Sleep quality',
    direction: 'lowBad',
    linkedTo: ['co2', 'temp'],
    privacy: 'shared',
    minSpread: 1,
    unit: '/10',
    offText: 'Sleep quality below',
    whyWeAsk: 'NASA lists poor sleep among crew symptoms at higher cabin CO₂, and temperature among what disturbs sleep in space.',
    source: 'NASA OCHMO-TB-004 (CO₂); NASA sleep risk page (temperature); effect size is a demo parameter',
  },
  {
    key: 'fatigue',
    label: 'Fatigue',
    direction: 'highBad',
    linkedTo: ['co2'],
    privacy: 'shared',
    minSpread: 1,
    unit: '/10',
    offText: 'Fatigue above',
    whyWeAsk: 'Fatigue tracks sleep loss, and NASA lists it with headaches among crew symptoms at higher cabin CO₂.',
    source: 'NASA OCHMO-TB-004; effect size is a demo parameter',
  },
  {
    key: 'irritability',
    label: 'Irritability',
    direction: 'highBad',
    linkedTo: ['co2'],
    privacy: 'shared',
    minSpread: 1,
    unit: '/10',
    offText: 'Irritability above',
    whyWeAsk: 'Irritability often follows poor sleep. The rule also links it to cabin CO₂, which NASA’s CO₂ symptom list does not.',
    source: 'From the plan, not from NASA’s CO₂ symptom list (OCHMO-TB-004); effect size is a demo parameter',
  },
  {
    key: 'symptoms',
    label: 'Symptoms',
    direction: 'highBad',
    linkedTo: ['co2', 'rh'],
    privacy: 'shared',
    minSpread: 1,
    unit: '',
    offText: 'Symptoms reported',
    whyWeAsk: 'On the ISS the odds of a headache doubled for each 1 mmHg of CO₂. NASA’s cabin standard says air outside its humidity range dries and irritates the eyes and nose.',
    source: 'Law et al. 2014; NASA-STD-3001 Vol 2 [V2 6012]',
  },
  {
    key: 'reaction',
    label: 'Alertness',
    direction: 'lowBad',
    linkedTo: [],
    privacy: 'shared',
    minSpread: 0.04,
    minSpreadRelative: true,
    unit: 'responses/s',
    offText: 'Response speed below',
    whyWeAsk: 'A short reaction test picks up the effects of sleep loss before you feel them: on the ISS, nights under 6 h went with slower responses.',
    source: 'NASA Reaction Self Test (PVT-B); Jones et al. 2022; thresholds are demo parameters, browser timing is an estimate',
  },
  {
    key: 'stress',
    label: 'Stress',
    direction: 'highBad',
    linkedTo: [],
    privacy: 'private',
    slowDrift: true,
    minSpread: 1,
    unit: '/10',
    offText: 'Stress above',
    whyWeAsk: 'Only you see this. It is compared with your own normal and never used in the ship rule.',
    source: 'Demo parameter; no CO₂ evidence for stress',
  },
  {
    key: 'mood',
    label: 'Mood',
    direction: 'lowBad',
    linkedTo: [],
    privacy: 'private',
    slowDrift: true,
    minSpread: 1,
    unit: '/10',
    offText: 'Mood below',
    whyWeAsk: 'Only you see this. It is compared with your own normal and never used in the ship rule.',
    source: 'Demo parameter; no CO₂ evidence for mood',
  },
]

export const INDICATOR_KEYS: IndicatorKey[] = INDICATORS.map((i) => i.key)
export const SPEC: Record<IndicatorKey, IndicatorSpec> = Object.fromEntries(
  INDICATORS.map((i) => [i.key, i]),
) as Record<IndicatorKey, IndicatorSpec>

/**
 * Which cabin factor each symptom may count toward. Headache is the one with a published CO2
 * dose-response (Law et al. 2014). Congestion and dry or sore eyes count toward humidity: NASA-STD-3001
 * [V2 6012] names "dry, stuffy and/or irritated mucous membranes" outside its humidity range. NASA's CO2
 * brief also reports nausea above 4.5 mmHg, anecdotally; it is not used.
 */
export const SYMPTOM_LINKS: Record<SymptomKey, CabinFactor[]> = {
  headache: ['co2'],
  dizziness: [],
  nausea: [],
  congestion: ['rh'],
  eye_strain: ['rh'],
}

/** Symptoms the ship rule may count toward cabin CO2. */
export const CO2_LINKED_SYMPTOMS: SymptomKey[] = (Object.keys(SYMPTOM_LINKS) as SymptomKey[]).filter((s) => SYMPTOM_LINKS[s].includes('co2'))

export const SYMPTOMS: { key: SymptomKey; label: string }[] = [
  { key: 'headache', label: 'Headache' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'congestion', label: 'Congestion' },
  { key: 'eye_strain', label: 'Dry or sore eyes' },
]

/** The number the engine compares. Reaction time becomes response speed, as in the PVT literature. */
export function indicatorValue(c: CheckIn, key: IndicatorKey): number | null {
  switch (key) {
    case 'symptoms':
      return c.symptoms.length
    case 'reaction':
      return c.reactionMs && c.reactionMs > 0 ? 1000 / c.reactionMs : null
    default:
      return c[key]
  }
}

/** Per-person memory the engine carries from day to day. */
export interface PersonMemory {
  /** Days each indicator was off (those days are left out of later baselines). */
  offDays: Record<IndicatorKey, Set<number>>
  /** Consecutive check-ins each indicator has been off. */
  runs: Record<IndicatorKey, number>
}

export function newMemory(): PersonMemory {
  const offDays = {} as PersonMemory['offDays']
  const runs = {} as PersonMemory['runs']
  for (const k of INDICATOR_KEYS) {
    offDays[k] = new Set()
    runs[k] = 0
  }
  return { offDays, runs }
}

function blank(key: IndicatorKey, reason: IndicatorResult['reason']): IndicatorResult {
  return { key, value: null, baseline: null, start: null, z: null, off: false, reason, daysOff: 0 }
}

/**
 * Compare one person's check-in for `day` with their own normal.
 * `history` is that person's check-ins (any order). `memory` is updated in place.
 */
export function assessPerson(crewId: string, day: number, history: CheckIn[], memory: PersonMemory): PersonDay {
  const today = history.find((c) => c.day === day)
  const indicators = {} as PersonDay['indicators']
  if (!today) {
    for (const k of INDICATOR_KEYS) indicators[k] = blank(k, 'not_measured')
    const linkedOff = { co2: [], temp: [], rh: [] }
    return { crewId, day, checkedIn: false, live: false, indicators, off: [], co2LinkedOff: [], linkedOff, symptoms: [], safety: false }
  }

  for (const spec of INDICATORS) {
    const key = spec.key
    const value = indicatorValue(today, key)
    if (value === null) {
      indicators[key] = blank(key, 'not_measured')
      continue
    }
    let result: IndicatorResult
    if (key === 'symptoms') {
      // A ticked symptom is a report, not a deviation: it needs no baseline.
      const off = today.symptoms.length > 0
      result = { key, value, baseline: null, start: null, z: null, off, reason: off ? 'symptom' : 'ok', daysOff: 0 }
    } else {
      const samples: Sample[] = []
      for (const c of history) {
        const v = indicatorValue(c, key)
        if (v !== null) samples.push({ day: c.day, value: v, excluded: memory.offDays[key].has(c.day) })
      }
      const provisional = trailingBaseline(samples, day, { minSpread: spec.minSpreadRelative ? 0 : spec.minSpread })
      const baseline =
        provisional && spec.minSpreadRelative
          ? { ...provisional, spread: Math.max(provisional.spread, spec.minSpread * provisional.median) }
          : provisional
      const sign = spec.direction === 'highBad' ? 1 : -1
      if (!baseline) {
        result = { key, value, baseline: null, start: null, z: null, off: false, reason: 'no_baseline', daysOff: 0 }
      } else {
        const z = (sign * (value - baseline.median)) / baseline.spread
        const off = z >= RULES.driftZ
        result = { key, value, baseline, start: null, z, off, reason: off ? 'off_usual' : 'ok', daysOff: 0 }
      }
      if (spec.slowDrift) {
        // A slow change: today's own normal (which leaves out days judged off) has moved away from the
        // starting normal, though no single day jumped far enough to count as drift.
        const start = startingBaseline(samples, day, RULES.startNormalDays, spec.minSpread)
        result = { ...result, start }
        if (!result.off && start && baseline && (sign * (baseline.median - start.median)) / start.spread >= RULES.startDriftZ) {
          result = { ...result, off: true, reason: 'below_start' }
        }
      }
      if (key === 'sleepHours' && !result.off) {
        // Cited rule: under 6 h on 3 or more of the last 7 nights, including last night.
        const recent = history.filter((c) => c.day <= day && c.day > day - RULES.shortSleepWindow)
        const short = recent.filter((c) => c.sleepHours < RULES.shortSleepHours).length
        if (today.sleepHours < RULES.shortSleepHours && short >= RULES.shortSleepNights) {
          result = { ...result, off: true, reason: 'short_sleep' }
        }
      }
    }
    if (result.off) {
      // A slow change is judged against the starting normal, so its days stay in the rolling one:
      // leaving them out would freeze that normal and make the flag switch on and off.
      if (result.reason !== 'below_start') memory.offDays[key].add(day)
      memory.runs[key] += 1
    } else {
      memory.runs[key] = 0
    }
    result.daysOff = memory.runs[key]
    indicators[key] = result
  }

  const off = INDICATOR_KEYS.filter((k) => indicators[k].off)
  const linkedOff = {} as PersonDay['linkedOff']
  for (const f of CABIN_FACTORS) {
    linkedOff[f] = off.filter((k) => {
      if (!SPEC[k].linkedTo.includes(f)) return false
      if (k === 'symptoms') return today.symptoms.some((s) => SYMPTOM_LINKS[s].includes(f))
      return true
    })
  }
  return {
    crewId,
    day,
    checkedIn: true,
    live: !today.simulated,
    indicators,
    off,
    co2LinkedOff: linkedOff.co2,
    linkedOff,
    symptoms: today.symptoms,
    safety: today.safetyFlag === true,
  }
}
