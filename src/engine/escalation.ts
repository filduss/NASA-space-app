import { RULES } from './config.ts'
import { assessPerson, newMemory, type PersonMemory } from './deviation.ts'
import { attributionFor, cabinStatus, decideShipOrMe } from './shipOrMe.ts'
import type {
  Attribution,
  CabinFactor,
  CheckIn,
  DayResult,
  EngineInput,
  PersonStatus,
  SurgeonSummary,
  Tier,
} from './types.ts'

/**
 * Tier ladder (docs/SPEC.md):
 *   0 everything within normal
 *   1 a Watch: private, shown on your own dashboard only
 *   2 a crew pattern, or a Watch you chose to share: crew medical officer informed
 *   3 still off on day 3: delayed summary to the flight surgeon
 *   4 an urgent conference request: crew medical officer and flight surgeon told at once
 */
export function tierFor(args: {
  urgent: boolean
  attribution: Attribution
  episodeDay: number
  shared: boolean
}): Tier {
  if (args.urgent) return 4
  if (args.attribution === 'none') return 0
  if (args.episodeDay >= RULES.persistDays) return 3
  if (args.attribution === 'ship' || args.attribution === 'shared' || args.shared) return 2
  return 1
}

type EpisodeKind = 'ship' | 'personal'
interface Episode {
  kind: EpisodeKind
  lastDay: number
  count: number
}

/**
 * Run every rule for each day in [fromDay, toDay], in order. Pure: same input, same output.
 * Baselines only ever look backwards, so a day's result never depends on later days.
 */
export function runEngine(input: EngineInput): DayResult[] {
  const byCrew = new Map<string, CheckIn[]>()
  for (const id of input.crewIds) byCrew.set(id, [])
  for (const c of input.checkIns) byCrew.get(c.crewId)?.push(c)

  const conferenceOf = (crewId: string, day: number): PersonStatus['conference'] => {
    const mine = (input.requests ?? []).filter((r) => r.crewId === crewId && r.day === day)
    return mine.some((r) => r.urgent) ? 'urgent' : mine.length > 0 ? 'routine' : null
  }

  const memory = new Map<string, PersonMemory>()
  const episodes = new Map<string, Episode>()
  for (const id of input.crewIds) memory.set(id, newMemory())

  const elevatedDays = new Set<number>()
  const results: DayResult[] = []
  let shipRun = 0
  let shipStart: number | null = null
  // The factors behind yesterday's ship alert: it is held while one of them is still a suspect.
  let shipCauses: CabinFactor[] = []

  for (let day = input.fromDay; day <= input.toDay; day++) {
    const cabin = cabinStatus(input.cabin, day, elevatedDays)
    if (cabin.elevated) elevatedDays.add(day)

    const assessments = input.crewIds.map((id) =>
      assessPerson(id, day, byCrew.get(id) as CheckIn[], memory.get(id) as PersonMemory),
    )
    const ruled = decideShipOrMe(assessments, cabin, input.crewIds.length, shipCauses)
    // The backtest's comparator: one case per person, never the ship (EngineInput.perPersonOnly).
    const decision = input.perPersonOnly
      ? { ...ruled, outcome: 'none' as const, held: false, causes: [], driftingShip: [] }
      : ruled

    if (decision.outcome === 'ship') {
      shipRun += 1
      if (shipRun === 1) shipStart = day
    } else {
      shipRun = 0
      shipStart = null
    }
    shipCauses = decision.causes

    const people: Record<string, PersonStatus> = {}
    const summaries: SurgeonSummary[] = []
    const cabinBrief = {
      co2Mean: cabin.co2Mean,
      co2Max1h: cabin.co2Max1h,
      baseline: cabin.baseline,
      elevated: cabin.elevated,
      aboveLimit: cabin.aboveLimit,
      overLimit: cabin.overLimit,
      hasData: cabin.hasData,
      temp: cabin.temp,
      rh: cabin.rh,
    }

    for (const a of assessments) {
      const attribution = attributionFor(a, decision)
      let episodeDay = 0
      if (attribution !== 'none') {
        const kind: EpisodeKind = attribution === 'ship' ? 'ship' : 'personal'
        const prev = episodes.get(a.crewId)
        const continues = prev && prev.kind === kind && day - prev.lastDay <= RULES.episodeGapDays
        episodeDay = continues ? prev.count + 1 : 1
        episodes.set(a.crewId, { kind, lastDay: day, count: episodeDay })
      } else if (a.checkedIn) {
        episodes.delete(a.crewId)
      }
      const conference = conferenceOf(a.crewId, day)
      const tier = tierFor({
        urgent: conference === 'urgent',
        attribution,
        episodeDay,
        shared: input.shareWatch?.[a.crewId] === true,
      })
      people[a.crewId] = { crewId: a.crewId, day, assessment: a, attribution, episodeDay, tier, conference }

      const offIndicators = a.off.map((key) => ({
        key,
        daysOff: a.indicators[key].daysOff,
        value: a.indicators[key].value,
        usual: a.indicators[key].baseline?.median ?? null,
        start: a.indicators[key].reason === 'below_start' ? (a.indicators[key].start?.median ?? null) : null,
      }))
      if (conference === 'urgent') {
        summaries.push({
          id: `urgent-${a.crewId}-${day}`,
          day,
          kind: 'urgent',
          immediate: true,
          crewId: a.crewId,
          episodeDay,
          attribution,
          indicators: offIndicators,
          cabin: cabinBrief,
        })
        continue
      }
      if (conference === 'routine') {
        // The request only: the readings go to Earth on their own schedule, below.
        summaries.push({
          id: `conference-${a.crewId}-${day}`,
          day,
          kind: 'conference',
          immediate: true,
          crewId: a.crewId,
          episodeDay,
          indicators: [],
          cabin: cabinBrief,
        })
      }
      if (
        attribution !== 'none' &&
        attribution !== 'ship' &&
        episodeDay >= RULES.persistDays &&
        episodeDay % RULES.persistDays === 0
      ) {
        // Day 3, then a follow-up every 3 days while it lasts.
        summaries.push({
          id: `person-${a.crewId}-${day}`,
          day,
          kind: 'person',
          immediate: false,
          crewId: a.crewId,
          episodeDay,
          attribution,
          indicators: offIndicators,
          cabin: cabinBrief,
        })
      }
    }

    if (decision.outcome === 'ship' && shipRun >= RULES.persistDays && shipRun % RULES.persistDays === 0) {
      summaries.push({
        id: `ship-${day}`,
        day,
        kind: 'ship',
        immediate: false,
        episodeDay: shipRun,
        affected: decision.driftingShip,
        causes: decision.causes,
        indicators: [],
        cabin: cabinBrief,
      })
    }

    results.push({ day, cabin, decision, people, shipEpisodeDay: shipRun, shipEpisodeStart: shipStart, summaries })
  }
  return results
}
