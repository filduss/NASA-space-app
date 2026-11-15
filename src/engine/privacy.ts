import { RULES } from './config.ts'
import { INDICATORS, SPEC } from './deviation.ts'
import type { DayResult, IndicatorKey, PersonStatus, SurgeonSummary } from './types.ts'

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
  // An urgent conference request never reaches the board: the person is shown as not reporting shared drift.
  const urgent = status.conference === 'urgent'
  const off = urgent ? [] : a.off.filter((k) => SPEC[k].privacy === 'shared')
  return {
    crewId: status.crewId,
    checkedIn: a.checkedIn,
    live: a.live,
    off,
    symptoms: urgent ? [] : a.symptoms,
    ok: a.checkedIn && off.length === 0,
    shipAffected: !urgent && status.attribution === 'ship',
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
  // The flight surgeon sees private readings only inside tier 3 and tier 4 summaries.
  return status.tier >= 3
}

/** The crew medical officer's inbox for a day: tier 2 and above, shaped by the privacy table. */
export interface CmoItem {
  kind: 'ship' | 'shared_pattern' | 'shared_watch' | 'persistent' | 'urgent'
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
    // A routine conference request goes to the flight surgeon only.
    if (p.conference === 'urgent') items.push({ kind: 'urgent', crewId: p.crewId, indicators: [] })
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
      indicators: unique(people.flatMap((p) => (p.conference === 'urgent' ? [] : p.assessment.off))),
    })
  }
  for (const p of people) {
    if (p.conference === 'urgent' || p.attribution === 'none' || p.attribution === 'ship') continue
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
//   flight surgeon         CO2, and only what the summaries sent to Earth contain: a person's row
//                          exists only once a summary names them, counts only on ship-summary days

/** One day of one person, as a viewer may see it. "unknown": nothing about that day reached the viewer. */
export type TimelineMark = 'ok' | 'off' | 'persist' | 'absent' | 'urgent' | 'unknown'

export interface TimelineCell {
  day: number
  mark: TimelineMark
  /** Indicators behind an off / persist mark that this viewer may see. */
  keys: IndicatorKey[]
  /** Symptom names, where the viewer may see them. */
  symptoms: string[]
  /** Named in a ship summary as having CO2-linked changes that day (flight surgeon only). */
  co2Linked: boolean
}

export interface TimelineRow {
  crewId: string
  cells: TimelineCell[]
}

export interface TimelineDay {
  day: number
  co2Mean: number | null
  baseline: number | null
  /** Crew drifting on CO2-linked indicators; null where this viewer has no count for the day. */
  drifting: number | null
  /** A ship alert is on, as far as this viewer knows. */
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
  /** Every summary sent up to the last day of the window. */
  summaries: SurgeonSummary[]
}

const SEVERITY: Record<TimelineMark, number> = { unknown: 0, ok: 1, absent: 1, off: 2, persist: 3, urgent: 4 }

function cell(day: number, mark: TimelineMark, more: Partial<TimelineCell> = {}): TimelineCell {
  return { day, mark, keys: [], symptoms: [], co2Linked: false, ...more }
}

/** A board cell: shared indicators only, urgent conference requests hidden, exactly as boardPerson. */
function boardCell(status: PersonStatus): TimelineCell {
  const p = boardPerson(status)
  if (!p.checkedIn) return cell(status.day, 'absent')
  if (p.off.length === 0) return cell(status.day, 'ok')
  // Day 3 of the same likely cause, the day a summary goes to Earth; a run that only straddles a
  // change of cause (ship, then "me") starts counting again.
  const persist = status.episodeDay >= RULES.persistDays && p.off.some((k) => status.assessment.indicators[k].daysOff >= RULES.persistDays)
  return cell(status.day, persist ? 'persist' : 'off', { keys: p.off, symptoms: p.off.includes('symptoms') ? p.symptoms : [] })
}

/** What the summaries sent to Earth say, day by day. Nothing else reaches the flight surgeon. */
function fromSummaries(summaries: SurgeonSummary[]) {
  const cells = new Map<string, Map<number, TimelineCell>>()
  const drifting = new Map<number, number>()
  const ship = new Set<number>()
  const put = (crewId: string, c: TimelineCell) => {
    const row = cells.get(crewId) ?? new Map<number, TimelineCell>()
    cells.set(crewId, row)
    const was = row.get(c.day)
    if (!was) return void row.set(c.day, c)
    const top = SEVERITY[c.mark] > SEVERITY[was.mark] ? c : was
    row.set(c.day, { ...top, keys: [...new Set([...was.keys, ...c.keys])], co2Linked: was.co2Linked || c.co2Linked })
  }
  for (const s of summaries) {
    if (s.kind === 'ship') {
      // "Ship alert, day N of the alert" also says when it started.
      for (let d = s.day - s.episodeDay + 1; d <= s.day; d++) ship.add(d)
      drifting.set(s.day, s.affected?.length ?? 0)
      for (const id of s.affected ?? []) put(id, cell(s.day, 'off', { co2Linked: true }))
    } else if (s.kind === 'urgent' && s.crewId) {
      put(s.crewId, cell(s.day, 'urgent'))
    } else if (s.kind === 'person' && s.crewId) {
      // "Off own usual for N days": each indicator was off on its last daysOff days up to the summary.
      const longest = Math.max(0, ...s.indicators.map((i) => i.daysOff))
      for (let back = 0; back < longest; back++) {
        const on = s.indicators.filter((i) => i.daysOff > back)
        if (on.length === 0) continue
        const persist = on.some((i) => i.daysOff - back >= RULES.persistDays)
        put(s.crewId, cell(s.day - back, persist ? 'persist' : 'off', { keys: on.map((i) => i.key) }))
      }
    }
  }
  return { cells, drifting, ship }
}

export function crewTimeline(viewer: Viewer, input: TimelineInput): Timeline {
  const { window, crewIds } = input
  const crewSize = window.at(-1)?.decision.crewSize ?? crewIds.length
  const needed = Math.ceil(crewSize * RULES.crewShare)

  if (viewer.kind === 'surgeon') {
    const last = window.at(-1)?.day ?? -Infinity
    const sent = fromSummaries(input.summaries.filter((s) => s.day <= last))
    const days = window.map((r) => ({
      day: r.day,
      co2Mean: r.cabin.co2Mean,
      baseline: r.cabin.baseline,
      drifting: sent.drifting.get(r.day) ?? null,
      ship: sent.ship.has(r.day),
    }))
    const rows = crewIds
      .map((id) => ({ crewId: id, cells: window.map((r) => sent.cells.get(id)?.get(r.day) ?? cell(r.day, 'unknown')) }))
      .filter((row) => row.cells.some((c) => c.mark !== 'unknown'))
    return { days, rows, crewSize, needed }
  }

  const days = window.map((r) => ({
    day: r.day,
    co2Mean: r.cabin.co2Mean,
    baseline: r.cabin.baseline,
    drifting: r.decision.driftingCo2.length,
    ship: r.decision.outcome === 'ship',
  }))
  const visible = viewer.kind === 'crew' ? crewIds.filter((id) => id === viewer.crewId) : crewIds
  const rows = visible.map((id) => ({ crewId: id, cells: window.map((r) => boardCell(r.people[id])) }))
  return { days, rows, crewSize, needed }
}
