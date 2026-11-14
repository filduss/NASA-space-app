// Runs the app's real rules engine over simulated crews, for the Python scripts.
// Usage: npx tsx scripts/engine_cli.ts <input.json> <output.json>
// One implementation of the rules: the backtest measures the code that ships.
import { readFileSync, writeFileSync } from 'node:fs'
import { runEngine } from '../src/engine/escalation.ts'
import type { CabinDay, CheckIn } from '../src/engine/types.ts'

interface Run {
  id: string
  crewIds: string[]
  checkIns: CheckIn[]
  /** Key into `traces`. */
  trace: string
  fromDay: number
  toDay: number
  /** The comparator with one case per person (see EngineInput.perPersonOnly). */
  perPersonOnly?: boolean
}
interface Input {
  traces: Record<string, CabinDay[]>
  runs: Run[]
}

const [inPath, outPath] = process.argv.slice(2)
if (!inPath || !outPath) {
  console.error('usage: engine_cli.ts <input.json> <output.json>')
  process.exit(2)
}
const input = JSON.parse(readFileSync(inPath, 'utf8')) as Input

const runs = input.runs.map((run) => {
  const days = runEngine({
    crewIds: run.crewIds,
    checkIns: run.checkIns,
    cabin: input.traces[run.trace],
    fromDay: run.fromDay,
    toDay: run.toDay,
    perPersonOnly: run.perPersonOnly,
  })
  return {
    id: run.id,
    days: days.map((d) => ({
      day: d.day,
      outcome: d.decision.outcome,
      cabinElevated: d.cabin.elevated,
      cabinKnown: d.decision.cabinKnown,
      shipEpisodeDay: d.shipEpisodeDay,
      summaries: d.summaries.map((s) => s.kind),
      // Who a day-3 summary about one person was sent for: the day their problem reached the flight surgeon.
      sent: d.summaries.filter((s) => s.kind === 'person').map((s) => s.crewId),
      people: Object.fromEntries(
        Object.values(d.people).map((p) => [
          p.crewId,
          {
            in: p.assessment.checkedIn,
            off: p.assessment.off,
            co2: p.assessment.co2LinkedOff.length > 0,
            a: p.attribution,
            t: p.tier,
            e: p.episodeDay,
            slow: p.assessment.off.filter((k) => p.assessment.indicators[k].reason === 'below_start'),
          },
        ]),
      ),
    })),
  }
})
writeFileSync(outPath, JSON.stringify({ runs }))
