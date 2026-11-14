import { describe, expect, it } from 'vitest'
import type { CabinHour } from '../src/data/types.ts'
import { co2Series, niceTicks, rangeStart, stats, vitalSeries } from '../src/dashboard/history.ts'
import { indicatorLevel } from '../src/dashboard/model.ts'
import { runEngine, type CheckIn } from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

const FIRST = 100
const TODAY = 140

function world(over: (all: CheckIn[]) => CheckIn[] = (x) => x, cabinOver: Record<number, number | null> = {}) {
  const checkIns = over(CREW.flatMap((id) => steady(id, FIRST, TODAY)))
  const days = cabin(FIRST, TODAY, 2.4, cabinOver)
  const results = runEngine({ crewIds: CREW, checkIns, cabin: days, fromDay: FIRST, toDay: TODAY })
  return { checkIns, results }
}

describe('chart ranges', () => {
  it('counts back from today and never starts before the first day', () => {
    expect(rangeStart('7d', TODAY, FIRST)).toBe(134)
    expect(rangeStart('1d', TODAY, FIRST)).toBe(TODAY)
    expect(rangeStart('30d', 110, FIRST)).toBe(FIRST)
    expect(rangeStart('all', TODAY, FIRST)).toBe(FIRST)
  })

  it('round ticks cover the range', () => {
    expect(niceTicks(0, 10, 4)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(194, 223, 4)).toEqual([200, 210, 220])
    expect(niceTicks(5, 5)).toEqual([5])
  })
})

describe('vital history', () => {
  it('has one point per day, with a gap where there was no check-in', () => {
    const { checkIns, results } = world((all) => all.filter((c) => !(c.crewId === 'chen' && c.day === 137)))
    const s = vitalSeries('sleepHours', 'chen', checkIns, results, 134, TODAY)
    expect(s.points.map((p) => p.day)).toEqual([134, 135, 136, 137, 138, 139, 140])
    expect(s.points.find((p) => p.day === 137)?.v).toBeNull()
    expect(stats(s.points).n).toBe(6)
  })

  it('reads only the requested person', () => {
    const { checkIns, results } = world((all) => all.map((c) => (c.crewId === 'anna' ? { ...c, sleepHours: 3 } : c)))
    const s = vitalSeries('sleepHours', 'chen', checkIns, results, FIRST, TODAY)
    expect(s.points.every((p) => p.v !== 3)).toBe(true)
  })

  it('flags exactly the days the engine flagged, at the engine level', () => {
    const short = (c: CheckIn) => (c.crewId === 'chen' && c.day >= 138 ? { ...c, sleepHours: 4 } : c)
    const { checkIns, results } = world((all) => all.map(short))
    const s = vitalSeries('sleepHours', 'chen', checkIns, results, FIRST, TODAY)
    const expected = results.flatMap((r) => {
      const l = indicatorLevel(r.people.chen, 'sleepHours')
      return l === 'ok' ? [] : [{ day: r.day, level: l }]
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(s.flags.map((f) => ({ day: f.day, level: f.level }))).toEqual(expected)
  })

  it('shows reaction time in ms, like the tile', () => {
    const { checkIns, results } = world((all) => all.map((c) => (c.crewId === 'chen' && c.day === TODAY ? checkIn('chen', TODAY, { reactionMs: 312 }) : c)))
    const s = vitalSeries('reaction', 'chen', checkIns, results, TODAY, TODAY)
    expect(s.points[0].v).toBe(312)
  })
})

describe('cabin CO2 history', () => {
  const hours = (day: number, co2: number): CabinHour[] =>
    Array.from({ length: 24 }, (_, h) => ({ t: `2018-08-${String(day - 100).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`, day, co2, temp: null, rh: null }))

  it('keeps hourly values as they are and only the days in range', () => {
    const { results } = world()
    const hourly = [...hours(138, 2.5), ...hours(139, 2.6), ...hours(140, 2.7)]
    const s = co2Series(hourly, results, 139, 140)
    expect(s.points).toHaveLength(48)
    expect(new Set(s.points.map((p) => p.v))).toEqual(new Set([2.6, 2.7]))
    expect(s.points[0].when).toBe('Day 139 · 00:00 UTC')
  })

  it('flags a day whose mean is over the limit and leaves normal days unflagged', () => {
    const { results } = world(undefined, { 140: 3.4 })
    const hourly = [...hours(139, 2.4), ...hours(140, 3.4)]
    const s = co2Series(hourly, results, 139, 140)
    expect(s.flags).toHaveLength(1)
    expect(s.flags[0]).toMatchObject({ day: 140, level: 'alert' })
  })
})
