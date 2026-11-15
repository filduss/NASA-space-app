import { describe, expect, it } from 'vitest'
import { cabinLevel, notices, verdict, zoneStates } from '../src/dashboard/model.ts'
import { runEngine, type CheckIn } from '../src/engine/index.ts'
import { entryById } from '../src/guide/entries.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

// The personal dashboard's status box: the colour follows the side the answer points at, so a box
// that says you are fine is never orange or red because of the air.
const LAST = 20

function today(co2Today: number | null, change: (all: CheckIn[]) => CheckIn[] = (x) => x) {
  const checkIns = change(CREW.flatMap((id) => steady(id, 1, LAST)))
  return runEngine({ crewIds: CREW, checkIns, cabin: cabin(1, LAST, 2.4, co2Today === null ? {} : { [LAST]: co2Today }), fromDay: 1, toDay: LAST }).at(-1)!
}
const shortSleep = (ids: string[]) => (all: CheckIn[]) =>
  all.map((c) => (c.day === LAST && ids.includes(c.crewId) ? checkIn(c.crewId, LAST, { sleepHours: 4, sleepQuality: 3 }) : c))

describe('dashboard status box: likely you or likely the ship', () => {
  it('steady while the air is up: the box is green, the cabin row carries the colour', () => {
    const r = today(2.95)
    const v = verdict(r.people.anna, r.cabin)
    expect(r.cabin.elevated).toBe(true)
    expect(v.tint).toBe('ok')
    expect(v.you.level).toBe('ok')
    expect(v.ship.level).toBe('watch')
    expect(v.title).toBe("You're fine. The air isn't.")
  })

  it('most of the crew changed while the air is up: likely the ship, coloured by the air', () => {
    const r = today(3.6, shortSleep(CREW))
    const v = verdict(r.people.anna, r.cabin)
    expect(r.people.anna.attribution).toBe('ship')
    expect(v.title).toBe('Likely the ship')
    expect(v.tint).toBe(cabinLevel(r.cabin))
    expect(v.you.level).toBe('watch')
  })

  it('one person changed while the air is usual: likely you', () => {
    const r = today(null, shortSleep(['chen']))
    const v = verdict(r.people.chen, r.cabin)
    expect(r.people.chen.attribution).toBe('me')
    expect(v.title).toBe('Likely you')
    expect(v.tint).toBe('watch')
    expect(v.ship.level).toBe('ok')
  })

  it('one person changed while the air is up: still likely you', () => {
    const r = today(3.6, shortSleep(['chen']))
    expect(r.people.chen.attribution).toBe('me')
    expect(verdict(r.people.chen, r.cabin).title).toBe('Likely you')
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

  it('every notification about a reading or the air opens the Guide entry that explains it', () => {
    const r = today(3.6, shortSleep(CREW))
    const list = notices(r.people.anna, r.cabin, 600)
    expect(list.find((n) => n.id === 'co2')?.guide).toBe('co2')
    expect(list.find((n) => n.id === 'ind-sleepHours')?.guide).toBe('sleep')
    for (const n of list.filter((x) => x.source !== 'you' || x.id.startsWith('ind-'))) expect(entryById(n.guide ?? ''), n.id).toBeDefined()
  })
})
