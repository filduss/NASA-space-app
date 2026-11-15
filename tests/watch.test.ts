import { describe, expect, it } from 'vitest'
import { watchReading } from '../src/data/watch.ts'
import { runEngine, type CheckIn } from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

describe('the simulated wrist wearable', () => {
  const simulated = [
    checkIn('chen', 221, { sleepHours: 5, sleepQuality: 4, exerciseMin: 135, spo2: 97 }),
    checkIn('chen', 222, { sleepHours: 6.5, simulated: false }),
  ]
  it("reads last night's sleep, the sleep score, yesterday's exercise and blood oxygen from the simulated record", () => {
    expect(watchReading(simulated, 'chen', 221)).toEqual({ sleepHours: 5, sleepQuality: 4, exerciseMin: 135, spo2: 97 })
  })
  it('has nothing for a day without a simulated record, and never reads a live check-in', () => {
    expect(watchReading(simulated, 'chen', 220)).toBeNull()
    expect(watchReading(simulated, 'chen', 222)).toBeNull()
    expect(watchReading(simulated, 'anna', 221)).toBeNull()
  })
  it('blood oxygen is shown, never judged: the rules never read it', () => {
    const plain = CREW.flatMap((id) => steady(id, 1, 30))
    const withSpo2 = plain.map((c, i) => ({ ...c, spo2: i % 5 === 0 ? 90 : 98 }))
    const run = (checkIns: CheckIn[]) => runEngine({ crewIds: CREW, checkIns, cabin: cabin(1, 30), fromDay: 1, toDay: 30 })
    expect(JSON.stringify(run(withSpo2).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier, p.assessment.off])]))).toBe(
      JSON.stringify(run(plain).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier, p.assessment.off])])),
    )
  })
})
