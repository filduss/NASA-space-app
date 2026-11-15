import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CabinFile, CrewFile } from '../src/data/types.ts'
import { verdict } from '../src/dashboard/model.ts'
import { runEngine, shipFollowUp } from '../src/engine/index.ts'

// The demo's golden path (docs/SPEC.md, "Golden path") on the committed data files. The 30-second
// video and the judge's tour depend on these four days, so a rule or data change that moves them fails here.
const crew = JSON.parse(readFileSync('public/data/crew.json', 'utf8')) as CrewFile
const cabin = JSON.parse(readFileSync('public/data/cabin.json', 'utf8')) as CabinFile
const results = runEngine({
  crewIds: crew.crew.map((c) => c.id),
  checkIns: crew.checkIns,
  cabin: cabin.daily,
  fromDay: crew.meta.days[0],
  toDay: 223,
})
const upTo = (d: number) => results.filter((r) => r.day <= d)
const day = (d: number) => upTo(d).at(-1)!
const ship = (d: number) =>
  Object.values(day(d).people)
    .filter((p) => p.attribution === 'ship')
    .map((p) => p.crewId)

describe('golden path on the demo data', () => {
  it('212: everyone within their normal, while CO₂ has started to climb', () => {
    expect(day(212).decision.outcome).toBe('none')
    expect(day(212).cabin.aboveLimit).toBe(true)
  })

  it('213: likely the ship for Anna, Ben and Dana, while Chen is fine', () => {
    expect(day(213).decision.outcome).toBe('ship')
    expect(ship(213).sort()).toEqual(['anna', 'ben', 'dana'])
    expect(day(213).people.chen.attribution).toBe('none')
  })

  it('221: the air is back to normal and 3 of 4 are back to theirs; Chen is still off, likely him', () => {
    expect(day(221).decision.outcome).toBe('me')
    expect(day(221).people.chen.attribution).toBe('me')
    expect(day(221).people.chen.episodeDay).toBe(1)
    expect(shipFollowUp(upTo(221))).toMatchObject({ airBack: true, affected: 4, recovered: 3, stillOff: 1 })
  })

  it("223: Chen's day 3 goes to the flight surgeon", () => {
    expect(day(223).people.chen.tier).toBe(3)
    expect(day(223).summaries.map((s) => [s.kind, s.crewId])).toEqual([['person', 'chen']])
  })

  it("Chen's dashboard box on the four days says what its colour says", () => {
    const chen = (d: number) => verdict(day(d).people.chen, day(d).cabin)
    expect(chen(212)).toMatchObject({ tint: 'ok', title: "You're within your normal", ship: { level: 'watch' } })
    expect(chen(213)).toMatchObject({ tint: 'ok', title: "You're within your normal", ship: { level: 'alert' } })
    expect(chen(221)).toMatchObject({ tint: 'alert', title: 'Likely not the ship', ship: { level: 'ok' } })
    expect(chen(223)).toMatchObject({ tint: 'alert', title: 'Likely not the ship' })
    for (const d of [212, 213, 221, 223]) {
      if (/normal|all good/i.test(chen(d).title)) expect(chen(d).tint).toBe('ok')
    }
  })

  it('the demo crew is seed 402 and nobody shows a slow change', () => {
    expect(crew.meta.seed).toBe(402)
    const slow = results.flatMap((r) => Object.values(r.people).flatMap((p) => p.assessment.off.filter((k) => p.assessment.indicators[k].reason === 'below_start')))
    expect(slow).toEqual([])
  })
})
