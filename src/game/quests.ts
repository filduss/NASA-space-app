import type { CheckIn } from '../engine/types.ts'
import { weekDays } from './streak.ts'

// Crew quests are shared goals. They come from ship alerts or from habits, never from readings
// getting better: a quest is done when the steps are done.

export interface QuestStep {
  id: string
  label: string
}

export interface Quest {
  id: string
  kind: 'ship' | 'habit'
  title: string
  why: string
  steps: QuestStep[]
}

/**
 * The quest a ship alert opens. The steps are illustrative crew actions for the demo,
 * not a flight procedure.
 */
export function clearTheAirQuest(alertStartDay: number): Quest {
  return {
    id: `clear-the-air-${alertStartDay}`,
    kind: 'ship',
    title: 'Clear the air',
    why: 'Cabin CO₂ is above its usual level and several of you feel it. These steps deal with the air, then check that it worked.',
    steps: [
      { id: 'scrubber', label: 'Check the CO₂ removal system status' },
      { id: 'airflow', label: 'Increase airflow between modules' },
      { id: 'exercise', label: 'Move exercise away from the sleep stations' },
      { id: 'recheck', label: 'Agree to re-check at the next check-in' },
    ],
  }
}

export const HABIT_NIGHTS = 5

export interface HabitProgress {
  quest: Quest
  /** Nights logged this week per crew member. */
  nights: Record<string, number>
  /** Crew who have reached the goal. */
  doneCount: number
  done: boolean
}

/** "Everyone logs sleep 5 nights this week." Counts logs, not hours. */
export function sleepLogQuest(week: number, crewIds: string[], checkIns: CheckIn[], upToDay: number): HabitProgress {
  const days = new Set(weekDays(week).filter((d) => d <= upToDay))
  const nights: Record<string, number> = {}
  for (const id of crewIds) nights[id] = 0
  for (const c of checkIns) {
    if (days.has(c.day) && c.crewId in nights) nights[c.crewId] += 1
  }
  const doneCount = crewIds.filter((id) => nights[id] >= HABIT_NIGHTS).length
  return {
    quest: {
      id: `sleep-log-week-${week}`,
      kind: 'habit',
      title: 'Everyone logs sleep 5 nights',
      why: 'Your own normal only exists if you log it. Any night counts, good or bad.',
      steps: [],
    },
    nights,
    doneCount,
    done: doneCount === crewIds.length,
  }
}

/** Who did which step: questId -> stepId -> { crewId, day }. */
export type QuestLog = Record<string, Record<string, { crewId: string; day: number }>>

export function questProgress(quest: Quest, log: QuestLog): { done: number; total: number; complete: boolean } {
  const steps = log[quest.id] ?? {}
  const done = quest.steps.filter((s) => steps[s.id]).length
  return { done, total: quest.steps.length, complete: quest.steps.length > 0 && done === quest.steps.length }
}
