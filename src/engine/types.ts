// Shared JSON shapes (see docs/SPEC.md). Everything the engine reads or writes is plain data.

export type IndicatorKey =
  | 'sleepHours'
  | 'sleepQuality'
  | 'fatigue'
  | 'irritability'
  | 'symptoms'
  | 'reaction'
  | 'stress'
  | 'mood'

export type SymptomKey = 'headache' | 'dizziness' | 'nausea' | 'congestion' | 'eye_strain'

/** One morning check-in. Sliders run 0-10. */
export interface CheckIn {
  crewId: string
  /** Mission day (integer). */
  day: number
  sleepHours: number
  sleepQuality: number
  fatigue: number
  irritability: number
  stress: number
  mood: number
  symptoms: SymptomKey[]
  /** Mean reaction time in ms; null when the test was not taken. */
  reactionMs: number | null
  /** Minutes of exercise the day before; missing or null when not logged. Shown, never judged (engine/gravity.ts). */
  exerciseMin?: number | null
  /** The wrist wearable's other readings; missing or null without one. Shown for information, never judged. */
  watch?: WatchVitals | null
  /** The safety answer: "I need to talk to someone now". */
  safetyFlag?: boolean
  /** True for generated check-ins, false for ones entered live in the app. */
  simulated: boolean
}

/** What the wrist wearable measured besides sleep and exercise. Shown for information; no rule reads it. */
export interface WatchVitals {
  /** Resting heart rate, beats per minute. */
  restingHr: number
  /** Heart rate variability overnight (RMSSD), milliseconds. */
  hrvMs: number
  /** Blood oxygen saturation, %. */
  spo2: number
  /** Breathing rate overnight, breaths per minute. */
  respRate: number
  /** Skin temperature against the person's own usual, °C. */
  skinTempDelta: number
}

/** One mission day of cabin air: the 24 h before the morning check-in. Real ISS data. */
export interface CabinDay {
  day: number
  date: string
  /** Hours with data in the window (0-24). */
  hours: number
  /** Mean CO2 partial pressure in mmHg; null when too few hours have data. */
  co2Mean: number | null
  /** Highest 1-hour average in the window, mmHg. */
  co2Max1h: number | null
  temp: number | null
  rh: number | null
}

export interface Baseline {
  median: number
  /** Robust spread (1.4826 x MAD), floored so tiny wobbles never count as drift. */
  spread: number
  n: number
}

export type IndicatorReason =
  | 'ok'
  | 'off_usual'
  | 'short_sleep'
  /** A slow change: own normal has moved away from the starting normal (mood and stress). */
  | 'below_start'
  | 'symptom'
  | 'no_baseline'
  | 'not_measured'

export interface IndicatorResult {
  key: IndicatorKey
  value: number | null
  baseline: Baseline | null
  /** Starting normal (the person's first check-ins), for indicators checked for a slow change; else null. */
  start: Baseline | null
  /** Distance from own normal in spreads; positive means the unwanted direction. */
  z: number | null
  off: boolean
  reason: IndicatorReason
  /** Consecutive check-ins this indicator has been off, counting today. */
  daysOff: number
}

export interface PersonDay {
  crewId: string
  day: number
  checkedIn: boolean
  live: boolean
  indicators: Record<IndicatorKey, IndicatorResult>
  /** Indicators off today. */
  off: IndicatorKey[]
  /** The subset that cabin CO2 could explain (the same list as `linkedOff.co2`). Never contains mood or stress. */
  co2LinkedOff: IndicatorKey[]
  /** For each cabin factor, the indicators off today that it could explain. Never contains mood or stress. */
  linkedOff: Record<CabinFactor, IndicatorKey[]>
  symptoms: SymptomKey[]
  safety: boolean
}

/** A cabin cause the ship-or-me rule can name. All three come from the same real ISS telemetry. */
export type CabinFactor = 'co2' | 'temp' | 'rh'

/** Cabin temperature (°C) or relative humidity (%) today, against NASA's ranges (engine/config.ts). */
export interface ComfortStatus {
  /** 24 h mean; null when the day has too few hours of data. */
  value: number | null
  /** Below or above the comfort range of NASA-STD-3001 [V2 6013]; null inside it or without data. */
  outside: 'low' | 'high' | null
  /** Outside the crew health limits of NASA-STD-3001 [V2 6012]. */
  overLimit: boolean
}

