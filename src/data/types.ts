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
}

export interface BacktestFile {
  meta: { crews: number; crewSize: number; seeds: string; generatedAt: string; tuning: string; traces: Record<string, { days: number }> }
  definitions: Record<string, string>
  scenarios: BacktestScenario[]
  limits: string[]
}

export type AccountRole = 'astronaut' | 'medical'

export interface Account {
  crewId: string
  role: AccountRole
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
