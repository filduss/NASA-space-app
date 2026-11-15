import { useMemo } from 'react'
import { cabinLevel } from '../dashboard/model.ts'
import { RULES } from '../engine/config.ts'
import { shipFollowUp } from '../engine/privacy.ts'
import type { CabinFactor } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Stat } from './bits.tsx'
import { LineChart } from './charts.tsx'
import { ShipBanner } from './CrewBoard.tsx'
import { FollowUpCard } from './FollowUp.tsx'
import { RadiationCard } from './Radiation.tsx'
import { celsius, list, mmHg, rhPercent } from './text.ts'

const CHART_DAYS = 14

/**
 * The steps while a ship alert is on. A fixed template: one thing for the crew to do, and what the app
 * does by itself. These are ours, not a NASA procedure, and the card says so.
 */
/** What to look at first for each cabin factor the alert blames. */
const CHECK_FIRST: Record<CabinFactor, string> = {
  co2: 'the CO₂ removal system and the airflow where people sleep and work',
  temp: 'the temperature control and the airflow at the sleep stations',
  rh: 'the humidity control',
}

function WhatNow({ alertDay, causes }: { alertDay: number; causes: CabinFactor[] }) {
  return (
    <Card title="What to do now" aside={<span className="count">day {alertDay} of the alert</span>}>
      <ol className="lines steps">
        <li>
          <strong>Check the air before anyone's health.</strong> Look at {list((causes.length ? causes : (['co2'] as CabinFactor[])).map((f) => CHECK_FIRST[f]))},
          and compare a second sensor if there is one.
        </li>
        <li>
          <strong>Nobody is singled out.</strong> Each affected person's own dashboard already says "Likely the ship, not you", so a bad day is not put down
          to them.
        </li>
        <li>
          <strong>Earth hears about the cabin, not about people.</strong> A crew-level summary goes to the flight surgeon on day{' '}
          {RULES.persistDays} of an alert and every {RULES.persistDays} days while it lasts. Anyone can still ask for a private conference
          from their check-in.
        </li>
        <li>
          <strong>The app keeps checking.</strong> The alert is re-checked at every check-in. Once the air is back to usual, this screen
          shows for {RULES.followUpDays} days whether the crew recovered too, and anyone still off is told privately it is now likely them.
        </li>
      </ol>
      <p className="fine">Suggested steps by this demo, not a NASA procedure. The crew's own flight rules come first.</p>
    </Card>
  )
}

