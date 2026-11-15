import { describe, expect, it } from 'vitest'
import { wearableReading } from '../src/data/wearable.ts'
import { formFrom, left, noSymptoms, rate, toCheckIn, toggleSymptom, type CheckInForm } from '../src/ui/checkInForm.ts'
import { checkIn } from './helpers.ts'

describe('wearable reading', () => {
  const crew = { checkIns: [checkIn('anna', 20, { sleepHours: 6.2, exerciseMin: 95 }), checkIn('anna', 21, { sleepHours: 5 })] }

  it("gives last night's sleep and yesterday's exercise from the wearable", () => {
    expect(wearableReading(crew, 'anna', 20)).toEqual({ sleepHours: 6.2, exerciseMin: 95 })
  })
  it('has no exercise figure when the wearable logged none', () => {
    expect(wearableReading(crew, 'anna', 21)).toEqual({ sleepHours: 5, exerciseMin: null })
  })
  it('is null on a day the wearable has no reading for that person', () => {
    expect(wearableReading(crew, 'anna', 22)).toBeNull()
    expect(wearableReading(crew, 'ben', 20)).toBeNull()
  })
})

describe('check-in form', () => {
  const ctx = { crewId: 'anna', day: 20, wearable: { sleepHours: 6.2, exerciseMin: 95 } }

  it('starts with every rating and the symptoms unanswered, so it cannot be sent yet', () => {
    const f = formFrom(undefined)
    expect(left(f)).toBe(6)
    expect(toCheckIn(f, ctx)).toBeNull()
  })

  const answered = (): CheckInForm => {
    let f = formFrom(undefined)
    for (const [k, v] of [['sleepQuality', 6], ['fatigue', 4], ['irritability', 3], ['stress', 5], ['mood', 6]] as const) f = rate(f, k, v)
    return noSymptoms(f)
  }

  it('sends a live check-in with the answers and the wearable reading, and no reaction time', () => {
    expect(toCheckIn(answered(), ctx)).toEqual({
      crewId: 'anna',
      day: 20,
      sleepHours: 6.2,
      exerciseMin: 95,
      sleepQuality: 6,
      fatigue: 4,
      irritability: 3,
      stress: 5,
      mood: 6,
      symptoms: [],
      reactionMs: null,
      simulated: false,
    })
  })
  it('sends sleep as not measured when the wearable has no reading for last night', () => {
    expect(toCheckIn(answered(), { ...ctx, wearable: null })).toMatchObject({ sleepHours: null, exerciseMin: null })
  })

  it('"None today" and a symptom exclude each other', () => {
    const none = noSymptoms(formFrom(undefined))
    expect(none.symptoms).toEqual([])
    const headache = toggleSymptom(none, 'headache')
    expect(headache.symptoms).toEqual(['headache'])
    expect(toggleSymptom(toggleSymptom(headache, 'nausea'), 'headache').symptoms).toEqual(['nausea'])
    expect(noSymptoms(headache).symptoms).toEqual([])
  })
  it('untoggling the last symptom leaves the question unanswered, not "None today"', () => {
    const f = toggleSymptom(toggleSymptom(formFrom(undefined), 'headache'), 'headache')
    expect(f.symptoms).toBeNull()
    expect(left(f)).toBe(6)
  })

  it("reopens with the answers sent today, but never pre-fills from the simulator's record", () => {
    const sent = checkIn('anna', 20, { sleepQuality: 4, fatigue: 6, irritability: 5, stress: 7, mood: 3, symptoms: ['nausea'], simulated: false })
    expect(formFrom(sent)).toEqual({ ratings: { sleepQuality: 4, fatigue: 6, irritability: 5, stress: 7, mood: 3 }, symptoms: ['nausea'] })
    expect(formFrom({ ...sent, simulated: true })).toEqual(formFrom(undefined))
  })
})
