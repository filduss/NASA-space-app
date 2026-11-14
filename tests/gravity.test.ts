import { describe, expect, it } from 'vitest'
import { zoneStates } from '../src/dashboard/model.ts'
import { exerciseWeek, runEngine, RULES, type CheckIn } from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

const week = (minutes: (number | null)[], lastDay = 10): CheckIn[] =>
  minutes.map((m, i) => checkIn('anna', lastDay - minutes.length + 1 + i, { exerciseMin: m }))

describe('bone and muscle: exercise against its daily target, shown and never judged', () => {
  it('nothing logged is not a lapse', () => {
    expect(exerciseWeek(week([null, null, null, null, null, null, null]), 10)).toEqual({ logged: 0, onTarget: 0, below: 0, lapse: false })
  })
  it('below target on 3 of the last 7 days is a lapse; on 2 it is not', () => {
    const t = RULES.exerciseTargetMin
    expect(exerciseWeek(week([t, t, 0, t, 45, t, 60]), 10).lapse).toBe(true)
    expect(exerciseWeek(week([t, t, 0, t, 45, t, t]), 10).lapse).toBe(false)
  })
  it('counts only the last 7 days up to today', () => {
    const history = [...week([0, 0, 0], 3), ...week([150, 150, 150, 150, 150, 150, 150], 10), checkIn('anna', 11, { exerciseMin: 0 })]
    expect(exerciseWeek(history, 10)).toMatchObject({ logged: 7, below: 0, lapse: false })
  })
  it('a lapse turns the core and limbs zones orange, never red', () => {
    const all = CREW.flatMap((id) => steady(id, 1, 20))
    const me = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20 }).at(-1)!
    const zones = zoneStates(me.people.anna, me.cabin, { logged: 7, onTarget: 3, below: 4, lapse: true })
    expect(zones.core.level).toBe('watch')
    expect(zones.limbs.level).toBe('watch')
    expect(zones.head.level).toBe('ok')
  })
  it('the ship-or-me rule never reads exercise', () => {
    const plain = CREW.flatMap((id) => steady(id, 1, 30))
    const withExercise = plain.map((c, i) => ({ ...c, exerciseMin: i % 3 === 0 ? 0 : 150 }))
    const run = (checkIns: CheckIn[]) => runEngine({ crewIds: CREW, checkIns, cabin: cabin(1, 30), fromDay: 1, toDay: 30 })
    expect(JSON.stringify(run(withExercise).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier])]))).toBe(
      JSON.stringify(run(plain).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier])])),
    )
  })
})
