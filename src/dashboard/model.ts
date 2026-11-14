// Turns one person's engine result into what the personal dashboard draws: a level per body
// zone, vital tiles, and the notifications for the day. No new rules live here; every level
// comes from the engine's own output (drift, days off, tier, exercise lapse) or the cabin CO2 limit.

import { RULES } from '../engine/config.ts'
import { SPEC } from '../engine/deviation.ts'
import type { ExerciseWeek } from '../engine/gravity.ts'
import type { CabinStatus, CheckIn, IndicatorKey, PersonStatus, SymptomKey } from '../engine/types.ts'
import { delayText, indicatorLine, symptomLabel } from '../ui/text.ts'

/** ok = within own normal, watch = orange, alert = red. */
export type Level = 'ok' | 'watch' | 'alert'
export type ZoneKey = 'head' | 'chest' | 'core' | 'limbs'

export interface ZoneSpec {
  key: ZoneKey
  label: string
  bones: string[]
  /** Model-space point the floating label points at (from skeleton/bones.json centres). */
  anchor: [number, number, number]
}

export const ZONES: ZoneSpec[] = [
  { key: 'head', label: 'Head & sleep', bones: ['skull', 'mandible', 'teeth', 'spine_cervical'], anchor: [0.06, 1.66, 0.02] },
  {
    key: 'chest',
    label: 'Breathing',
    bones: ['ribs_l', 'ribs_r', 'sternum', 'spine_thoracic', 'clavicle_l', 'clavicle_r', 'scapula_l', 'scapula_r'],
    anchor: [0.11, 1.3, 0.04],
  },
  { key: 'core', label: 'Core', bones: ['spine_lumbar', 'pelvis'], anchor: [0.12, 0.98, 0] },
  {
    key: 'limbs',
    label: 'Muscles & energy',
    bones: [
      'humerus_l', 'humerus_r', 'forearm_l', 'forearm_r', 'hand_l', 'hand_r',
      'femur_l', 'femur_r', 'patella_l', 'patella_r', 'lower_leg_l', 'lower_leg_r', 'foot_l', 'foot_r',
    ],
    anchor: [-0.1, 0.62, 0],
  },
]

export const ZONE_OF_BONE: Record<string, ZoneKey> = Object.fromEntries(ZONES.flatMap((z) => z.bones.map((b) => [b, z.key])))

const INDICATOR_ZONE: Record<Exclude<IndicatorKey, 'symptoms'>, ZoneKey> = {
  sleepHours: 'head',
  sleepQuality: 'head',
  reaction: 'head',
  irritability: 'head',
  stress: 'head',
  mood: 'head',
  fatigue: 'limbs',
}
const SYMPTOM_ZONE: Record<SymptomKey, ZoneKey> = {
  headache: 'head',
  dizziness: 'head',
  eye_strain: 'head',
  congestion: 'chest',
  nausea: 'core',
}

export const RANK: Record<Level, number> = { ok: 0, watch: 1, alert: 2 }
export const worst = (...ls: Level[]): Level => ls.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok')

export interface ZoneState {
  level: Level
  reasons: string[]
}

/** Cabin air: mean above the 3 mmHg limit is red; above its own usual or a 1-hour peak over the limit is orange. */
export function cabinLevel(c: Pick<CabinStatus, 'hasData' | 'co2Mean' | 'elevated' | 'aboveLimit'>): Level {
  if (!c.hasData) return 'ok'
  if (c.co2Mean !== null && c.co2Mean > RULES.co2LimitMmHg) return 'alert'
  if (c.elevated || c.aboveLimit) return 'watch'
  return 'ok'
}

/** An indicator is orange the day it drifts; red once it has stayed off to day 3 or the person reached tier 3. */
export function indicatorLevel(me: PersonStatus, key: IndicatorKey): Level {
  const r = me.assessment.indicators[key]
  if (!r.off) return 'ok'
  if (r.daysOff >= RULES.persistDays || me.tier >= 3) return 'alert'
  return 'watch'
}

/** Exercise below target on enough days of the week (engine/gravity.ts): the hip and spine, and the muscles. */
function exerciseWhy(w: ExerciseWeek): string {
  return `Exercise below target, ${w.below} of ${w.logged} days`
}

export function zoneStates(me: PersonStatus, cabin: CabinStatus, exercise?: ExerciseWeek): Record<ZoneKey, ZoneState> {
  const out: Record<ZoneKey, ZoneState> = {
    head: { level: 'ok', reasons: [] },
    chest: { level: 'ok', reasons: [] },
    core: { level: 'ok', reasons: [] },
    limbs: { level: 'ok', reasons: [] },
  }
  const raise = (z: ZoneKey, l: Level, why: string) => {
    out[z].level = worst(out[z].level, l)
    out[z].reasons.push(why)
  }
  const a = me.assessment
  for (const key of a.off) {
    const l = indicatorLevel(me, key)
    if (key === 'symptoms') {
      for (const s of a.symptoms) raise(SYMPTOM_ZONE[s], l, symptomLabel(s))
    } else {
      raise(INDICATOR_ZONE[key], l, SPEC[key].label)
    }
  }
  if (a.safety) raise('head', 'alert', 'Asked to talk to someone')
  if (exercise?.lapse) {
    raise('core', 'watch', exerciseWhy(exercise))
    raise('limbs', 'watch', exerciseWhy(exercise))
  }
  const cl = cabinLevel(cabin)
  if (cl !== 'ok') {
    const peakOnly = !cabin.elevated && (cabin.co2Mean ?? 0) <= RULES.co2LimitMmHg
    raise('chest', cl, peakOnly ? `CO₂ peak ${cabin.co2Max1h?.toFixed(1)} mmHg` : `Cabin CO₂ ${cabin.co2Mean?.toFixed(1)} mmHg`)
  }
  return out
}

