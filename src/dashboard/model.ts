// Turns one person's engine result into what the personal dashboard draws: the status box
// ("Ship or me": likely the ship or not), a level per body zone, vital tiles, and the notifications for
// the day. No new rules live here; every level comes from the engine's own output (drift, days
// off, tier, attribution, exercise lapse) or the cabin CO2 limit.

import { RULES } from '../engine/config.ts'
import { SPEC } from '../engine/deviation.ts'
import type { ExerciseWeek } from '../engine/gravity.ts'
import type { CabinStatus, CheckIn, ComfortStatus, IndicatorKey, PersonStatus, SymptomKey } from '../engine/types.ts'
import { celsius, comfortLine, delayText, indicatorLine, rhPercent, symptomLabel } from '../ui/text.ts'

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

/** Cabin CO2: mean above the 3 mmHg limit is red; above its own usual or a 1-hour peak over the limit is orange. */
export function cabinLevel(c: Pick<CabinStatus, 'hasData' | 'co2Mean' | 'elevated' | 'aboveLimit'>): Level {
  if (!c.hasData) return 'ok'
  if (c.co2Mean !== null && c.co2Mean > RULES.co2LimitMmHg) return 'alert'
  if (c.elevated || c.aboveLimit) return 'watch'
  return 'ok'
}

/** Cabin temperature and humidity: outside NASA's health limits is red, outside its comfort range orange. */
export function airLevel(c: Pick<CabinStatus, 'temp' | 'rh'>): Level {
  return worst(comfortLevel(c.temp), comfortLevel(c.rh))
}

