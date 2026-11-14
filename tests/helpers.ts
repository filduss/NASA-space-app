import type { CabinDay, CheckIn } from '../src/engine/types.ts'

export function checkIn(crewId: string, day: number, over: Partial<CheckIn> = {}): CheckIn {
  return {
    crewId,
    day,
    sleepHours: 7,
    sleepQuality: 7,
    fatigue: 3,
    irritability: 2,
    stress: 3,
    mood: 7,
    symptoms: [],
    reactionMs: 260,
    simulated: true,
    ...over,
  }
}

/** A steady history: small alternating wobble so the baseline has a realistic spread. */
export function steady(crewId: string, fromDay: number, toDay: number): CheckIn[] {
  const out: CheckIn[] = []
  for (let d = fromDay; d <= toDay; d++) {
    const w = d % 2 === 0 ? 0 : 1
    out.push(checkIn(crewId, d, { sleepHours: 7 + w * 0.5, sleepQuality: 7 - w, fatigue: 3 + w, mood: 7 - w, reactionMs: 255 + w * 10 }))
  }
  return out
}

export function cabin(fromDay: number, toDay: number, level = 2.4, over: Record<number, number | null> = {}): CabinDay[] {
  const out: CabinDay[] = []
  for (let d = fromDay; d <= toDay; d++) {
    const co2 = d in over ? over[d] : level + (d % 2 === 0 ? 0.05 : -0.05)
    out.push({ day: d, date: `day-${d}`, hours: co2 === null ? 0 : 24, co2Mean: co2, co2Max1h: co2 === null ? null : co2 + 0.3, temp: 22.5, rh: 45 })
  }
  return out
}

export const CREW = ['anna', 'ben', 'chen', 'dana']
