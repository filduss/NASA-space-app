import type { CheckIn } from '../engine/types.ts'

// The crew's wrist wearable, simulated. It measures what a watch can: last night's sleep and its
// quality, yesterday's exercise, and blood oxygen. The person still rates what only they can feel.
// In the demo, the watch's reading for a night is the simulated crew file's record for that person and day.

export interface WatchReading {
  sleepHours: number
  /** On the check-in's 0-10 sleep-quality scale. */
  sleepQuality: number
  exerciseMin: number | null
  spo2: number | null
}

/** What the watch recorded for this person's night before `day`, or null when it has nothing (no record that day). */
export function watchReading(simulated: CheckIn[], crewId: string, day: number): WatchReading | null {
  const c = simulated.find((x) => x.crewId === crewId && x.day === day && x.simulated)
  if (!c) return null
  return { sleepHours: c.sleepHours, sleepQuality: c.sleepQuality, exerciseMin: c.exerciseMin ?? null, spo2: c.spo2 ?? null }
}
