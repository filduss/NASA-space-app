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

/** One morning check-in. Ratings run 0-10; sleepHours and exerciseMin are the wearable's readings. */
export interface CheckIn {
  crewId: string
  /** Mission day (integer). */
  day: number
  /** Last night's sleep from the wearable, hours; null when it has no reading for the night. */
  sleepHours: number | null
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
  /** True for generated check-ins, false for ones entered live in the app. */
  simulated: boolean
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
  /** The subset that the ship-or-me rule may use. Never contains mood or stress. */
  co2LinkedOff: IndicatorKey[]
  symptoms: SymptomKey[]
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
  cabinElevated: boolean
  /** Ship alert carried over from an earlier day because the cabin is still above baseline or over the limit. */
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
  /** A conference request this person made today, if any. Urgent outranks routine. */
  conference: 'routine' | 'urgent' | null
}

/**
 * A crew member asking for a private medical conference with the flight surgeon, as NASA crews can
 * between the weekly ones. Sent on its own, so it never waits for a check-in. Urgent also tells the
 * crew medical officer at once.
 */
export interface ConferenceRequest {
  crewId: string
  day: number
  urgent: boolean
}

/** `urgent` and `conference` are conference requests: urgent carries today's off indicators, routine only the request. */
export type SummaryKind = 'ship' | 'person' | 'urgent' | 'conference'

/** What goes to the flight surgeon. Built by the engine from fixed templates; no LLM. */
export interface SurgeonSummary {
  id: string
  day: number
  kind: SummaryKind
  /** Conference requests skip the day-3 wait. */
  immediate: boolean
  crewId?: string
  episodeDay: number
  attribution?: Attribution
  /** `start` is the starting normal when the indicator is off because of a slow change, else null. */
  indicators: { key: IndicatorKey; daysOff: number; value: number | null; usual: number | null; start: number | null }[]
  affected?: string[]
  cabin: Pick<CabinStatus, 'co2Mean' | 'co2Max1h' | 'baseline' | 'elevated' | 'aboveLimit' | 'overLimit' | 'hasData'>
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
  /** Conference requests, from the crew app only; the simulated crew never makes one. */
  requests?: ConferenceRequest[]
  /**
   * Backtest only: every drifting person is their own case and the ship is never blamed, as in apps
   * that raise one alert per person. Measures the alert load the ship-or-me rule saves. The app never sets it.
   */
  perPersonOnly?: boolean
}
