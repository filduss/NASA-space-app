import type { CheckIn, SymptomKey } from '../engine/types.ts'
import type { WearableReading } from '../data/wearable.ts'

// The morning check-in's answers, as plain data, with no React. Every answer starts unset: a rushed
// check-in must never report a rating or "no symptoms" the person did not choose
// (docs/SPEC.md, "Readings of the plan").

export type RatingKey = 'sleepQuality' | 'fatigue' | 'irritability' | 'stress' | 'mood'

export interface Rating {
  key: RatingKey
  question: string
  /** Words under the 0 and the 10. */
  lo: string
  hi: string
}

/** The five ratings, in the order of the form: 0 to 10, as the ISS Reaction Self Test's scales. */
export const RATINGS: Rating[] = [
  { key: 'sleepQuality', question: 'How well did you sleep?', lo: 'Very badly', hi: 'Very well' },
  { key: 'fatigue', question: 'How tired are you?', lo: 'Not at all', hi: 'Exhausted' },
  { key: 'irritability', question: 'How irritable are you?', lo: 'Calm', hi: 'On edge' },
  { key: 'stress', question: 'How stressed are you?', lo: 'Not at all', hi: 'Very stressed' },
  { key: 'mood', question: 'How is your mood?', lo: 'Very low', hi: 'Very good' },
]

export interface CheckInForm {
  ratings: Record<RatingKey, number | null>
  /** Null until answered; an empty list is an explicit "None today". */
  symptoms: SymptomKey[] | null
}

/** A new form, or today's live check-in reopened to change it. The simulator's record never pre-fills it. */
export function formFrom(existing: CheckIn | undefined): CheckInForm {
  const live = existing && !existing.simulated ? existing : undefined
  const ratings = {} as CheckInForm['ratings']
  for (const r of RATINGS) ratings[r.key] = live ? live[r.key] : null
  return { ratings, symptoms: live ? [...live.symptoms] : null }
}

/** How many answers are still missing: one per unset rating, one for the symptoms. */
export function left(f: CheckInForm): number {
  return RATINGS.filter((r) => f.ratings[r.key] === null).length + (f.symptoms === null ? 1 : 0)
}

export function rate(f: CheckInForm, key: RatingKey, value: number): CheckInForm {
  return { ...f, ratings: { ...f.ratings, [key]: value } }
}

/**
 * Ticks or unticks a symptom, which also clears "None today". Unticking the last one leaves the
 * question unanswered: "none" is only ever chosen, never reached by accident.
 */
export function toggleSymptom(f: CheckInForm, key: SymptomKey): CheckInForm {
  const cur = f.symptoms ?? []
  const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
  return { ...f, symptoms: next.length > 0 ? next : null }
}

/** "None today": an explicit answer, never the default. */
export function noSymptoms(f: CheckInForm): CheckInForm {
  return { ...f, symptoms: [] }
}

/**
 * The check-in to send, or null while anything is unanswered. Sleep, exercise and vitals come from the
 * wearable, never from the form; the live reaction time is never stored.
 */
export function toCheckIn(f: CheckInForm, ctx: { crewId: string; day: number; wearable: WearableReading | null }): CheckIn | null {
  if (left(f) > 0 || f.symptoms === null) return null
  const r = f.ratings as Record<RatingKey, number>
  return {
    crewId: ctx.crewId,
    day: ctx.day,
    sleepHours: ctx.wearable?.sleepHours ?? null,
    exerciseMin: ctx.wearable?.exerciseMin ?? null,
    watch: ctx.wearable?.vitals ?? null,
    sleepQuality: r.sleepQuality,
    fatigue: r.fatigue,
    irritability: r.irritability,
    stress: r.stress,
    mood: r.mood,
    symptoms: f.symptoms,
    reactionMs: null,
    simulated: false,
  }
}
