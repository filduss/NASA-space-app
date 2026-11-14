import { RULES } from './config.ts'
import type { Baseline } from './types.ts'

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Median absolute deviation around `center`. */
export function mad(xs: number[], center: number): number {
  return median(xs.map((x) => Math.abs(x - center)))
}

/**
 * A robust "own normal": median and spread (1.4826 x MAD, the normal-consistent scale).
 * The spread is floored at `minSpread` so that slider rounding cannot produce a zero-width band.
 */
export function robustBaseline(values: number[], minSpread: number): Baseline | null {
  if (values.length === 0) return null
  const m = median(values)
  const spread = Math.max(1.4826 * mad(values, m), minSpread)
  return { median: m, spread, n: values.length }
}

export interface Sample {
  day: number
  value: number
  /** Days already judged off are left out, so a bad stretch does not become the new normal. */
  excluded?: boolean
}

export interface BaselineOptions {
  window?: number
  lookback?: number
  minN?: number
  minSpread: number
}

/**
 * The starting normal: median and spread of the first `n` samples. It exists only once all `n` are
 * before `day`, so a result never depends on today or later. A slow change is judged against it,
 * because a decline too slow to jump out on any one day becomes the rolling normal.
 */
export function startingBaseline(samples: Sample[], day: number, n: number, minSpread: number): Baseline | null {
  const first = samples
    .filter((s) => Number.isFinite(s.value))
    .sort((a, b) => a.day - b.day)
    .slice(0, n)
  if (first.length < n || first[n - 1].day >= day) return null
  return robustBaseline(
    first.map((s) => s.value),
    minSpread,
  )
}

/**
 * Baseline for `day` from earlier samples only: the most recent `window` usable samples
 * within `lookback` days. Falls back to including excluded days when too few remain,
 * and returns null when there is still not enough history.
 */
export function trailingBaseline(samples: Sample[], day: number, opts: BaselineOptions): Baseline | null {
  const window = opts.window ?? RULES.baselineWindowDays
  const lookback = opts.lookback ?? RULES.baselineLookbackDays
  const minN = opts.minN ?? RULES.baselineMinDays
  const prior = samples
    .filter((s) => s.day < day && s.day >= day - lookback && Number.isFinite(s.value))
    .sort((a, b) => b.day - a.day)
  let usable = prior.filter((s) => !s.excluded)
  if (usable.length < minN) usable = prior
  if (usable.length < minN) return null
  return robustBaseline(
    usable.slice(0, window).map((s) => s.value),
    opts.minSpread,
  )
}
