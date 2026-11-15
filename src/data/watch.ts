import type { CheckIn, WatchVitals } from '../engine/types.ts'

// The crew's wrist wearable, simulated. It measures what a watch can: last night's sleep and its
// quality, yesterday's exercise, and vitals (resting heart rate, HRV, blood oxygen, breathing, skin
// temperature). The person still rates what only they can feel. In the demo, the watch's reading for a
// night is the simulated crew file's record for that person and day.

export interface WatchReading {
  sleepHours: number
  /** On the check-in's 0-10 sleep-quality scale. */
  sleepQuality: number
  exerciseMin: number | null
  /** Shown for information only: no rule reads these yet. */
  vitals: WatchVitals | null
}

/** What the watch recorded for this person's night before `day`, or null when it has nothing (no record that day). */
export function watchReading(simulated: CheckIn[], crewId: string, day: number): WatchReading | null {
  const c = simulated.find((x) => x.crewId === crewId && x.day === day && x.simulated)
  if (!c) return null
  return { sleepHours: c.sleepHours, sleepQuality: c.sleepQuality, exerciseMin: c.exerciseMin ?? null, vitals: c.watch ?? null }
}

/** The vitals as label and value, in one fixed order for the check-in card and the dashboard panel. */
export function vitalLines(v: WatchVitals): { label: string; value: string }[] {
  const t = v.skinTempDelta
  return [
    { label: 'Resting heart rate', value: `${v.restingHr} bpm` },
    { label: 'HRV', value: `${v.hrvMs} ms` },
    { label: 'Blood oxygen', value: `${v.spo2}%` },
    { label: 'Breathing', value: `${v.respRate.toFixed(1)} /min` },
    { label: 'Skin temperature', value: `${t > 0 ? '+' : t < 0 ? '−' : '±'}${Math.abs(t).toFixed(1)} °C vs usual` },
  ]
}
