import type { BacktestFile } from '../data/types.ts'
import { RULES } from '../engine/config.ts'
import { SPEC, SYMPTOMS } from '../engine/deviation.ts'
import type { IndicatorKey, IndicatorResult, SymptomKey } from '../engine/types.ts'

// All wording lives here. Cards say what was measured against the person's own normal
// ("below your usual for 4 days"), say "likely", and never name a diagnosis.

export function symptomLabel(s: string): string {
  return SYMPTOMS.find((x) => x.key === (s as SymptomKey))?.label ?? s
}

export function days(n: number): string {
  return n === 1 ? 'today' : `for ${n} days`
}

export function fmt(key: IndicatorKey, value: number | null): string {
  if (value === null) return 'n/a'
  switch (key) {
    case 'sleepHours':
      return `${value.toFixed(1)} h`
    case 'reaction':
      return `${Math.round(1000 / value)} ms`
    case 'symptoms':
      return `${value}`
    default:
      return `${Math.round(value * 10) / 10}/10`
  }
}

/** One line for a card, in the second person. */
export function indicatorLine(r: IndicatorResult, symptoms: string[] = []): string {
  const spec = SPEC[r.key]
  if (r.reason === 'symptom') {
    const list = symptoms.map(symptomLabel).join(', ') || 'Symptoms'
    return `${list} reported ${r.daysOff > 1 ? `${r.daysOff} days running` : 'today'}`
  }
  if (r.reason === 'short_sleep') {
    return `Under ${RULES.shortSleepHours} h of sleep on ${RULES.shortSleepNights} or more of the last ${RULES.shortSleepWindow} nights`
  }
  if (r.reason === 'below_start' && r.start && r.baseline) {
    return `Your usual ${spec.label.toLowerCase()} has ${slowly(r.key, r.start.median, r.baseline.median)} since your first ${RULES.startNormalDays} check-ins`
  }
  return `${spec.offText} your usual ${days(r.daysOff)}`
}

/** "slipped from 7/10 to 5/10" or "risen from 3/10 to 5/10", in the indicator's unwanted direction. */
function slowly(key: IndicatorKey, start: number, now: number): string {
  return `${SPEC[key].direction === 'lowBad' ? 'slipped' : 'risen'} from ${fmt(key, start)} to ${fmt(key, now)}`
}

/** The same line for someone else to read (summaries, the crew medical officer). */
export function indicatorLineThird(r: { key: IndicatorKey; daysOff: number; start?: number | null; usual?: number | null }): string {
  if (r.key === 'symptoms') return `Symptoms reported ${r.daysOff > 1 ? `${r.daysOff} days running` : 'today'}`
  if (r.start != null && r.usual != null) {
    return `${SPEC[r.key].label}: own usual has ${slowly(r.key, r.start, r.usual)} since the first ${RULES.startNormalDays} check-ins`
  }
  return `${SPEC[r.key].offText} own usual ${days(r.daysOff)}`
}

/** Short words for the crew board, grouped so a body shows a few plain labels. */
export function boardWords(off: IndicatorKey[], symptoms: string[]): { zone: 'head' | 'sleep' | 'body' | 'hands'; word: string }[] {
  const out: { zone: 'head' | 'sleep' | 'body' | 'hands'; word: string }[] = []
  if (off.includes('symptoms')) out.push({ zone: 'head', word: symptoms.map(symptomLabel).join(', ') || 'Symptoms' })
  if (off.includes('sleepHours') || off.includes('sleepQuality')) out.push({ zone: 'sleep', word: 'Poor sleep' })
  if (off.includes('fatigue')) out.push({ zone: 'body', word: 'Fatigue' })
  if (off.includes('irritability')) out.push({ zone: 'body', word: 'Irritable' })
  if (off.includes('reaction')) out.push({ zone: 'hands', word: 'Slower responses' })
  return out
}

/** One-way signal delay in words: "less than a second", "1.3 seconds", "12 minutes". */
export function delayText(sec: number): string {
  if (sec < 1) return 'less than a second'
  if (sec < 60) return `${sec.toFixed(1)} seconds`
  const min = Math.round(sec / 60)
  return `${min} minute${min === 1 ? '' : 's'}`
}

/** Radiation dose: one decimal under 10 mSv, whole numbers above. */
export function mSv(v: number): string {
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} mSv`
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

export function mmHg(v: number | null, digits = 1): string {
  return v === null ? 'n/a' : `${v.toFixed(digits)} mmHg`
}

/** The rule's track record in one line, for the Ship screen: the backtest's base case. Null without the file. */
export function evidenceLine(bt: BacktestFile | null): string | null {
  const base = bt?.scenarios[0]
  if (!bt || !base || base.shipOrMeAccuracy === null) return null
  const every = base.falseAlarms.shipPerCrewDay > 0 ? Math.round(1 / base.falseAlarms.shipPerCrewDay) : null
  return (
    `Tested on ${bt.meta.crews} simulated crews over ${Object.keys(bt.meta.traces).length} real ISS CO₂ traces: ` +
    `the rule named the right cause in ${percent(base.shipOrMeAccuracy)} of alerts` +
    (every ? `, and raised a ship alert with no CO₂ rise behind it about once every ${every} crew-days.` : '.')
  )
}

export function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
