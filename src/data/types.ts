import type { CabinDay, CabinFactor, CheckIn } from '../engine/types.ts'
import type { ShieldKind } from '../game/streak.ts'

export interface CabinHour {
  t: string
  day: number
  co2: number
  temp: number | null
  rh: number | null
}

export interface CabinFile {
  meta: {
    real: true
    source: string
    mission: string
    missionTitle: string
    osdrLink: string
    apiUrl: string
    appUrl: string
    fetchedAt: string
    rawSha256: string
    conversion: string
    caveat: string
    excluded: string
    dailyWindow: string
    limitMmHg: number
    limitSource: string
    replay: { anchorDate: string; anchorMissionDay: number; note: string }
  }
  daily: CabinDay[]
  hourly: CabinHour[]
}

export interface ShieldDay {
  day: number
  kind: ShieldKind
  crewIds: string[]
  label: string
}

export interface CrewFile {
  meta: {
    simulated: true
    label: string
    seed: number
    seedSearch: { seedsTried: number; note: string; criteria: string[] }
    days: [number, number]
    demoDay: number
  }
  crew: { id: string; name: string }[]
  shieldDays: ShieldDay[]
  checkIns: CheckIn[]
}

export interface BacktestScenario {
  name: string
  crewDays: number
  personDays: number
  shipOrMeAccuracy: number | null
  accuracyJudgedAlerts: number
  ship: {
    events: number
    missedShare: number | null
    eventsRise2Plus: number
    missedShareRise2Plus: number | null
    delayDaysMedian: number | null
    delayDaysP90: number | null
  }
  individual: { events: number; missedShare: number | null; delayDaysMedian: number | null; delayDaysP90: number | null }
  falseAlarms: {
    shipPerCrewDay: number
    sharedPatternPerCrewDay: number
    privateCardPerPersonDay: number
    surgeonSummaryPerCrewDay: number
  }
  /** During ship events: Shipshape against the same crews with one case per person. Older files lack it. */
  alertLoad?: { shipEvents: number; shipshape: AlertLoad; perPerson: AlertLoad }
  /** Person-days with both a personal event and a CO2 rise, left out of the accuracy. */
  accuracyMixedExcluded?: number
  /** Personal events that overlap a ship alert, against those with no alert. Older files lack it. */
  masking?: { overlappingShipAlert: Masking; noShipAlert: Masking }
  /** Only in the slow-decline scenario. */
  slowDecline?: {
    events: number
    minDays: number
    flaggedShare: number | null
    flagDelayDaysMedian: number | null
    toSurgeonShare: number | null
    toSurgeonDelayDaysMedian: number | null
  }
  /** The accuracy split by the kind of day: a CO2 rise, or one person's own problem. Older files lack it. */
  accuracyByClass?: Record<'shipDays' | 'personalDays', { accuracy: number | null; alerts: number }>
  /** Ship-alert crew-days by the cabin factor blamed, and how many had no CO2 rise behind them. Older files lack it. */
  shipByCause?: Record<CabinFactor, { crewDays: number; falseAlarmCrewDays: number }>
  /** The simulated crews' own readings, beside published ISS figures (meta.issCrews). Older files lack it. */
  crewStats?: { checkIns: number; sleepHoursMean: number; sleepUnder6Share: number; headacheDayShare: number; reactionMsMean: number | null }
}

/** Real days in one ISS trace, counted from the engine's own cabin status. */
export interface TraceCabin {
  dates: [string, string]
  daysWithData: number
  /** Days at least 1 mmHg above the trace's median: the backtest's ship events. */
  co2RiseDays: number
  /** Days with a 24 h mean over NASA's 3 mmHg limit. */
  co2OverLimitDays: number
  /** Days each factor was a suspect of the ship-or-me rule. */
  suspectDays: Record<CabinFactor, number>
  tempRange: [number, number]
  rhRange: [number, number]
}

/** A published figure for real ISS crews. */
export interface IssCrewFigure {
  value: number
  text: string
  source: string
}

export interface Masking {
  events: number
  labelledShipOnADay: number
  neverLabelledPersonal: number
  toSurgeonDelayDaysMedian: number | null
  neverReachedSurgeon: number
}

export interface AlertLoad {
  /** Person-days treated as a personal problem ("likely you"). */
  caseDays: number
  personSummaries: number
  shipSummaries: number
}

export interface BacktestFile {
  meta: {
    crews: number
    crewSize: number
    seeds: string
    generatedAt: string
    tuning: string
    traces: Record<string, { days: number; cabin?: TraceCabin }>
    /** Published figures for real ISS crews. Older files lack it. */
    issCrews?: { sleepHours: IssCrewFigure; headacheDayShare: IssCrewFigure }
  }
  definitions: Record<string, string>
  scenarios: BacktestScenario[]
  limits: string[]
}

/** astronaut and medical are crew; surgeon is the flight surgeon at Mission Control on Earth. */
export type AccountRole = 'astronaut' | 'medical' | 'surgeon'

export interface Account {
  /** The account id: a crew id from crew.json, or for Earth staff an id of its own. */
  crewId: string
  role: AccountRole
  /** Display name for someone outside the crew; crew names come from crew.json. */
  name?: string
  /** Base64 random salt. */
  salt: string
  /** Base64 PBKDF2 output. The PIN itself is never stored. */
  hash: string
}

export interface AccountsFile {
  meta: {
    generator: string
    label: string
    kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; keyBytes: number }
  }
  accounts: Account[]
}
