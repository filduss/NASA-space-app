import { describe, expect, it } from 'vitest'
import {
  assessPerson,
  boardPerson,
  cabinStatus,
  cmoInbox,
  crewTimeline,
  decideShipOrMe,
  median,
  newMemory,
  privateCount,
  robustBaseline,
  runEngine,
  RULES,
  shipFollowUp,
  tierFor,
  trailingBaseline,
  type CheckIn,
  type ConferenceRequest,
  type PersonDay,
} from '../src/engine/index.ts'
import { cabin, checkIn, CREW, steady } from './helpers.ts'

const crewHistory = (from: number, to: number) => CREW.flatMap((id) => steady(id, from, to))
const replace = (all: CheckIn[], next: CheckIn) => all.filter((c) => !(c.crewId === next.crewId && c.day === next.day)).concat(next)

describe('baseline', () => {
  it('median handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
  it('floors the spread so identical readings do not give a zero-width normal', () => {
    expect(robustBaseline([7, 7, 7, 7], 0.5)).toEqual({ median: 7, spread: 0.5, n: 4 })
  })
  it('uses only earlier days, so a result never depends on the future', () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({ day: i + 1, value: i < 15 ? 5 : 50 }))
    expect(trailingBaseline(samples, 15, { minSpread: 1 })?.median).toBe(5)
  })
  it('returns null until there is enough history', () => {
    const samples = Array.from({ length: 5 }, (_, i) => ({ day: i + 1, value: 5 }))
    expect(trailingBaseline(samples, 6, { minSpread: 1 })).toBeNull()
  })
  it('leaves out days already judged off, so a bad stretch does not become the new normal', () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({ day: i + 1, value: i >= 10 ? 9 : 5, excluded: i >= 10 }))
    expect(trailingBaseline(samples, 21, { minSpread: 1 })?.median).toBe(5)
  })
})

describe('deviation from own normal', () => {
  it('a normal day is not flagged', () => {
    const history = steady('anna', 1, 20)
    const a = assessPerson('anna', 20, history, newMemory())
    expect(a.off).toEqual([])
  })
  it('flags a reading far from own normal, in the unwanted direction only', () => {
    const history = steady('anna', 1, 19)
    const bad = assessPerson('anna', 20, [...history, checkIn('anna', 20, { fatigue: 9 })], newMemory())
    expect(bad.off).toContain('fatigue')
    const good = assessPerson('anna', 20, [...history, checkIn('anna', 20, { fatigue: 0, mood: 10, sleepHours: 9.5 })], newMemory())
    expect(good.off).toEqual([])
  })
  it('the same reading is normal for one person and off for another', () => {
    const lowSleeper = steady('anna', 1, 19).map((c) => ({ ...c, sleepHours: 6 + (c.day % 2) * 0.5 }))
    const highSleeper = steady('ben', 1, 19).map((c) => ({ ...c, sleepHours: 8.5 + (c.day % 2) * 0.5 }))
    const a = assessPerson('anna', 20, [...lowSleeper, checkIn('anna', 20, { sleepHours: 6 })], newMemory())
    const b = assessPerson('ben', 20, [...highSleeper, checkIn('ben', 20, { sleepHours: 6 })], newMemory())
    expect(a.off).not.toContain('sleepHours')
    expect(b.off).toContain('sleepHours')
  })
  it('a ticked symptom counts without a baseline', () => {
    const a = assessPerson('anna', 2, [checkIn('anna', 1), checkIn('anna', 2, { symptoms: ['headache'] })], newMemory())
    expect(a.off).toEqual(['symptoms'])
    expect(a.co2LinkedOff).toEqual(['symptoms'])
  })
  it('only headache makes the symptom tick CO2-linked', () => {
    const a = assessPerson('anna', 1, [checkIn('anna', 1, { symptoms: ['congestion'] })], newMemory())
    expect(a.off).toEqual(['symptoms'])
    expect(a.co2LinkedOff).toEqual([])
  })
  it('under 6 h on 3 of the last 7 nights is a Watch even when that is the person\'s normal', () => {
    const history: CheckIn[] = []
    for (let d = 1; d <= 20; d++) history.push(checkIn('anna', d, { sleepHours: d % 2 ? 5.5 : 6.5 }))
    const a = assessPerson('anna', 19, history, newMemory())
    expect(a.indicators.sleepHours.reason).toBe('short_sleep')
  })
  it('a night with no wearable reading is "not measured", never a drift', () => {
    const history = [...steady('anna', 1, 19), checkIn('anna', 20, { sleepHours: null })]
    const a = assessPerson('anna', 20, history, newMemory())
    expect(a.indicators.sleepHours.reason).toBe('not_measured')
    expect(a.off).toEqual([])
  })
  it('a night with no wearable reading does not count as a short night', () => {
    // Of the last 7 nights, only 15 and 19 are under 6 h; 16 and 18 have no reading. That is 3 short
    // nights only if a missing night counted as short.
    const history: CheckIn[] = []
    for (let d = 1; d <= 14; d++) history.push(checkIn('anna', d, { sleepHours: 6.5 }))
    for (const [d, h] of [[15, 5.5], [16, null], [17, 6.5], [18, null], [19, 5.5]] as const) history.push(checkIn('anna', d, { sleepHours: h }))
    const a = assessPerson('anna', 19, history, newMemory())
    expect(a.indicators.sleepHours.reason).toBe('ok')
  })
  it('a skipped reaction test is "not measured", never a drift', () => {
    const history = [...steady('anna', 1, 19), checkIn('anna', 20, { reactionMs: null })]
    const a = assessPerson('anna', 20, history, newMemory())
    expect(a.indicators.reaction.reason).toBe('not_measured')
    expect(a.off).toEqual([])
  })
  it('counts consecutive days off per indicator', () => {
    const memory = newMemory()
    let history = steady('anna', 1, 19)
    let last: PersonDay | undefined
    for (let d = 20; d <= 23; d++) {
      history = [...history, checkIn('anna', d, { sleepQuality: 1 })]
      last = assessPerson('anna', d, history, memory)
    }
    expect(last?.indicators.sleepQuality.daysOff).toBe(4)
  })
})