export interface Notice {
  id: string
  level: Level
  title: string
  body: string
}

export function notices(me: PersonStatus, cabin: CabinStatus, delaySec: number, exercise?: ExerciseWeek): Notice[] {
  const out: Notice[] = []
  const a = me.assessment
  if (a.safety) {
    out.push({ id: 'safety', level: 'alert', title: 'Help is on the way', body: `Your crew medical officer was told privately. Message to the flight surgeon: ${delayText(delaySec)} to Earth.` })
  }
  if (me.tier === 3) {
    out.push({
      id: 'surgeon',
      level: 'alert',
      title: `Day ${me.episodeDay} — flight surgeon informed`,
      body: 'This has stayed off your usual for 3 days, so a short summary went to the flight surgeon. No diagnosis, only what changed.',
    })
  }
  const cl = cabinLevel(cabin)
  if (cl === 'alert' && cabin.co2Mean !== null) {
    out.push({
      id: 'co2',
      level: 'alert',
      title: 'Cabin CO₂ above the limit',
      body: `Average ${cabin.co2Mean.toFixed(1)} mmHg over the last 24 h, limit ${RULES.co2LimitMmHg} mmHg. Likely the ship, not you.`,
    })
  } else if (cl === 'watch') {
    out.push({
      id: 'co2',
      level: 'watch',
      title: cabin.elevated ? 'Cabin CO₂ above its usual level' : 'Short CO₂ peak',
      body: cabin.elevated
        ? `Average ${cabin.co2Mean?.toFixed(1)} mmHg, usual ${cabin.baseline?.toFixed(1)} mmHg.`
        : `One hour reached ${cabin.co2Max1h?.toFixed(1)} mmHg (limit ${RULES.co2LimitMmHg}). The daily average is normal.`,
    })
  }
  for (const key of a.off) {
    out.push({
      id: `ind-${key}`,
      level: indicatorLevel(me, key),
      title: key === 'symptoms' ? 'Symptoms reported' : SPEC[key].label,
      body: indicatorLine(a.indicators[key], a.symptoms),
    })
  }
  if (me.attribution === 'ship' && a.off.length > 0) {
    out.push({ id: 'ship', level: 'watch', title: 'Likely the ship, not you', body: 'Most of the crew show the same change while cabin CO₂ is up.' })
  }
  if (exercise?.lapse) {
    out.push({
      id: 'exercise',
      level: 'watch',
      title: 'Exercise below target',
      body: `Under ${RULES.exerciseTargetMin} min on ${exercise.below} of your last ${exercise.logged} logged days. Exercise is what protects bone and muscle here.`,
    })
  }
  return out.sort((x, y) => RANK[y.level] - RANK[x.level])
}

export interface Vital {
  key: IndicatorKey
  label: string
  value: string
  unit: string
  usual: string | null
  level: Level
  /** Trend, oldest first, in display units (null = no check-in that day). */
  series: { day: number; v: number | null }[]
  /** The direction that is unwanted, for the hint under the value. */
  direction: 'lowBad' | 'highBad'
}

const VITAL_KEYS: IndicatorKey[] = ['sleepHours', 'sleepQuality', 'reaction', 'fatigue', 'mood', 'stress', 'irritability']

function display(key: IndicatorKey, v: number): number {
  return key === 'reaction' ? 1000 / v : v
}

function raw(key: IndicatorKey, c: CheckIn): number | null {
  switch (key) {
    case 'reaction':
      return c.reactionMs
    case 'symptoms':
      return c.symptoms.length
    default:
      return c[key]
  }
}

export function vitals(me: PersonStatus, history: CheckIn[], today: number, span: number): Vital[] {
  const byDay = new Map(history.map((c) => [c.day, c]))
  const todayCheck = byDay.get(today)
  return VITAL_KEYS.map((key) => {
    const spec = SPEC[key]
    const r = me.assessment.indicators[key]
    const series: { day: number; v: number | null }[] = []
    for (let d = today - span + 1; d <= today; d++) {
      const c = byDay.get(d)
      series.push({ day: d, v: c ? raw(key, c) : null })
    }
    const now = todayCheck ? raw(key, todayCheck) : null
    const usual = r.baseline ? display(key, r.baseline.median) : null
    const unit = key === 'reaction' ? 'ms' : key === 'sleepHours' ? 'h' : '/10'
    const f = (v: number) => (key === 'reaction' ? `${Math.round(v)}` : key === 'sleepHours' ? v.toFixed(1) : `${Math.round(v * 10) / 10}`)
    return {
      key,
      label: key === 'reaction' ? 'Reaction time' : spec.label,
      value: now === null ? '–' : f(now),
      unit,
      usual: usual === null ? null : f(usual),
      level: indicatorLevel(me, key),
      series,
      direction: key === 'reaction' ? 'highBad' : spec.direction,
    }
  })
}
