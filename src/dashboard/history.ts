// Data behind the expanded charts on the personal dashboard: one person's check-ins or the
// cabin CO2 over a chosen range, with the days the engine flagged. Like model.ts it adds no
// rules: every level comes from indicatorLevel / cabinLevel on that day's engine result.

import type { CabinHour } from '../data/types.ts'
import type { CheckIn, DayResult, IndicatorKey } from '../engine/types.ts'
import { cabinLevel, indicatorLevel, type Level } from './model.ts'

export type RangeKey = '1d' | '7d' | '14d' | '30d' | 'all'

export const RANGE_LABEL: Record<RangeKey, string> = { '1d': '1D', '7d': '7D', '14d': '14D', '30d': '30D', all: 'All' }
export const RANGE_NAME: Record<RangeKey, string> = {
  '1d': 'Last 24 hours',
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
  all: 'Mission so far',
}
const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '1d': 1, '7d': 7, '14d': 14, '30d': 30 }

/** Check-ins come once a day, so a one-day chart would be a single dot: vitals start at 7 days. */
export const VITAL_RANGES: RangeKey[] = ['7d', '14d', '30d', 'all']
/** Cabin CO2 is hourly, so it also has a one-day view (the 24 h before the check-in). */
export const CO2_RANGES: RangeKey[] = ['1d', '7d', '30d', 'all']

/** First mission day inside the range, never before the first day with data. */
export function rangeStart(range: RangeKey, today: number, firstDay: number): number {
  if (range === 'all') return firstDay
  return Math.max(firstDay, today - RANGE_DAYS[range] + 1)
}

export interface Point {
  /** Position on the x axis: mission day for check-ins, hours since the epoch for cabin data. */
  x: number
  /** null = nothing recorded (no check-in, or the value was not measured). */
  v: number | null
  day: number
  /** When, for the readout: "Day 219" or "Day 219 · 14:00 UTC". */
  when: string
}

export interface Flag {
  day: number
  /** Span on the x axis the day covers. */
  x0: number
  x1: number
  level: Exclude<Level, 'ok'>
}

export interface Series {
  points: Point[]
  flags: Flag[]
}

/** Same units as the vital tiles: reaction in ms, the rest as entered. */
export function vitalValue(key: IndicatorKey, c: CheckIn): number | null {
  if (key === 'reaction') return c.reactionMs
  if (key === 'symptoms') return c.symptoms.length
  return c[key]
}

function byDay(results: DayResult[]): Map<number, DayResult> {
  return new Map(results.map((r) => [r.day, r]))
}

/** One point per mission day from `from` to `to`, with the days this indicator was off. */
export function vitalSeries(key: IndicatorKey, crewId: string, history: CheckIn[], results: DayResult[], from: number, to: number): Series {
  const checks = new Map(history.filter((c) => c.crewId === crewId).map((c) => [c.day, c]))
  const res = byDay(results)
  const points: Point[] = []
  const flags: Flag[] = []
  for (let d = from; d <= to; d++) {
    const c = checks.get(d)
    points.push({ x: d, v: c ? vitalValue(key, c) : null, day: d, when: `Day ${d}` })
    const me = res.get(d)?.people[crewId]
    if (!me) continue
    const level = indicatorLevel(me, key)
    if (level !== 'ok') flags.push({ day: d, x0: d - 0.5, x1: d + 0.5, level })
  }
  return { points, flags }
}

export const hourX = (t: string) => Date.parse(t) / 3_600_000

/** Hourly cabin CO2 for mission days `from`..`to`, with the days the cabin was flagged. */
export function co2Series(hourly: CabinHour[], results: DayResult[], from: number, to: number): Series {
  const hours = hourly.filter((h) => h.day >= from && h.day <= to)
  const points: Point[] = hours.map((h) => ({ x: hourX(h.t), v: h.co2, day: h.day, when: `Day ${h.day} · ${h.t.slice(11, 16)} UTC` }))
  const res = byDay(results)
  const flags: Flag[] = []
  for (let d = from; d <= to; d++) {
    const r = res.get(d)
    if (!r) continue
    const level = cabinLevel(r.cabin)
    if (level === 'ok') continue
    const xs = points.filter((p) => p.day === d).map((p) => p.x)
    if (xs.length === 0) continue
    flags.push({ day: d, x0: Math.min(...xs) - 0.5, x1: Math.max(...xs) + 0.5, level })
  }
  return { points, flags }
}

export interface Stats {
  mean: number | null
  min: number | null
  max: number | null
  /** Points with a value. */
  n: number
}

export function stats(points: Point[]): Stats {
  const vs = points.flatMap((p) => (p.v === null ? [] : [p.v]))
  if (vs.length === 0) return { mean: null, min: null, max: null, n: 0 }
  return { mean: vs.reduce((a, b) => a + b, 0) / vs.length, min: Math.min(...vs), max: Math.max(...vs), n: vs.length }
}

/** Round tick values inside lo..hi (1, 2 or 5 times a power of ten apart), about `count` intervals. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo]
  const raw = (hi - lo) / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const span = hi - lo
  const step = [0.5, 1, 2, 5, 10]
    .map((m) => m * pow)
    .reduce((best, s) => (Math.abs(span / s - count) < Math.abs(span / best - count) ? s : best))
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)))
  return out
}
