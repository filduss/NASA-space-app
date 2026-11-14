import { describe, expect, it } from 'vitest'
import {
  checkInEvent,
  clearTheAirQuest,
  dedupeEvents,
  questProgress,
  sleepLogQuest,
  totalXp,
  weekOf,
  weekProgress,
  weeklyStreak,
  XP,
  xpFor,
  type GameEvent,
} from '../src/game/index.ts'
import { checkIn } from './helpers.ts'

describe('XP never depends on a reading', () => {
  it('a bad-day report earns the same XP as a good one', () => {
    const good = checkIn('anna', 10, { sleepHours: 8.5, mood: 10, fatigue: 0, symptoms: [] })
    const bad = checkIn('anna', 10, { sleepHours: 3, mood: 0, fatigue: 10, symptoms: ['headache', 'nausea'], reactionMs: 600 })
    expect(checkInEvent(good)).toEqual(checkInEvent(bad))
    expect(xpFor(checkInEvent(good))).toBe(xpFor(checkInEvent(bad)))
  })
  it('the XP event keeps nothing but who, when and what kind', () => {
    const e = checkInEvent(checkIn('anna', 10, { mood: 0 }))
    expect(Object.keys(e).sort()).toEqual(['crewId', 'day', 'type'])
  })
  it('there is no XP for green readings, improving numbers or good-day streaks', () => {
    expect(Object.keys(XP).sort()).toEqual(['action', 'checkin', 'kudos'])
  })
  it('repeats earn nothing: one check-in per day, one credit per quest step, one kudos per action', () => {
    const events: GameEvent[] = [
      { type: 'checkin', crewId: 'a', day: 1 },
      { type: 'checkin', crewId: 'a', day: 1 },
      { type: 'action', crewId: 'a', day: 1, ref: 'q|scrubber' },
      { type: 'action', crewId: 'a', day: 2, ref: 'q|scrubber' },
      { type: 'kudos', crewId: 'a', day: 2, ref: 'q|scrubber' },
      { type: 'kudos', crewId: 'a', day: 3, ref: 'q|scrubber' },
    ]
    expect(dedupeEvents(events)).toHaveLength(3)
    expect(totalXp(events, 'a')).toBe(XP.checkin + XP.action + XP.kudos)
  })
  it('an event saved by an older version with a type that no longer exists earns nothing', () => {
    const old = { type: 'learn', crewId: 'a', day: 1, ref: 'co2' } as unknown as GameEvent
    expect(totalXp([{ type: 'checkin', crewId: 'a', day: 1 }, old], 'a')).toBe(XP.checkin)
  })
  it('the game is paused on a safety day: nothing is earned', () => {
    const events: GameEvent[] = [
      { type: 'checkin', crewId: 'a', day: 1 },
      { type: 'checkin', crewId: 'a', day: 2 },
    ]
    expect(totalXp(events, 'a', new Set(['a|2']))).toBe(XP.checkin)
  })
})

describe('weekly streak', () => {
  const set = (...xs: number[]) => new Set(xs)
  it('mission weeks are 7 days starting on day 1', () => {
    expect([1, 7, 8, 14, 15].map(weekOf)).toEqual([0, 0, 1, 1, 2])
  })
  it('5 of 7 days keeps the week; 4 does not', () => {
    expect(weekProgress(set(1, 2, 3, 4, 5), set(), 0).kept).toBe(true)
    expect(weekProgress(set(1, 2, 3, 4), set(), 0).kept).toBe(false)
  })
  it('shields cover spacewalk, blackout and heavy-workload days, and never count twice', () => {
    expect(weekProgress(set(1, 2, 3), set(4, 5), 0)).toMatchObject({ checkIns: 3, shields: 2, covered: 5, kept: true })
    expect(weekProgress(set(1, 2, 3, 4), set(4), 0).covered).toBe(4)
  })
  it('counts consecutive kept weeks and stops at the first missed one', () => {
    const days = set(1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33)
    expect(weeklyStreak(days, set(), 33).weeks).toBe(2) // weeks 3 and 4; week 2 was missed
    expect(weeklyStreak(days, set(), 14).weeks).toBe(2)
  })
  it('a week in progress does not break the streak', () => {
    const s = weeklyStreak(set(1, 2, 3, 4, 5, 8), set(), 8)
    expect(s.weeks).toBe(1)
    expect(s.thisWeek.covered).toBe(1)
    expect(s.daysLeft).toBe(6)
  })
})

describe('quests', () => {
  it('a ship quest is done when its steps are done, whoever does them', () => {
    const q = clearTheAirQuest(213)
    expect(questProgress(q, {}).complete).toBe(false)
    const log = { [q.id]: Object.fromEntries(q.steps.map((s, i) => [s.id, { crewId: i % 2 ? 'anna' : 'ben', day: 213 }])) }
    expect(questProgress(q, log)).toEqual({ done: 4, total: 4, complete: true })
  })
  it('the sleep-log quest counts logs, not hours', () => {
    const logs = [1, 2, 3, 4, 5].flatMap((d) => [checkIn('anna', d, { sleepHours: 3 }), checkIn('ben', d, { sleepHours: 9 })])
    const p = sleepLogQuest(0, ['anna', 'ben'], logs, 7)
    expect(p.nights).toEqual({ anna: 5, ben: 5 })
    expect(p.done).toBe(true)
  })
})