describe('cabin CO2', () => {
  it('is elevated only when the mean is above its own baseline by the margin', () => {
    const days = cabin(1, 20, 2.4, { 20: 2.4 + RULES.cabinMarginMmHg + 0.1 })
    expect(cabinStatus(days, 20, new Set()).elevated).toBe(true)
    expect(cabinStatus(cabin(1, 20, 2.4, { 20: 2.6 }), 20, new Set()).elevated).toBe(false)
  })
  it('a cabin that always runs high is its own normal', () => {
    expect(cabinStatus(cabin(1, 20, 4.2), 20, new Set()).elevated).toBe(false)
  })
  it('flags a 1-hour average above 3 mmHg separately from the baseline check', () => {
    const s = cabinStatus(cabin(1, 20, 2.9), 20, new Set())
    expect(s.aboveLimit).toBe(true)
    expect(s.elevated).toBe(false)
    expect(s.overLimit).toBe(false)
  })
  it('a 24-hour mean above 3 mmHg is over the limit even when it is the cabin\'s normal', () => {
    const s = cabinStatus(cabin(1, 20, 4.2), 20, new Set())
    expect(s.elevated).toBe(false)
    expect(s.overLimit).toBe(true)
  })
  it('says so when there is no data, and remembers the last day that had some', () => {
    const s = cabinStatus(cabin(1, 20, 2.4, { 19: null, 20: null }), 20, new Set())
    expect(s.hasData).toBe(false)
    expect(s.elevated).toBe(false)
    expect(s.lastDataDay).toBe(18)
  })
})

