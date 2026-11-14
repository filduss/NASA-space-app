import type { CabinDay, CheckIn } from '../engine/types.ts'
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
  meta: { crews: number; crewSize: number; seeds: string; generatedAt: string; tuning: string; traces: Record<string, { days: number }> }
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
