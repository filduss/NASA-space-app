import { RULES } from './config.ts'
import type { CheckIn } from './types.ts'

// Bone and muscle, the gravity hazard. Shown, not judged, like radiation: no tier, no card on the crew
// board, no part in ship or me, no summary. It only says whether the person's exercise, the
// countermeasure, has kept to its daily target this week.

export interface ExerciseWeek {
  /** Check-ins in the window that logged exercise. */
  logged: number
  onTarget: number
  below: number
  /** Below target on RULES.exerciseLapseDays or more of the logged days in the window. */
  lapse: boolean
}

export function exerciseWeek(history: CheckIn[], day: number): ExerciseWeek {
  const minutes = history
    .filter((c) => c.day <= day && c.day > day - RULES.exerciseWindowDays)
    .map((c) => c.exerciseMin)
    .filter((m): m is number => typeof m === 'number')
  const below = minutes.filter((m) => m < RULES.exerciseTargetMin).length
  return { logged: minutes.length, onTarget: minutes.length - below, below, lapse: below >= RULES.exerciseLapseDays }
}