describe('ship-or-me rule', () => {
  const person = (crewId: string, off: PersonDay['off'], co2: PersonDay['off'] = off): PersonDay =>
    ({ crewId, day: 1, checkedIn: true, live: false, indicators: {} as PersonDay['indicators'], off, co2LinkedOff: co2, symptoms: [] })
  const up = cabinStatus(cabin(1, 20, 2.4, { 20: 4 }), 20, new Set())
  const normal = cabinStatus(cabin(1, 20, 2.4), 20, new Set())

  it('ship: half the crew drift on CO2-linked indicators and the cabin is above baseline', () => {
    const d = decideShipOrMe([person('a', ['symptoms']), person('b', ['sleepQuality']), person('c', []), person('d', [])], up, 4)
    expect(d.outcome).toBe('ship')
  })
  it('me: one person drifts and the cabin is normal', () => {
    const d = decideShipOrMe([person('a', ['fatigue']), person('b', []), person('c', []), person('d', [])], normal, 4)
    expect(d.outcome).toBe('me')
  })
  it('shared, not the air: several drift but the cabin is normal', () => {
    const d = decideShipOrMe([person('a', ['fatigue']), person('b', ['symptoms']), person('c', ['sleepHours']), person('d', [])], normal, 4)
    expect(d.outcome).toBe('shared')
  })
  it('high CO2 alone is not a ship alert: someone has to feel it', () => {
    expect(decideShipOrMe([person('a', []), person('b', []), person('c', []), person('d', [])], up, 4).outcome).toBe('none')
  })
  it('one person drifting under high CO2 is not enough to blame the ship', () => {
    expect(decideShipOrMe([person('a', ['symptoms']), person('b', []), person('c', []), person('d', [])], up, 4).outcome).toBe('me')
  })
  it('mood and stress never decide ship or me', () => {
    const moody = [person('a', ['mood'], []), person('b', ['stress'], []), person('c', ['mood', 'stress'], []), person('d', ['mood'], [])]
    expect(decideShipOrMe(moody, up, 4).outcome).toBe('shared')
  })
  it('an active ship alert holds while the cabin stays high, and ends when it is back to normal', () => {
    const quiet = [person('a', []), person('b', []), person('c', []), person('d', [])]
    expect(decideShipOrMe(quiet, up, 4, true).outcome).toBe('ship')
    expect(decideShipOrMe(quiet, up, 4, true).held).toBe(true)
    expect(decideShipOrMe(quiet, normal, 4, true).outcome).toBe('none')
  })

  const highForWeeks = cabinStatus(cabin(1, 20, 4.2), 20, new Set())
  const spiky = cabinStatus(cabin(1, 20, 2.8), 20, new Set())
  it('a cabin held over the 3 mmHg limit is still a suspect, even when that level is its usual', () => {
    const d = decideShipOrMe([person('a', ['symptoms']), person('b', ['sleepQuality']), person('c', []), person('d', [])], highForWeeks, 4)
    expect(d.outcome).toBe('ship')
    expect(decideShipOrMe([person('a', []), person('b', []), person('c', []), person('d', [])], highForWeeks, 4, true).held).toBe(true)
  })
  it('a 1-hour peak over the limit is not enough when the 24-hour mean is under it', () => {
    expect(spiky.aboveLimit).toBe(true)
    const d = decideShipOrMe([person('a', ['symptoms']), person('b', ['sleepQuality']), person('c', []), person('d', [])], spiky, 4)
    expect(d.outcome).toBe('shared')
  })
})

