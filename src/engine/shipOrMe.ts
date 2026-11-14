import { median } from './baseline.ts'
import { RULES } from './config.ts'
import type { Attribution, CabinDay, CabinStatus, Decision, PersonDay } from './types.ts'

/**
 * Is the cabin's CO2 above its own baseline today?
 * Baseline = median of the most recent normal days; days already flagged as elevated are left out.
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
  return {
    day,
    hasData: co2Mean !== null,
    hours: today?.hours ?? 0,
    co2Mean,
    co2Max1h,
    baseline,
    delta,
    elevated: delta !== null && delta >= RULES.cabinMarginMmHg,
    aboveLimit: co2Max1h !== null && co2Max1h > RULES.co2LimitMmHg,
    overLimit: co2Mean !== null && co2Mean > RULES.co2LimitMmHg,
    lastDataDay: lastData ? lastData.day : null,
  }
}

/**
 * The ship-or-me rule.
 *   ship   - at least half the crew drift on CO2-linked indicators while the air is a suspect: cabin CO2
 *            is above its own baseline, or its 24 h mean is over the 3 mmHg limit
 *   me     - one person drifts
 *   shared - several drift, but the rule cannot blame the air
 * Mood and stress are never read here: `co2LinkedOff` cannot contain them.
 *
 * The limit check matters when the air has been high for weeks: by then that level is the cabin's
 * own baseline, but it is still above what NASA allows. In the backtest, the 24 h mean raised fewer
 * false ship alarms than the highest 1-hour average (docs/SPEC.md, "Evidence").
 *
 * Once a ship alert is raised it stays active (`shipActive`) for as long as the air stays a suspect,
 * so the banner does not flicker while the cause is still there. It is re-checked at every check-in
 * and ends on the first day the cabin is back to normal.
 */
export function decideShipOrMe(
  people: PersonDay[],
  cabin: CabinStatus,
  crewSize: number,
  shipActive = false,
): Decision {
  const checked = people.filter((p) => p.checkedIn)
  const driftingCo2 = checked.filter((p) => p.co2LinkedOff.length > 0).map((p) => p.crewId)
  const driftingAny = checked.filter((p) => p.off.length > 0).map((p) => p.crewId)
  const needed = Math.ceil(crewSize * RULES.crewShare)
  let outcome: Decision['outcome'] = 'none'
  const suspect = cabin.elevated || cabin.overLimit
  const fires = suspect && driftingCo2.length >= needed
  const held = suspect && shipActive
  if (fires || held) outcome = 'ship'
  else if (driftingAny.length >= RULES.sharedMin) outcome = 'shared'
  else if (driftingAny.length === 1) outcome = 'me'
  return {
    outcome,
    crewSize,
    checkedIn: checked.length,
    driftingCo2,
    driftingAny,
    cabinElevated: cabin.elevated,
    held: !fires && held,
    cabinKnown: cabin.hasData && cabin.baseline !== null,
  }
}

/** The likely cause for one person, given the crew-level decision. */
export function attributionFor(person: PersonDay, decision: Decision): Attribution {
  if (!person.checkedIn || person.off.length === 0) return 'none'
  if (decision.outcome === 'ship') return person.co2LinkedOff.length > 0 ? 'ship' : 'me'
  if (decision.outcome === 'shared') return 'shared'
  return 'me'
}
