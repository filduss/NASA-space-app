import { describe, expect, it } from 'vitest'
import { vitalLines, wearableReading } from '../src/data/wearable.ts'
import { runEngine, type CheckIn, type WatchVitals } from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

const vitals: WatchVitals = { restingHr: 61, hrvMs: 36, spo2: 98, respRate: 15.9, skinTempDelta: -0.2 }

describe('the simulated wearable', () => {
  const crew = {
    checkIns: [
      checkIn('chen', 221, { sleepHours: 5, sleepQuality: 4, exerciseMin: 135, watch: vitals }),
      checkIn('chen', 222, { sleepHours: 6.5, simulated: false }),
    ],
  }
  it("reads last night's sleep, yesterday's exercise and the vitals from the simulated record, never the sleep quality", () => {
    expect(wearableReading(crew, 'chen', 221)).toEqual({ sleepHours: 5, exerciseMin: 135, vitals })
  })
  it('has nothing for a day without a simulated record, and never reads a live check-in', () => {
    expect(wearableReading(crew, 'chen', 220)).toBeNull()
    expect(wearableReading(crew, 'chen', 222)).toBeNull()
    expect(wearableReading(crew, 'anna', 221)).toBeNull()
  })
  it('lists the vitals in one order with their units', () => {
    expect(vitalLines(vitals).map((l) => `${l.label}: ${l.value}`)).toEqual([
      'Resting heart rate: 61 bpm',
      'HRV: 36 ms',
      'Blood oxygen: 98%',
      'Breathing: 15.9 /min',
      'Skin temperature: −0.2 °C vs usual',
    ])
    expect(vitalLines({ ...vitals, skinTempDelta: 0 }).at(-1)?.value).toBe('±0.0 °C vs usual')
  })
  it('the vitals are shown for information only: the rules never read them', () => {
    const plain = CREW.flatMap((id) => steady(id, 1, 30))
    const withVitals = plain.map((c, i) => ({ ...c, watch: { ...vitals, restingHr: i % 5 === 0 ? 95 : 58, spo2: i % 7 === 0 ? 90 : 98 } }))
    const run = (checkIns: CheckIn[]) => runEngine({ crewIds: CREW, checkIns, cabin: cabin(1, 30), fromDay: 1, toDay: 30 })
    expect(JSON.stringify(run(withVitals).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier, p.assessment.off])]))).toBe(
      JSON.stringify(run(plain).map((r) => [r.decision, Object.values(r.people).map((p) => [p.attribution, p.tier, p.assessment.off])])),
    )
  })
})