describe('escalation tiers', () => {
  it('follows the ladder', () => {
    expect(tierFor({ urgent: false, attribution: 'none', episodeDay: 0, shared: false })).toBe(0)
    expect(tierFor({ urgent: false, attribution: 'me', episodeDay: 1, shared: false })).toBe(1)
    expect(tierFor({ urgent: false, attribution: 'me', episodeDay: 1, shared: true })).toBe(2)
    expect(tierFor({ urgent: false, attribution: 'ship', episodeDay: 1, shared: false })).toBe(2)
    expect(tierFor({ urgent: false, attribution: 'shared', episodeDay: 2, shared: false })).toBe(2)
    expect(tierFor({ urgent: false, attribution: 'me', episodeDay: 3, shared: false })).toBe(3)
    expect(tierFor({ urgent: true, attribution: 'none', episodeDay: 0, shared: false })).toBe(4)
  })

  it('a private Watch stays tier 1 for two days and reaches the flight surgeon on day 3', () => {
    let all = crewHistory(1, 25)
    for (const d of [21, 22, 23]) all = replace(all, checkIn('chen', d, { sleepHours: 4.5, sleepQuality: 2, fatigue: 8 }))
    const res = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 25), fromDay: 1, toDay: 23 })
    const day = (d: number) => res[d - 1]
    expect(day(21).decision.outcome).toBe('me')
    expect(day(21).people.chen.tier).toBe(1)
    expect(day(22).people.chen.tier).toBe(1)
    expect(day(23).people.chen.tier).toBe(3)
    expect(day(22).summaries).toEqual([])
    expect(day(23).summaries.map((s) => [s.kind, s.crewId, s.immediate])).toEqual([['person', 'chen', false]])
    expect(day(23).people.anna.tier).toBe(0)
  })

  it('the per-person comparator never blames the ship and sends one summary per person', () => {
    const air = cabin(1, 30, 2.4, { 21: 4.5, 22: 4.6, 23: 4.5 })
    let all = crewHistory(1, 30)
    for (const id of ['anna', 'ben', 'dana']) for (const d of [21, 22, 23]) all = replace(all, checkIn(id, d, { symptoms: ['headache'] }))
    const input = { crewIds: CREW, checkIns: all, cabin: air, fromDay: 1, toDay: 23 }
    const shipshape = runEngine(input)[22]
    const perPerson = runEngine({ ...input, perPersonOnly: true })[22]
    expect(shipshape.summaries.map((s) => s.kind)).toEqual(['ship'])
    expect(perPerson.decision.outcome).not.toBe('ship')
    expect(perPerson.summaries.map((s) => [s.kind, s.crewId])).toEqual([
      ['person', 'anna'],
      ['person', 'ben'],
      ['person', 'dana'],
    ])
  })

  it('the golden path: ship alert, held while CO2 is high, then one person is still off', () => {
    const air = cabin(1, 30, 2.4, { 21: 4.3, 22: 5.2, 23: 5.5, 24: 4.2 })
    let all = crewHistory(1, 30)
    all = replace(all, checkIn('anna', 21, { symptoms: ['headache'] }))
    all = replace(all, checkIn('ben', 21, { sleepQuality: 2 }))
    all = replace(all, checkIn('dana', 21, { symptoms: ['headache'], fatigue: 8 }))
    for (const d of [24, 25, 26, 27]) all = replace(all, checkIn('chen', d, { sleepHours: 4.5, sleepQuality: 2 }))
    const res = runEngine({ crewIds: CREW, checkIns: all, cabin: air, fromDay: 1, toDay: 27 })
    const day = (d: number) => res[d - 1]
    expect(day(20).decision.outcome).toBe('none')
    expect(day(21).decision.outcome).toBe('ship')
    expect(day(21).decision.driftingCo2.sort()).toEqual(['anna', 'ben', 'dana'])
    expect(day(21).people.anna.attribution).toBe('ship')
    expect(day(21).people.chen.attribution).toBe('none')
    expect(day(22).decision.outcome).toBe('ship') // held: nobody drifts but CO2 is still high
    expect(day(22).decision.held).toBe(true)
    expect(day(23).summaries.map((s) => s.kind)).toEqual(['ship']) // day 3 of the ship alert
    expect(day(24).people.chen.attribution).toBe('ship')
    expect(day(25).decision.outcome).toBe('me') // CO2 back to normal, Chen still off
    expect(day(25).people.chen.episodeDay).toBe(1) // a new likely cause starts a new count
    expect(day(27).people.chen.tier).toBe(3)
    expect(day(27).summaries.map((s) => [s.kind, s.crewId])).toEqual([['person', 'chen']])
  })

  it('after a ship alert, the follow-up says whether the air and the crew recovered, in counts only', () => {
    const air = cabin(1, 40, 2.4, { 21: 4.3, 22: 5.2, 23: 5.5, 24: 4.2 })
    let all = crewHistory(1, 40)
    all = replace(all, checkIn('anna', 21, { symptoms: ['headache'] }))
    all = replace(all, checkIn('ben', 21, { sleepQuality: 2 }))
    all = replace(all, checkIn('dana', 21, { symptoms: ['headache'], fatigue: 8 }))
    for (const d of [24, 25, 26, 27]) all = replace(all, checkIn('chen', d, { sleepHours: 4.5, sleepQuality: 2 }))
    const res = runEngine({ crewIds: CREW, checkIns: all, cabin: air, fromDay: 1, toDay: 40 })
    const upTo = (d: number) => res.slice(0, d)
    expect(shipFollowUp(upTo(24))).toBeNull() // the alert is still on
    const f = shipFollowUp(upTo(25))
    expect(f).toEqual({ alertStart: 21, alertEnd: 24, daysSince: 1, airBack: true, affected: 4, recovered: 3, stillOff: 1, notCheckedIn: 0 })
    expect(JSON.stringify(f)).not.toContain('chen')
    expect(shipFollowUp(upTo(24 + RULES.followUpDays))).not.toBeNull()
    expect(shipFollowUp(upTo(25 + RULES.followUpDays))).toBeNull()
  })

  it('an urgent conference request is tier 4 at once, with an immediate summary, even before the check-in', () => {
    // Ben asks for help on day 20 without checking in: help never waits for the ratings.
    const all = crewHistory(1, 20).filter((c) => !(c.crewId === 'ben' && c.day === 20))
    const res = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20, requests: [{ crewId: 'ben', day: 20, urgent: true }] })
    const last = res[res.length - 1]
    expect(last.people.ben.assessment.checkedIn).toBe(false)
    expect(last.people.ben.tier).toBe(4)
    expect(last.people.ben.conference).toBe('urgent')
    expect(last.summaries).toMatchObject([{ kind: 'urgent', crewId: 'ben', immediate: true }])
  })

  it('a routine conference request goes to the flight surgeon only, with no tier and none of the readings', () => {
    const all = replace(crewHistory(1, 20), checkIn('ben', 20, { mood: 1 }))
    const base = { crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20 }
    const without = runEngine(base).at(-1)!
    const day = runEngine({ ...base, requests: [{ crewId: 'ben', day: 20, urgent: false }] }).at(-1)!
    expect(day.people.ben.tier).toBe(without.people.ben.tier)
    expect(day.people.ben.conference).toBe('routine')
    expect(day.summaries).toEqual([expect.objectContaining({ kind: 'conference', crewId: 'ben', immediate: true, indicators: [] })])
    expect(cmoInbox(day, {})).toEqual([])
  })

  it('choosing to share a Watch informs the crew medical officer (tier 2)', () => {
    const all = replace(crewHistory(1, 20), checkIn('anna', 20, { mood: 1 }))
    const base = { crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20 }
    expect(runEngine(base).at(-1)?.people.anna.tier).toBe(1)
    expect(runEngine({ ...base, shareWatch: { anna: true } }).at(-1)?.people.anna.tier).toBe(2)
  })

  it('is deterministic', () => {
    const input = { crewIds: CREW, checkIns: crewHistory(1, 20), cabin: cabin(1, 20), fromDay: 1, toDay: 20 }
    expect(runEngine(input)).toEqual(runEngine(input))
  })
})