export interface CabinStatus {
  day: number
  hasData: boolean
  hours: number
  co2Mean: number | null
  co2Max1h: number | null
  /** The cabin's own usual level: median of recent normal days. */
  baseline: number | null
  delta: number | null
  /** Mean CO2 is above the cabin's own baseline by the margin. */
  elevated: boolean
  /** A 1-hour average above the 3 mmHg limit (NASA-STD-3001 Vol 2 [V2 6004]). Shown; the rule does not use it. */
  aboveLimit: boolean
  /** The 24 h mean is above the same limit: bad air even after a long run of high days has made it the cabin's usual. */
  overLimit: boolean
  /** Most recent day with a usable mean, for the freshness label. */
  lastDataDay: number | null
  temp: ComfortStatus
  rh: ComfortStatus
  /**
   * The cabin factors the ship-or-me rule may blame today: CO2 above its own baseline or over its limit,
   * temperature or humidity outside NASA's comfort range.
   */
  suspects: CabinFactor[]
}

export type Outcome = 'none' | 'ship' | 'me' | 'shared'

export interface Decision {
  outcome: Outcome
  crewSize: number
  checkedIn: number
  /** Crew drifting on CO2-linked indicators today. */
  driftingCo2: string[]
  /** Crew drifting on any indicator today. */
  driftingAny: string[]
  /** For each cabin factor, the crew drifting today on indicators it could explain. */
  driftingOn: Record<CabinFactor, string[]>
  /** The cabin factors behind today's ship alert, in CO2, temperature, humidity order; empty without one. */
  causes: CabinFactor[]
  /** Crew drifting on indicators that today's causes could explain: the people a ship alert covers. */
  driftingShip: string[]
  cabinElevated: boolean
  /** Ship alert carried over from an earlier day because the factor behind it is still a suspect. */
  held: boolean
  /** False when the cabin had no usable data: the rule could not check the air. */
  cabinKnown: boolean
}

export type Attribution = 'none' | 'ship' | 'me' | 'shared'
export type Tier = 0 | 1 | 2 | 3 | 4

export interface PersonStatus {
  crewId: string
  day: number
  assessment: PersonDay
  attribution: Attribution
  /** Day count of the current run with the same likely cause (ship vs. personal). */
  episodeDay: number
  tier: Tier
}

export type SummaryKind = 'ship' | 'person' | 'safety'

/** What goes to the flight surgeon. Built by the engine from fixed templates; no LLM. */
export interface SurgeonSummary {
  id: string
  day: number
  kind: SummaryKind
  /** Safety answers skip the day-3 wait. */
  immediate: boolean
  crewId?: string
  episodeDay: number
  attribution?: Attribution
  /** `start` is the starting normal when the indicator is off because of a slow change, else null. */
  indicators: { key: IndicatorKey; daysOff: number; value: number | null; usual: number | null; start: number | null }[]
  affected?: string[]
  /** Ship summaries: the cabin factors blamed. */
  causes?: CabinFactor[]
  cabin: Pick<CabinStatus, 'co2Mean' | 'co2Max1h' | 'baseline' | 'elevated' | 'aboveLimit' | 'overLimit' | 'hasData' | 'temp' | 'rh'>
}

export interface DayResult {
  day: number
  cabin: CabinStatus
  decision: Decision
  people: Record<string, PersonStatus>
  /** Consecutive days the outcome has been "ship", counting today. */
  shipEpisodeDay: number
  shipEpisodeStart: number | null
  summaries: SurgeonSummary[]
}

export interface EngineInput {
  crewIds: string[]
  checkIns: CheckIn[]
  cabin: CabinDay[]
  fromDay: number
  toDay: number
  /** Crew who chose to share their private Watch with the crew medical officer. */
  shareWatch?: Record<string, boolean>
  /**
   * Backtest only: every drifting person is their own case and the ship is never blamed, as in apps
   * that raise one alert per person. Measures the alert load the ship-or-me rule saves. The app never sets it.
   */
  perPersonOnly?: boolean
}
