import type { CheckIn } from '../engine/types.ts'

/** What the wearable measured for one person on one mission day: last night's sleep and yesterday's exercise. */
export interface WearableReading {
  sleepHours: number | null
  exerciseMin: number | null
}

/**
 * The wearable's reading for a person and day, or null when it has none.
 *
 * The demo's wearable is simulated: its readings are the sleep and exercise fields of the simulated
 * crew's daily records in crew.json. When a real (or separately simulated) wearable feed exists, only
 * this function changes.
 */
export function wearableReading(crew: { checkIns: CheckIn[] }, crewId: string, day: number): WearableReading | null {
  const rec = crew.checkIns.find((c) => c.crewId === crewId && c.day === day && c.simulated)
  if (!rec) return null
  return { sleepHours: rec.sleepHours, exerciseMin: rec.exerciseMin ?? null }
}