describe('slow change against the starting normal', () => {
  // Anna's mood slides one point every 8 days from day 15: never far enough in one day to be drift.
  const sliding = (to: number) =>
    crewHistory(1, to).map((c) => (c.crewId === 'anna' && c.day >= 15 ? { ...c, mood: c.mood - Math.floor((c.day - 15) / 8) } : c))
  const slow = (r: { people: Record<string, { assessment: PersonDay }> }, id: string) => r.people[id].assessment.indicators.mood.reason === 'below_start'

  it('a stable person never gets a slow-change flag', () => {
    const res = runEngine({ crewIds: CREW, checkIns: crewHistory(1, 90), cabin: cabin(1, 90), fromDay: 1, toDay: 90 })
    expect(res.some((r) => CREW.some((id) => slow(r, id)))).toBe(false)
  })
  it('flags a slow mood decline that never jumps on one day, and says where it started', () => {
    const res = runEngine({ crewIds: CREW, checkIns: sliding(70), cabin: cabin(1, 70), fromDay: 1, toDay: 70 })
    const first = res.find((r) => slow(r, 'anna'))
    expect(first?.day).toBeGreaterThan(30)
    expect(first?.day).toBeLessThanOrEqual(50)
    const mood = first!.people.anna.assessment.indicators.mood
    expect(mood.start?.median).toBe(6.5)
    expect(mood.baseline!.median).toBeLessThanOrEqual(6.5 - RULES.startDriftZ * mood.start!.spread)
    expect(first!.people.anna.attribution).toBe('me')
    expect(first!.people.anna.assessment.co2LinkedOff).toEqual([])
  })
  it('reaches the flight surgeon on day 3, with the starting normal in the summary', () => {
    const res = runEngine({ crewIds: CREW, checkIns: sliding(70), cabin: cabin(1, 70), fromDay: 1, toDay: 70 })
    const sent = res.flatMap((r) => r.summaries).find((x) => x.kind === 'person' && x.crewId === 'anna')
    expect(sent).toBeDefined()
    expect(sent!.indicators.find((i) => i.key === 'mood')?.start).toBe(6.5)
  })
  it('has no starting normal, and so no flag, before the first 14 check-ins are in', () => {
    const res = runEngine({ crewIds: CREW, checkIns: crewHistory(1, 20), cabin: cabin(1, 20), fromDay: 1, toDay: 20 })
    expect(res[RULES.startNormalDays - 1].people.anna.assessment.indicators.mood.start).toBeNull()
    expect(res[RULES.startNormalDays].people.anna.assessment.indicators.mood.start?.n).toBe(RULES.startNormalDays)
  })
  it('keeps slow-change days in the rolling normal, so the flag does not switch itself off', () => {
    const history = sliding(60).filter((c) => c.crewId === 'anna')
    const mem = newMemory()
    let flagged: number | null = null
    for (let d = 1; d <= 60; d++) {
      const p = assessPerson('anna', d, history, mem)
      if (p.indicators.mood.reason === 'below_start' && flagged === null) flagged = d
    }
    expect(flagged).not.toBeNull()
    expect(mem.offDays.mood.has(flagged as number)).toBe(false)
    expect(mem.runs.mood).toBeGreaterThan(0)
  })
  it('only mood and stress are checked for a slow change', () => {
    const res = runEngine({ crewIds: CREW, checkIns: crewHistory(1, 30), cabin: cabin(1, 30), fromDay: 1, toDay: 30 })
    const ind = res[29].people.anna.assessment.indicators
    expect(ind.mood.start).not.toBeNull()
    expect(ind.stress.start).not.toBeNull()
    expect(ind.fatigue.start).toBeNull()
    expect(ind.sleepHours.start).toBeNull()
  })
})

