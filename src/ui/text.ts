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
  return `${spec.offText} your usual ${days(r.daysOff)}`
}

/** The same line for someone else to read (summaries, the crew medical officer). */
export function indicatorLineThird(r: { key: IndicatorKey; daysOff: number }): string {
  if (r.key === 'symptoms') return `Symptoms reported ${r.daysOff > 1 ? `${r.daysOff} days running` : 'today'}`
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

export function mmHg(v: number | null, digits = 1): string {
  return v === null ? 'n/a' : `${v.toFixed(digits)} mmHg`
}

export function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