/** One of temperature or humidity: outside NASA's health limits is red, outside its comfort range orange. */
export function comfortLevel(s: ComfortStatus): Level {
  if (s.overLimit) return 'alert'
  if (s.outside) return 'watch'
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

export function zoneStates(me: PersonStatus, exercise?: ExerciseWeek): Record<ZoneKey, ZoneState> {
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
  if (me.conference === 'urgent') raise('head', 'alert', 'Asked for an urgent conference')
  if (exercise?.lapse) {
    raise('core', 'watch', exerciseWhy(exercise))
    raise('limbs', 'watch', exerciseWhy(exercise))
  }
  // The cabin air is not drawn on the body: the zones only ever mean the person. The air has its
  // own row in the status box (`verdict`).
  return out
}

/** One side of the status box: the person's readings, or the cabin air. */
export interface VerdictSide {
  level: Level
  detail: string
}

/** The cabin CO₂ side of the ship check. `known` is false on a day with no usable reading. */
export interface Co2Side extends VerdictSide {
  known: boolean
}

/**
 * The status box: a ship check. It answers one question, likely the ship or not, and always with
 * the ship as the subject, so the person is never the suspect. Only reads the engine's attribution
 * and decision; the colour follows the side the answer points at, so a box that says you are fine
 * is never orange or red because of the air. Conference requests and tiers are not part of it.
 */
export interface Verdict {
  tint: Level
  title: string
  you: VerdictSide
  /** The cabin as a whole (CO₂, temperature, humidity): its level decides the headline and colour. */
  ship: VerdictSide
  /** The one cabin chip the box shows. */
  co2: Co2Side
}

/** Your own readings against your normal. Exercise and the cabin are left out. */
export function youLevel(me: PersonStatus): Level {
  const a = me.assessment
  if (me.tier === 4) return 'alert'
  return worst(...a.off.map((k) => indicatorLevel(me, k)))
}

function youDetail(me: PersonStatus, level: Level): string {
  const a = me.assessment
  // An urgent conference request can come before the check-in, so it is checked first.
  if (me.conference === 'urgent') return 'You asked for an urgent conference'
  if (!a.checkedIn) return 'No check-in yet today'
  if (a.off.length === 0) return 'Within your normal'
  const names = a.off.flatMap((k) => (k === 'symptoms' ? a.symptoms.map(symptomLabel) : [SPEC[k].label]))
  const what = `${names.join(', ')} off your usual`
  return level === 'alert' && me.episodeDay > 1 ? `${what}, day ${me.episodeDay}` : what
}

function shipDetail(cabin: CabinStatus): string {
  if (!cabin.hasData || cabin.co2Mean === null) return 'No cabin data today'
  const mean = `CO₂ ${cabin.co2Mean.toFixed(1)} mmHg`
  if (cabin.co2Mean > RULES.co2LimitMmHg) return `${mean}, over the ${RULES.co2LimitMmHg} mmHg limit`
  if (cabin.elevated) return cabin.baseline !== null ? `${mean}, usual ${cabin.baseline.toFixed(1)}` : `${mean}, above its usual`
  const off = (['temp', 'rh'] as const).find((f) => cabin[f].outside)
  if (off) return `${off === 'temp' ? 'Temperature' : 'Humidity'} ${comfortLine(off, cabin[off])}`
  if (cabin.aboveLimit) return `1-hour peak ${cabin.co2Max1h?.toFixed(1)} mmHg, daily average normal`
  return `${mean}, ${celsius(cabin.temp.value)}, ${rhPercent(cabin.rh.value)} humidity: all at their usual levels`
}

function co2Detail(cabin: CabinStatus): string {
  if (cabin.co2Mean === null) return 'No usable CO₂ reading today'
  const mean = `${cabin.co2Mean.toFixed(1)} mmHg over 24 h`
  if (cabin.co2Mean > RULES.co2LimitMmHg) return `${mean}, over NASA's ${RULES.co2LimitMmHg} mmHg limit`
  if (cabin.elevated) return cabin.baseline !== null ? `${mean}, usual ${cabin.baseline.toFixed(1)}` : `${mean}, above its usual`
  if (cabin.aboveLimit) return `${mean}; a 1-hour peak of ${cabin.co2Max1h?.toFixed(1)} mmHg`
  return `${mean}, at its usual level`
}

/** The ship check. */
export function verdict(me: PersonStatus, cabin: CabinStatus): Verdict {
  const a = me.assessment
  const you: VerdictSide = { level: youLevel(me), detail: '' }
  you.detail = youDetail(me, you.level)
  // Cabin CO2, temperature and humidity: orange or red as on the crew app (cabinLevel, airLevel).
  const ship: VerdictSide = { level: worst(cabinLevel(cabin), airLevel(cabin)), detail: shipDetail(cabin) }
  const co2: Co2Side = { level: cabinLevel(cabin), detail: co2Detail(cabin), known: cabin.hasData && cabin.co2Mean !== null }
  const pick = (tint: Level, title: string): Verdict => ({ tint, title, you, ship, co2 })

  if (!a.checkedIn) return pick(you.level, 'Check in to check the ship')
  if (me.attribution === 'ship') return pick(worst(ship.level, 'watch'), 'Likely the ship, not you')
  // Without cabin data the rule could not check the air, so the box does not say "not the ship".
  if (!cabin.hasData) return pick(you.level, me.attribution === 'none' ? "You're within your normal" : 'No cabin data to check')
  if (me.attribution === 'me' || me.attribution === 'shared') return pick(you.level, 'Likely not the ship')
  if (ship.level !== 'ok') return pick(you.level, "You're within your normal")
  return pick(you.level, 'All good')
}

/** Where a notification comes from: your readings, the cabin air, or your exercise. */
export type NoticeSource = 'you' | 'air' | 'exercise'

export interface Notice {
  id: string
  source: NoticeSource
  level: Level
  title: string
  body: string
}

export function notices(me: PersonStatus, cabin: CabinStatus, delaySec: number, exercise?: ExerciseWeek): Notice[] {
  const out: Notice[] = []
  const a = me.assessment
  if (me.conference === 'urgent') {
    out.push({ id: 'urgent', source: 'you', level: 'alert', title: 'Urgent request sent', body: `Your crew medical officer was told privately. Your request to the flight surgeon: ${delayText(delaySec)} to Earth.` })
  } else if (me.conference === 'routine') {
    out.push({ id: 'conference', source: 'you', level: 'ok', title: 'Conference requested', body: `Your flight surgeon gets the request in ${delayText(delaySec)} and will take it at the next scheduled conference.` })
  }
  // A ship episode's day 3 sends a cabin summary, not one of this person's readings (engine/escalation.ts).
  if (me.tier === 3 && me.attribution !== 'ship') {
    out.push({
      id: 'surgeon',
      source: 'you',
      level: 'alert',
      title: `Day ${me.episodeDay} — flight surgeon informed`,
      body: 'This has stayed off your usual for 3 days, so a short summary went to the flight surgeon. No diagnosis, only what changed.',
    })
  }
  const cl = cabinLevel(cabin)
  if (cl === 'alert' && cabin.co2Mean !== null) {
    out.push({
      id: 'co2',
      source: 'air',
      level: 'alert',
      title: 'Cabin CO₂ above the limit',
      body: `Average ${cabin.co2Mean.toFixed(1)} mmHg over the last 24 h, limit ${RULES.co2LimitMmHg} mmHg.`,
    })
  } else if (cl === 'watch') {
    out.push({
      id: 'co2',
      source: 'air',
      level: 'watch',
      title: cabin.elevated ? 'Cabin CO₂ above its usual level' : 'Short CO₂ peak',
      body: cabin.elevated
        ? `Average ${cabin.co2Mean?.toFixed(1)} mmHg, usual ${cabin.baseline?.toFixed(1)} mmHg.`
        : `One hour reached ${cabin.co2Max1h?.toFixed(1)} mmHg (limit ${RULES.co2LimitMmHg}). The daily average is normal.`,
    })
  }
  for (const f of ['temp', 'rh'] as const) {
    const st = cabin[f]
    if (!st.outside) continue
    const word = f === 'temp' ? (st.outside === 'low' ? 'cooler' : 'warmer') : st.outside === 'low' ? 'drier' : 'more humid'
    out.push({
      id: f,
      source: 'air',
      level: st.overLimit ? 'alert' : 'watch',
      title: `Cabin ${word} than NASA's comfort range`,
      body: `${f === 'temp' ? 'Temperature' : 'Humidity'} ${comfortLine(f, st)}.`,
    })
  }
  for (const key of a.off) {
    out.push({
      id: `ind-${key}`,
      source: 'you',
      level: indicatorLevel(me, key),
      title: key === 'symptoms' ? 'Symptoms reported' : SPEC[key].label,
      body: indicatorLine(a.indicators[key], a.symptoms),
    })
  }
  if (exercise?.lapse) {
    out.push({
      id: 'exercise',
      source: 'exercise',
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