export function ShipAlert() {
  const s = useStore()
  const r = s.todayResult
  const { cabin, decision } = r
  const meta = s.data.cabin.meta

  // x is in mission days: a whole number D is the moment of day D's morning check-in.
  const points = useMemo(() => {
    const anchor = Date.parse(`${meta.replay.anchorDate}T08:00:00Z`)
    return s.data.cabin.hourly
      .filter((h) => h.day <= s.today && h.day > s.today - CHART_DAYS)
      .map((h) => ({ x: meta.replay.anchorMissionDay + (Date.parse(h.t) + 3_600_000 - anchor) / 86_400_000, y: h.co2, t: h.t }))
  }, [s.data, s.today, meta])
  const byX = useMemo(() => new Map(points.map((p) => [p.x, p.t])), [points])
  const ticks = []
  for (let d = s.today - CHART_DAYS + 2; d <= s.today; d += 3) ticks.push({ x: d, label: `Day ${d}` })
  const refLines = [
    { y: RULES.co2LimitMmHg, label: '3 mmHg limit (1-hour average)', tone: 'limit' as const },
    ...(cabin.baseline !== null ? [{ y: cabin.baseline, label: `Cabin's usual ${cabin.baseline.toFixed(1)}`, tone: 'usual' as const }] : []),
  ]
  const level = cabinLevel(cabin)
  const recent = s.data.cabin.daily.filter((d) => d.day <= s.today && d.day > s.today - CHART_DAYS)
  const followUp = shipFollowUp(s.results)
  // Real days across every ISS trace in the backtest, from the engine's own cabin status.
  const traces = Object.values(s.data.backtest?.meta.traces ?? {}).flatMap((t) => (t.cabin ? [t.cabin] : []))
  const allDays = traces.reduce((n, t) => n + t.daysWithData, 0)
  const offDays = (f: 'co2' | 'temp' | 'rh') => traces.reduce((n, t) => n + t.suspectDays[f], 0)

  return (
    <div className="stack">
      <ShipBanner r={r} />
      {followUp && <FollowUpCard f={followUp} />}

      <Card title="Cabin CO₂">
        <div className="stats">
          <Stat label="Last 24 h" tone={level === 'ok' ? undefined : level} value={mmHg(cabin.co2Mean)} note={cabin.hasData ? `${cabin.hours} of 24 h of data` : 'no usable data'} />
          <Stat label="Cabin's usual" value={mmHg(cabin.baseline)} note={`median of the last ${RULES.cabinBaselineDays} normal days`} />
          <Stat
            label="Difference"
            tone={cabin.elevated ? 'watch' : undefined}
            value={cabin.delta === null ? 'n/a' : `${cabin.delta >= 0 ? '+' : '−'}${Math.abs(cabin.delta).toFixed(1)} mmHg`}
            note={`above baseline from +${RULES.cabinMarginMmHg} mmHg`}
          />
          <Stat label="Highest 1-hour average" tone={cabin.aboveLimit ? 'watch' : undefined} value={mmHg(cabin.co2Max1h)} note={cabin.aboveLimit ? 'above the 3 mmHg limit' : 'under the 3 mmHg limit'} />
        </div>
        <LineChart
          points={points}
          refLines={refLines}
          shade={[s.today - 1, s.today]}
          xTicks={ticks}
          height={260}
          maxGap={0.09}
          yFormat={(y) => y.toFixed(0)}
          tooltip={(p) => ({ value: `${p.y.toFixed(2)} mmHg`, title: `${(byX.get(p.x) ?? '').replace('T', ' ').slice(0, 16)} UTC, 1-hour mean` })}
          ariaLabel={`Cabin CO2 in mmHg, hourly, last ${CHART_DAYS} mission days, with the cabin's usual level and the 3 mmHg limit`}
        />
        <p className="fine">
          Hourly CO₂ partial pressure, mmHg, last {CHART_DAYS} mission days. The shaded span is the 24 h before today's check-in. Gaps are
          hours with no published data.
        </p>
        <details>
          <summary>Daily values as a table</summary>
          <table className="table">
            <thead>
              <tr>
                <th>Mission day</th>
                <th>Real date (UTC)</th>
                <th>24 h mean</th>
                <th>Highest 1-h avg</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Hours of data</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.date}</td>
                  <td>{mmHg(d.co2Mean, 2)}</td>
                  <td>{mmHg(d.co2Max1h, 2)}</td>
                  <td>{celsius(d.temp)}</td>
                  <td>{rhPercent(d.rh)}</td>
                  <td>{d.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      {/* After the chart: the real CO₂ trace stays right under the banner, and the steps follow the evidence. */}
      {decision.outcome === 'ship' && <WhatNow alertDay={r.shipEpisodeDay} causes={decision.causes} />}
      <Card title="Cabin temperature and humidity">
        <div className="stats">
          <Stat
            label="Temperature, 24 h"
            tone={cabin.temp.overLimit ? 'alert' : cabin.temp.outside ? 'watch' : undefined}
            value={celsius(cabin.temp.value)}
            note={`NASA comfort range ${RULES.tempComfortC[0]}–${RULES.tempComfortC[1]} °C`}
          />
          <Stat
            label="Humidity, 24 h"
            tone={cabin.rh.overLimit ? 'alert' : cabin.rh.outside ? 'watch' : undefined}
            value={rhPercent(cabin.rh.value)}
            note={`NASA comfort range ${RULES.rhComfortPct[0]}–${RULES.rhComfortPct[1]}%`}
          />
          {allDays > 0 && (
            <Stat
              label={`${traces.length} ISS missions, ${allDays} days`}
              value={`${offDays('temp')} days`}
              note={`temperature outside the comfort range; humidity on ${offDays('rh') || 'no'} days; CO₂ a suspect on ${offDays('co2')}`}
            />
          )}
        </div>
      </Card>

      <RadiationCard />
    </div>
  )
}
