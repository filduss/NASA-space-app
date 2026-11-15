import { RULES } from './config.ts'
import { INDICATORS, SPEC } from './deviation.ts'
import type { DayResult, IndicatorKey, PersonStatus } from './types.ts'

// Who may see what (docs/SPEC.md, "Privacy"). The UI only ever renders through these helpers.

export type Viewer = { kind: 'crew'; crewId: string } | { kind: 'cmo' } | { kind: 'surgeon' }

export const PRIVATE_KEYS: IndicatorKey[] = INDICATORS.filter((i) => i.privacy === 'private').map((i) => i.key)
export const SHARED_KEYS: IndicatorKey[] = INDICATORS.filter((i) => i.privacy === 'shared').map((i) => i.key)

/** What the crew board shows about a person: shared indicators only, never mood or stress. */
export interface BoardPerson {
  crewId: string
  checkedIn: boolean
  live: boolean
  /** Shared indicators that are off today. */
  off: IndicatorKey[]
  symptoms: string[]
  /** True when the only thing known is "ok on what is shared". */
  ok: boolean
  /** Counts as affected by a ship alert. */
  shipAffected: boolean
}

export function boardPerson(status: PersonStatus): BoardPerson {
  const a = status.assessment
  // Safety answers never reach the board: the person is shown as not reporting shared drift.
  const off = a.safety ? [] : a.off.filter((k) => SPEC[k].privacy === 'shared')
  return {
    crewId: status.crewId,
    checkedIn: a.checkedIn,
    live: a.live,
    off,
    symptoms: a.safety ? [] : a.symptoms,
    ok: a.checkedIn && off.length === 0,
    shipAffected: !a.safety && status.attribution === 'ship',
  }
}

/** Mood and stress on the board: a count of crew off their usual, with no names. */
export function privateCount(day: DayResult): { off: number; of: number } {
  const people = Object.values(day.people).filter((p) => p.assessment.checkedIn)
  const off = people.filter((p) => p.assessment.off.some((k) => SPEC[k].privacy === 'private')).length
  return { off, of: people.length }
}

/**
 * The re-check after a ship alert, for shared screens: is the air back to its usual level, and are the
 * crew it touched back to theirs? Counts only, judged on shared indicators as the crew board does.
 */
export interface ShipFollowUp {
  alertStart: number
  alertEnd: number
  /** Days since the alert's last day: 1 is the first day after it. */
  daysSince: number
  /** Null when there is no cabin data today, so the air could not be re-checked. */
  airBack: boolean | null
  /** Crew whose change was put down to the ship on any day of the alert. */
  affected: number
  recovered: number
  stillOff: number
  notCheckedIn: number
}

/** `results` runs up to today. Null while an alert is on, or once the follow-up window has passed. */
export function shipFollowUp(results: DayResult[], windowDays: number = RULES.followUpDays): ShipFollowUp | null {
  const today = results[results.length - 1]
  if (!today || today.decision.outcome === 'ship') return null
  let end = results.length - 2
  while (end >= 0 && results[end].decision.outcome !== 'ship') end--
  if (end < 0 || today.day - results[end].day > windowDays) return null
  let start = end
  while (start > 0 && results[start - 1].decision.outcome === 'ship') start--
  const affected = new Set<string>()
  for (const r of results.slice(start, end + 1)) {
    for (const p of Object.values(r.people)) if (boardPerson(p).shipAffected) affected.add(p.crewId)
  }
  const now = [...affected].map((id) => boardPerson(today.people[id]))
  return {
    alertStart: results[start].day,
    alertEnd: results[end].day,
    daysSince: today.day - results[end].day,
    airBack: today.cabin.hasData ? !(today.cabin.elevated || today.cabin.overLimit) : null,
    affected: affected.size,
    recovered: now.filter((p) => p.ok).length,
    stillOff: now.filter((p) => p.checkedIn && !p.ok).length,
    notCheckedIn: now.filter((p) => !p.checkedIn).length,
  }
}

/** May this viewer see this person's private indicators (mood, stress) and private cards? */
export function canSeePrivate(viewer: Viewer, status: PersonStatus, sharedWithCmo: boolean): boolean {
  if (viewer.kind === 'crew') return viewer.crewId === status.crewId
  if (viewer.kind === 'cmo') return sharedWithCmo || status.tier >= 4
  // The flight surgeon sees what the crew medical officer sees, and private readings in tier 3 and
  // tier 4 summaries too.
  return sharedWithCmo || status.tier >= 3
}

/** The crew medical officer's inbox for a day: tier 2 and above, shaped by the privacy table. */
export interface CmoItem {
  kind: 'ship' | 'shared_pattern' | 'shared_watch' | 'persistent' | 'safety'
  /** Named only where the privacy table allows it. */
  crewId?: string
  count?: number
  of?: number
  indicators: IndicatorKey[]
}