describe('privacy', () => {
  const run = (over: Partial<CheckIn>, shareWatch: Record<string, boolean> = {}, requests: ConferenceRequest[] = []) => {
    const all = replace(crewHistory(1, 20), checkIn('anna', 20, over))
    const day = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20, shareWatch, requests }).at(-1)!
    return { day, inbox: cmoInbox(day, shareWatch) }
  }
  it('the crew board never shows mood or stress, only a count with no names', () => {
    const { day } = run({ mood: 1, stress: 9 })
    const board = boardPerson(day.people.anna)
    expect(board.off).toEqual([])
    expect(board.ok).toBe(true)
    expect(privateCount(day)).toEqual({ off: 1, of: 4 })
  })
  it('the board shows sleep and symptoms by default', () => {
    const { day } = run({ sleepQuality: 1, symptoms: ['headache'] })
    expect(boardPerson(day.people.anna).off.sort()).toEqual(['sleepQuality', 'symptoms'])
  })
  it('the crew medical officer does not see a private Watch unless it is shared', () => {
    expect(run({ mood: 1 }).inbox).toEqual([])
    expect(run({ mood: 1 }, { anna: true }).inbox).toEqual([{ kind: 'shared_watch', crewId: 'anna', indicators: ['mood'] }])
  })
  it('a shared pattern reaches the crew medical officer with counts and no names', () => {
    const all = replace(replace(crewHistory(1, 20), checkIn('anna', 20, { mood: 1 })), checkIn('ben', 20, { fatigue: 9 }))
    const day = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 20), fromDay: 1, toDay: 20 }).at(-1)!
    const inbox = cmoInbox(day, {})
    expect(inbox).toHaveLength(1)
    expect(inbox[0]).toMatchObject({ kind: 'shared_pattern', count: 2, of: 4 })
    expect(inbox[0].crewId).toBeUndefined()
  })
  it('an urgent conference request never appears on the board and reaches the crew medical officer immediately', () => {
    const { day, inbox } = run({ symptoms: ['headache'] }, {}, [{ crewId: 'anna', day: 20, urgent: true }])
    expect(boardPerson(day.people.anna).off).toEqual([])
    expect(inbox[0]).toMatchObject({ kind: 'urgent', crewId: 'anna' })
  })
})

