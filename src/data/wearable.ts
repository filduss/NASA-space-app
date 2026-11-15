import type { CheckIn, WatchVitals } from '../engine/types.ts'

/** What the wearable measured for one person on one mission day: last night's sleep, yesterday's exercise and vitals. */
export interface WearableReading {
  sleepHours: number | null
  exerciseMin: number | null
  /** Resting heart rate, HRV, blood oxygen, breathing, skin temperature. Shown for information only: no rule reads these. */
  vitals: WatchVitals | null
}

/**
 * The wearable's reading for a person and day, or null when it has none.
 *
 * The demo's wearable is simulated: its readings are the sleep, exercise and `watch` fields of the
 * simulated crew's daily records in crew.json. A live check-in is never read as a reading. When a real
 * wearable feed exists, only this function changes.
 */
export function wearableReading(crew: { checkIns: CheckIn[] }, crewId: string, day: number): WearableReading | null {
  const rec = crew.checkIns.find((c) => c.crewId === crewId && c.day === day && c.simulated)
  if (!rec) return null
  return { sleepHours: rec.sleepHours, exerciseMin: rec.exerciseMin ?? null, vitals: rec.watch ?? null }
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
