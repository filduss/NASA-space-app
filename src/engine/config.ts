// Every number the rules use, in one place. Each is either cited or labeled a demo parameter.
// "Demo parameter" means: chosen by us, not validated on real crews, tested in the backtest.

export const RULES = {
  /** Own-normal window: the most recent N usable check-ins. Demo parameter. */
  baselineWindowDays: 14,
  /** How far back the window may reach to find them. Demo parameter. */
  baselineLookbackDays: 28,
  /** Fewer usable days than this means "no baseline yet". Demo parameter. */
  baselineMinDays: 7,
  /** A reading this many robust spreads from own normal counts as drift. Demo parameter. */
  driftZ: 2.5,

  /** Starting normal: each person's first N check-ins of an indicator. Demo parameter. */
  startNormalDays: 14,
  /**
   * A slow change: own normal has moved this many starting spreads the unwanted way from the starting
   * normal. Checked on mood and stress only. Demo parameter.
   */
  startDriftZ: 2,

  /** Under 6 h of sleep ... (ISS Reaction Self Test study: linked to slower responses, higher stress) */
  shortSleepHours: 6,
  /** ... on 3 or more nights ... */
  shortSleepNights: 3,
  /** ... of the last 7. Window length is a demo parameter. */
  shortSleepWindow: 7,

  /** "Still off on day 3" goes to the flight surgeon. Demo parameter. */
  persistDays: 3,
  /** A missed check-in or two does not restart the count. Demo parameter. */
  episodeGapDays: 2,
  /** After a ship alert ends, the app shows for this many days whether the air and the crew recovered. Demo parameter. */
  followUpDays: 7,

  /**
   * Bone and muscle (shown, not judged): a day's exercise counts as on target from this many minutes. ISS crews
   * exercise about two hours a day (NASA, "Counteracting Bone and Muscle Loss in Microgravity").
   */
  exerciseTargetMin: 120,
  /** Below target on this many of the last `exerciseWindowDays` logged days: the card turns to watch. Demo parameter. */
  exerciseLapseDays: 3,
  exerciseWindowDays: 7,

  /** Cabin's own baseline: median of the most recent N normal days. Demo parameter. */
  cabinBaselineDays: 14,
  cabinLookbackDays: 28,
  cabinMinDays: 5,
  /** Mean CO2 this far above the cabin baseline counts as "above baseline". Demo parameter. */
  cabinMarginMmHg: 0.5,
  /** 1-hour average CO2 limit, mmHg. NASA-STD-3001 Vol 2 [V2 6004]. The ship-or-me rule applies it to the 24 h mean. */
  co2LimitMmHg: 3,

  /** Ship needs at least this share of the crew drifting on CO2-linked indicators. From the plan. */
  crewShare: 0.5,
  /** "Several" people for the shared pattern. From the plan. */
  sharedMin: 2,
} as const

export type Rules = typeof RULES