describe('crew timeline', () => {
  const runDays = (all: CheckIn[], to = 20, requests: ConferenceRequest[] = []) =>
    runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, to), fromDay: 1, toDay: to, requests })
  const timeline = (viewer: Parameters<typeof crewTimeline>[0], results: ReturnType<typeof runDays>) =>
    crewTimeline(viewer, {
      window: results.slice(-14),
      crewIds: CREW,
      summaries: results.flatMap((r) => r.summaries),
    })
  // Anna sleeps badly on days 18-20: day 20 is day 3, so a summary goes to the flight surgeon.
  const sleepLoss = () => {
    let all = crewHistory(1, 20)
    for (const d of [18, 19, 20]) all = replace(all, checkIn('anna', d, { sleepQuality: 1 }))
    return runDays(all)
  }

  it('the crew medical officer sees every row, built from shared indicators only', () => {
    const results = runDays(replace(crewHistory(1, 20), checkIn('anna', 20, { mood: 1, stress: 9 })))
    const t = timeline({ kind: 'cmo' }, results)
    expect(t.rows.map((r) => r.crewId)).toEqual(CREW)
    expect(t.rows[0].cells.at(-1)).toMatchObject({ day: 20, mark: 'ok', keys: [] })
  })
  it('a crew member sees the counts and only their own row', () => {
    const t = timeline({ kind: 'crew', crewId: 'ben' }, sleepLoss())
    expect(t.rows.map((r) => r.crewId)).toEqual(['ben'])
    expect(t.days.every((d) => d.drifting !== null)).toBe(true)
  })
  it('turns from off to "day 3 or later" on the third day', () => {
    const anna = timeline({ kind: 'cmo' }, sleepLoss()).rows[0].cells.slice(-3)
    expect(anna.map((c) => c.mark)).toEqual(['off', 'off', 'persist'])
  })
  it('a run that straddles a change of likely cause does not count as day 3', () => {
    // Fatigue off on days 16-18 while the cabin is high (ship), then on its own from day 18 (me).
    let all = crewHistory(1, 18)
    for (const id of ['anna', 'ben']) for (const d of [16, 17]) all = replace(all, checkIn(id, d, { fatigue: 9 }))
    all = replace(all, checkIn('anna', 18, { fatigue: 9 }))
    const results = runEngine({ crewIds: CREW, checkIns: all, cabin: cabin(1, 18, 2.4, { 16: 4.5, 17: 4.5 }), fromDay: 1, toDay: 18 })
    const anna = results.at(-1)!.people.anna
    expect(anna.assessment.indicators.fatigue.daysOff).toBe(3)
    expect(anna.episodeDay).toBeLessThan(3)
    const t = timeline({ kind: 'cmo' }, results)
    expect(t.rows[0].cells.at(-1)?.mark).toBe('off')
  })
  it('an urgent conference request never shows in the board rows', () => {
    const results = runDays(replace(crewHistory(1, 20), checkIn('anna', 20, { symptoms: ['headache'] })), 20, [{ crewId: 'anna', day: 20, urgent: true }])
    expect(timeline({ kind: 'cmo' }, results).rows[0].cells.at(-1)?.mark).toBe('ok')
  })
  it('the flight surgeon sees no rows and no counts before a summary is sent', () => {
    const results = sleepLoss().slice(0, -1) // up to day 19: day 2 of the sleep loss
    const t = timeline({ kind: 'surgeon' }, results)
    expect(t.rows).toEqual([])
    expect(t.days.every((d) => d.drifting === null && !d.ship)).toBe(true)
    expect(t.days.at(-1)?.co2Mean).not.toBeNull()
  })
  it('the flight surgeon gets a row only from what the day-3 summary says', () => {
    const results = sleepLoss()
    expect(results.at(-1)?.summaries).toMatchObject([{ kind: 'person', crewId: 'anna', episodeDay: 3 }])
    const t = timeline({ kind: 'surgeon' }, results)
    expect(t.rows.map((r) => r.crewId)).toEqual(['anna'])
    expect(t.rows[0].cells.slice(-4).map((c) => c.mark)).toEqual(['unknown', 'off', 'off', 'persist'])
    expect(t.rows[0].cells.at(-1)?.keys).toEqual(['sleepQuality'])
  })
  it('an urgent conference request reaches the flight surgeon immediately', () => {
    const t = timeline({ kind: 'surgeon' }, runDays(crewHistory(1, 20), 20, [{ crewId: 'anna', day: 20, urgent: true }]))
    expect(t.rows).toMatchObject([{ crewId: 'anna' }])
    expect(t.rows[0].cells.at(-1)?.mark).toBe('urgent')
  })
})
