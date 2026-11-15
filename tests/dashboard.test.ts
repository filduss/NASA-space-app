import { describe, expect, it } from 'vitest'
import { cabinLevel, notices, verdict, zoneStates } from '../src/dashboard/model.ts'
import { runEngine, type CheckIn, type ConferenceRequest, type DayResult } from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

// The personal dashboard's status box, the ship check: it answers likely the ship or not, always
// with the ship as the subject. The colour follows the side the answer points at, so a box that
// says you are fine is never orange or red because of the air.
const LAST = 20

function run(co2: Record<number, number | null>, change: (all: CheckIn[]) => CheckIn[] = (x) => x, requests: ConferenceRequest[] = []): DayResult[] {
  const checkIns = change(CREW.flatMap((id) => steady(id, 1, LAST)))
  return runEngine({ crewIds: CREW, checkIns, cabin: cabin(1, LAST, 2.4, co2), fromDay: 1, toDay: LAST, requests })
}
function today(co2Today: number | null | undefined, change?: (all: CheckIn[]) => CheckIn[], requests?: ConferenceRequest[]) {
  return run(co2Today === undefined ? {} : { [LAST]: co2Today }, change, requests).at(-1)!
}
function box(results: DayResult[], id: string) {
  const r = results.at(-1)!
  return verdict(r.people[id], r.cabin)
}
const shortSleep = (ids: string[], days = [LAST]) => (all: CheckIn[]) =>
  all.map((c) => (days.includes(c.day) && ids.includes(c.crewId) ? checkIn(c.crewId, c.day, { sleepHours: 4, sleepQuality: 3 }) : c))
const LAST3 = [LAST - 2, LAST - 1, LAST]

describe('dashboard status box: the ship check', () => {
  it('steady while the air is up: the box is green, the CO₂ check carries the colour', () => {
    const r = today(2.95)
    const v = verdict(r.people.anna, r.cabin)
    expect(r.cabin.elevated).toBe(true)
    expect(v.tint).toBe('ok')
    expect(v.you.level).toBe('ok')
    expect(v.ship.level).toBe('watch')
    expect(v.co2).toMatchObject({ level: 'watch', known: true })
    expect(v.title).toBe("You're within your normal")
  })

  it('nothing off and the air at its usual: all good', () => {
    const r = today(undefined)
    expect(verdict(r.people.anna, r.cabin)).toMatchObject({ tint: 'ok', title: 'All good' })
  })

  it('most of the crew changed while the air is up: likely the ship, coloured by the air', () => {
    const r = today(3.6, shortSleep(CREW))
    const v = verdict(r.people.anna, r.cabin)
    expect(r.people.anna.attribution).toBe('ship')
    expect(v.title).toBe('Likely the ship, not you')
    expect(v.tint).toBe(cabinLevel(r.cabin))
    expect(v.you.level).toBe('watch')
  })

  it('one person changed while the air is usual: likely not the ship', () => {
    const r = today(undefined, shortSleep(['chen']))
    const v = verdict(r.people.chen, r.cabin)
    expect(r.people.chen.attribution).toBe('me')
    expect(v.title).toBe('Likely not the ship')
    expect(v.tint).toBe('watch')
    expect(v.ship.level).toBe('ok')
  })

  it('one person changed while the air is up: still likely not the ship', () => {
    const r = today(3.6, shortSleep(['chen']))
    expect(r.people.chen.attribution).toBe('me')
    expect(verdict(r.people.chen, r.cabin).title).toBe('Likely not the ship')
  })

  it('several changed and the air is usual: the same answer, with no line about the others', () => {
    const r = today(undefined, shortSleep(['anna', 'chen']))
    const v = verdict(r.people.chen, r.cabin)
    expect(r.people.chen.attribution).toBe('shared')
    expect(v.title).toBe('Likely not the ship')
  })

  it('no check-in today: the box asks for one', () => {
    const r = today(undefined, (all) => all.filter((c) => !(c.crewId === 'chen' && c.day === LAST)))
    expect(verdict(r.people.chen, r.cabin)).toMatchObject({ title: 'Check in to check the ship' })
  })

  it('no cabin data: the box does not say "not the ship"', () => {
    const r = today(null, shortSleep(['chen']))
    const v = verdict(r.people.chen, r.cabin)
    expect(v.title).toBe('No cabin data to check')
    expect(v.co2.known).toBe(false)
  })

  it('day 3 of a likely-not-the-ship episode: the answer stays the same, with no day count', () => {
    const results = run({}, shortSleep(['chen'], LAST3))
    expect(results.at(-1)!.people.chen.tier).toBe(3)
    expect(box(results, 'chen').title).toBe('Likely not the ship')
  })

  it('day 3 of a ship alert stays "likely the ship": it never turns into a day count about you', () => {
    const results = run({ [LAST - 2]: 3.6, [LAST - 1]: 3.6, [LAST]: 3.6 }, shortSleep(CREW, LAST3))
    const r = results.at(-1)!
    expect(r.people.anna).toMatchObject({ attribution: 'ship', tier: 3 })
    expect(r.summaries.map((s) => s.kind)).toEqual(['ship'])
    expect(box(results, 'anna').title).toBe('Likely the ship, not you')
    // The day-3 banner about a summary of your own readings does not fire on a ship day.
    expect(notices(r.people.anna, r.cabin, 600).map((n) => n.id)).not.toContain('surgeon')
  })

  it('an urgent conference request does not change the answer', () => {
    const r = today(undefined, shortSleep(['chen']), [{ crewId: 'chen', day: LAST, urgent: true }])
    expect(r.people.chen.tier).toBe(4)
    expect(verdict(r.people.chen, r.cabin)).toMatchObject({ title: 'Likely not the ship' })
  })

  it('the cabin air never colours a body zone', () => {
    const r = today(3.6)
    expect(cabinLevel(r.cabin)).toBe('alert')
    const zones = zoneStates(r.people.anna)
    expect(Object.values(zones).map((z) => z.level)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('notifications carry their source, and "likely the ship" is said once, in the box', () => {
    const r = today(3.6, shortSleep(CREW))
    const list = notices(r.people.anna, r.cabin, 600)
    expect(list.map((n) => n.id)).not.toContain('ship')
    expect(list.find((n) => n.id === 'co2')?.source).toBe('air')
    expect(list.filter((n) => n.id.startsWith('ind-')).every((n) => n.source === 'you')).toBe(true)
    expect(list.some((n) => /likely the ship/i.test(n.body))).toBe(false)
  })
})
