import { median } from './baseline.ts'
import { RULES } from './config.ts'
import { CABIN_FACTORS } from './deviation.ts'
import type { Attribution, CabinDay, CabinFactor, CabinStatus, ComfortStatus, Decision, PersonDay } from './types.ts'

/** Temperature or humidity against NASA's comfort range and health limits. */
function comfortStatus(value: number | null, comfort: readonly [number, number], limit: readonly [number, number]): ComfortStatus {
  if (value === null) return { value: null, outside: null, overLimit: false }
  return {
    value,
    outside: value < comfort[0] ? 'low' : value > comfort[1] ? 'high' : null,
    overLimit: value < limit[0] || value > limit[1],
  }
}

/**
 * The cabin today. CO2 against its own baseline (median of the most recent normal days; days already
 * flagged as elevated are left out) and NASA's limit; temperature and humidity against NASA's ranges.
 * All three are 24 h means from the same telemetry, so a day with too few hours of data has none of them.
 */
export function cabinStatus(days: CabinDay[], day: number, elevatedDays: ReadonlySet<number>): CabinStatus {
  const today = days.find((d) => d.day === day)
  const prior = days
    .filter((d) => d.day < day && d.day >= day - RULES.cabinLookbackDays && d.co2Mean !== null)
    .sort((a, b) => b.day - a.day)
  let usable = prior.filter((d) => !elevatedDays.has(d.day))
  if (usable.length < RULES.cabinMinDays) usable = prior
  const baseline =
    usable.length >= RULES.cabinMinDays
      ? median(usable.slice(0, RULES.cabinBaselineDays).map((d) => d.co2Mean as number))
      : null
  const co2Mean = today?.co2Mean ?? null
  const co2Max1h = today?.co2Max1h ?? null
  const delta = co2Mean !== null && baseline !== null ? co2Mean - baseline : null
  const lastData = days.filter((d) => d.day <= day && d.co2Mean !== null).sort((a, b) => b.day - a.day)[0]
  const enough = co2Mean !== null
  const elevated = delta !== null && delta >= RULES.cabinMarginMmHg
  const overLimit = co2Mean !== null && co2Mean > RULES.co2LimitMmHg
  const temp = comfortStatus(enough ? (today?.temp ?? null) : null, RULES.tempComfortC, RULES.tempLimitC)
  const rh = comfortStatus(enough ? (today?.rh ?? null) : null, RULES.rhComfortPct, RULES.rhLimitPct)
  const suspects: CabinFactor[] = []
  if (elevated || overLimit) suspects.push('co2')
  if (temp.outside) suspects.push('temp')
  if (rh.outside) suspects.push('rh')
  return {
    day,
    hasData: co2Mean !== null,
    hours: today?.hours ?? 0,
    co2Mean,
    co2Max1h,
    baseline,
    delta,
    elevated,
    aboveLimit: co2Max1h !== null && co2Max1h > RULES.co2LimitMmHg,
    overLimit,
    lastDataDay: lastData ? lastData.day : null,
    temp,
    rh,
    suspects,
  }
}

/**
 * The ship-or-me rule.
 *   ship   - at least half the crew drift on indicators that a suspect cabin factor could explain:
 *            CO2 above its own baseline or over the 3 mmHg limit (headache, sleep, fatigue, irritability),
 *            temperature outside NASA's comfort range (sleep), humidity outside it (congestion, dry or
 *            sore eyes). The alert names every factor that qualifies.
 *   me     - one person drifts
 *   shared - several drift, but the rule cannot blame the air
 * Mood and stress are never read here: `linkedOff` cannot contain them.
 *
 * The CO2 limit check matters when the air has been high for weeks: by then that level is the cabin's
 * own baseline, but it is still above what NASA allows. In the backtest, the 24 h mean raised fewer
 * false ship alarms than the highest 1-hour average (docs/SPEC.md, "Evidence").
 *
 * Once a ship alert is raised it stays active for as long as a factor behind it (`activeCauses`, the
 * previous day's causes) stays a suspect, so the banner does not flicker while the cause is still there.
 * It is re-checked at every check-in and ends on the first day those factors are back to normal.
 */
export function decideShipOrMe(
  people: PersonDay[],
  cabin: CabinStatus,
  crewSize: number,
  activeCauses: readonly CabinFactor[] = [],
): Decision {
  const checked = people.filter((p) => p.checkedIn)
  const driftingOn = Object.fromEntries(
    CABIN_FACTORS.map((f) => [f, checked.filter((p) => p.linkedOff[f].length > 0).map((p) => p.crewId)]),
  ) as Record<CabinFactor, string[]>
  const driftingAny = checked.filter((p) => p.off.length > 0).map((p) => p.crewId)
  const needed = Math.ceil(crewSize * RULES.crewShare)
  const firing = cabin.suspects.filter((f) => driftingOn[f].length >= needed)
  const holding = cabin.suspects.filter((f) => !firing.includes(f) && activeCauses.includes(f))
  const causes = CABIN_FACTORS.filter((f) => firing.includes(f) || holding.includes(f))
  const blamed = new Set(causes.flatMap((f) => driftingOn[f]))
  let outcome: Decision['outcome'] = 'none'
  if (causes.length > 0) outcome = 'ship'
  else if (driftingAny.length >= RULES.sharedMin) outcome = 'shared'
  else if (driftingAny.length === 1) outcome = 'me'
  return {
    outcome,
    crewSize,
    checkedIn: checked.length,
    driftingCo2: driftingOn.co2,
    driftingAny,
    driftingOn,
    causes,
    driftingShip: checked.filter((p) => blamed.has(p.crewId)).map((p) => p.crewId),
    cabinElevated: cabin.elevated,
    held: firing.length === 0 && holding.length > 0,
    cabinKnown: cabin.hasData && cabin.baseline !== null,
  }
}

/** The likely cause for one person, given the crew-level decision. */
export function attributionFor(person: PersonDay, decision: Decision): Attribution {
  if (!person.checkedIn || person.off.length === 0) return 'none'
  if (decision.outcome === 'ship') return decision.causes.some((f) => person.linkedOff[f].length > 0) ? 'ship' : 'me'
  if (decision.outcome === 'shared') return 'shared'
  return 'me'
}