export function cmoInbox(day: DayResult, shareWatch: Record<string, boolean>): CmoItem[] {
  const items: CmoItem[] = []
  const people = Object.values(day.people)
  for (const p of people) {
    if (p.assessment.safety) items.push({ kind: 'safety', crewId: p.crewId, indicators: [] })
  }
  if (day.decision.outcome === 'ship') {
    items.push({
      kind: 'ship',
      count: day.decision.driftingCo2.length,
      of: day.decision.crewSize,
      indicators: unique(people.flatMap((p) => p.assessment.co2LinkedOff)),
    })
  }
  if (day.decision.outcome === 'shared') {
    // The pattern goes to the crew medical officer with no names.
    items.push({
      kind: 'shared_pattern',
      count: day.decision.driftingAny.length,
      of: day.decision.crewSize,
      indicators: unique(people.flatMap((p) => (p.assessment.safety ? [] : p.assessment.off))),
    })
  }
  for (const p of people) {
    if (p.assessment.safety || p.attribution === 'none' || p.attribution === 'ship') continue
    const shared = shareWatch[p.crewId] === true
    const visible = p.assessment.off.filter((k) => shared || SPEC[k].privacy === 'shared')
    if (p.tier === 3 && visible.length > 0) items.push({ kind: 'persistent', crewId: p.crewId, indicators: visible })
    else if (shared) items.push({ kind: 'shared_watch', crewId: p.crewId, indicators: visible })
  }
  return items
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

// ---- Crew timeline ---------------------------------------------------------------------------
// One picture per viewer: cabin CO2, how many crew drift on CO2-linked indicators, and a row per
// person. The same chart for everyone; what fills it follows the privacy table above.
//   crew member            CO2, counts, their own row only
//   crew medical officer   CO2, counts, every crew member's row (shared indicators, as on the board)
//   flight surgeon         the same as the crew medical officer

/** One day of one person, as a viewer may see it. */
export type TimelineMark = 'ok' | 'off' | 'persist' | 'absent' | 'shield'

export interface TimelineCell {
  day: number
  mark: TimelineMark
  /** Indicators behind an off / persist mark that this viewer may see. */
  keys: IndicatorKey[]
  /** Symptom names, where the viewer may see them. */
  symptoms: string[]
}

export interface TimelineRow {
  crewId: string
  cells: TimelineCell[]
}

export interface TimelineDay {
  day: number
  co2Mean: number | null
  baseline: number | null
  /** Crew drifting on CO2-linked indicators. */
  drifting: number
  /** A ship alert is on. */
  ship: boolean
}

export interface Timeline {
  days: TimelineDay[]
  rows: TimelineRow[]
  crewSize: number
  /** Crew drifting that the ship-or-me rule needs. */
  needed: number
}

export interface TimelineInput {
  /** The days to show, oldest first. */
  window: DayResult[]
  crewIds: string[]
  shielded: (crewId: string, day: number) => boolean
}

function cell(day: number, mark: TimelineMark, more: Partial<TimelineCell> = {}): TimelineCell {
  return { day, mark, keys: [], symptoms: [], ...more }
}

/** A board cell: shared indicators only, safety answers hidden, exactly as boardPerson. */
function boardCell(status: PersonStatus, shielded: boolean): TimelineCell {
  const p = boardPerson(status)
  if (!p.checkedIn) return cell(status.day, shielded ? 'shield' : 'absent')
  if (p.off.length === 0) return cell(status.day, 'ok')
  // Day 3 of the same likely cause, the day a summary goes to Earth; a run that only straddles a
  // change of cause (ship, then "me") starts counting again.
  const persist = status.episodeDay >= RULES.persistDays && p.off.some((k) => status.assessment.indicators[k].daysOff >= RULES.persistDays)
  return cell(status.day, persist ? 'persist' : 'off', { keys: p.off, symptoms: p.off.includes('symptoms') ? p.symptoms : [] })
}

export function crewTimeline(viewer: Viewer, input: TimelineInput): Timeline {
  const { window, crewIds, shielded } = input
  const crewSize = window.at(-1)?.decision.crewSize ?? crewIds.length
  const needed = Math.ceil(crewSize * RULES.crewShare)

  const days = window.map((r) => ({
    day: r.day,
    co2Mean: r.cabin.co2Mean,
    baseline: r.cabin.baseline,
    drifting: r.decision.driftingCo2.length,
    ship: r.decision.outcome === 'ship',
  }))
  const visible = viewer.kind === 'crew' ? crewIds.filter((id) => id === viewer.crewId) : crewIds
  const rows = visible.map((id) => ({ crewId: id, cells: window.map((r) => boardCell(r.people[id], shielded(id, r.day))) }))
  return { days, rows, crewSize, needed }
}
