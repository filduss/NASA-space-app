// Weekly streak: a week counts when 5 of its 7 days are covered.
// Shields cover days when a check-in is not reasonable: spacewalks, comm blackouts, heavy workload.
// Nothing here looks at readings; a streak of check-ins is not a streak of good days.

export const DAYS_PER_WEEK = 7
export const DAYS_NEEDED = 5

export type ShieldKind = 'eva' | 'comm_blackout' | 'heavy_workload'

/** Mission weeks: days 1-7 are week 0, 8-14 week 1, and so on. */
export function weekOf(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_WEEK)
}

export function weekDays(week: number): number[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => week * DAYS_PER_WEEK + 1 + i)
}

export interface WeekProgress {
  week: number
  checkIns: number
  /** Shielded days without a check-in (a day is never counted twice). */
  shields: number
  covered: number
  kept: boolean
}

export function weekProgress(
  checkInDays: ReadonlySet<number>,
  shieldDays: ReadonlySet<number>,
  week: number,
  upToDay = Infinity,
): WeekProgress {
  let checkIns = 0
  let shields = 0
  for (const d of weekDays(week)) {
    if (d > upToDay) break
    if (checkInDays.has(d)) checkIns += 1
    else if (shieldDays.has(d)) shields += 1
  }
  const covered = checkIns + shields
  return { week, checkIns, shields, covered, kept: covered >= DAYS_NEEDED }
}

export interface Streak {
  /** Consecutive kept weeks, including this week once it is kept. */
  weeks: number
  thisWeek: WeekProgress
  /** Days still to come this week, today not included. */
  daysLeft: number
}

export function weeklyStreak(
  checkInDays: ReadonlySet<number>,
  shieldDays: ReadonlySet<number>,
  today: number,
  firstDay = 1,
): Streak {
  const current = weekOf(today)
  const thisWeek = weekProgress(checkInDays, shieldDays, current, today)
  let weeks = thisWeek.kept ? 1 : 0
  for (let w = current - 1; w >= weekOf(firstDay); w--) {
    if (!weekProgress(checkInDays, shieldDays, w).kept) break
    weeks += 1
  }
  const daysLeft = weekDays(current).filter((d) => d > today).length
  return { weeks, thisWeek, daysLeft }
}
