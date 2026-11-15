import { useMemo } from 'react'
import { cabinLevel } from '../dashboard/model.ts'
import { RULES } from '../engine/config.ts'
import { shipFollowUp } from '../engine/privacy.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin, Stat } from './bits.tsx'
import { LineChart } from './charts.tsx'
import { ShipBanner } from './CrewBoard.tsx'
import { FollowUpCard } from './FollowUp.tsx'
import { RadiationCard } from './Radiation.tsx'
import { evidenceLine, list, mmHg } from './text.ts'

const CHART_DAYS = 14

/**
 * The steps while a ship alert is on. A fixed template: one thing for the crew to do, and what the app
 * does by itself. These are ours, not a NASA procedure, and the card says so.
 */
function WhatNow({ alertDay }: { alertDay: number }) {
  return (
    <Card title="What to do now" aside={<span className="count">day {alertDay} of the alert</span>}>
      <ol className="lines steps">
        <li>
          <strong>Check the air before anyone's health.</strong> Look at the CO₂ removal system and the airflow where people sleep and
          work, and compare a second sensor if there is one.
        </li>
        <li>
          <strong>Nobody is singled out.</strong> Each affected person's own dashboard already says "Likely the ship", so a bad day is not put down
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
  const needed = Math.ceil(decision.crewSize * RULES.crewShare)
  const affected = decision.driftingCo2.map(s.nameOf)
  const level = cabinLevel(cabin)
  const recent = s.data.cabin.daily.filter((d) => d.day <= s.today && d.day > s.today - CHART_DAYS)
  const followUp = shipFollowUp(s.results)
  const evidence = evidenceLine(s.data.backtest)

  return (
    <div className="stack">
      <ShipBanner r={r} />
      {followUp && <FollowUpCard f={followUp} />}
      {decision.outcome === 'ship' && <WhatNow alertDay={r.shipEpisodeDay} />}

      <Card title="Cabin CO₂" aside={<Origin kind="real">{meta.mission}, NASA OSDR</Origin>}>
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
                  <td>{d.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      <Card title="Why the app says this">
        <ol className="rule">
          <li className={cabin.elevated || cabin.overLimit ? 'rule-watch' : undefined}>
            <Mark tone={cabin.elevated || cabin.overLimit ? 'watch' : cabin.hasData ? 'ok' : 'idle'}>
              {!cabin.hasData
                ? 'No cabin data today: the air cannot be checked'
                : cabin.elevated
                  ? `Cabin CO₂ is above its own baseline (${mmHg(cabin.co2Mean)} against ${mmHg(cabin.baseline)})`
                  : cabin.overLimit
                    ? `Cabin CO₂ is at its own baseline, but its 24 h mean (${mmHg(cabin.co2Mean)}) is above the ${RULES.co2LimitMmHg} mmHg limit`
                    : `Cabin CO₂ is within its own baseline (${mmHg(cabin.co2Mean)} against ${mmHg(cabin.baseline)}) and its 24 h mean is under ${RULES.co2LimitMmHg} mmHg`}
            </Mark>
          </li>
          <li className={affected.length >= needed ? 'rule-watch' : undefined}>
            <Mark tone={affected.length >= needed ? 'watch' : 'ok'}>
              {affected.length} of {decision.crewSize} crew drift on CO₂-linked indicators today{affected.length ? ` (${list(affected)})` : ''}; the rule
              needs {needed}
            </Mark>
          </li>
          <li className={decision.outcome === 'ship' ? 'rule-watch rule-verdict' : 'rule-verdict'}>
            <strong>
              {decision.outcome === 'ship'
                ? decision.held
                  ? 'Ship alert still on: it was raised earlier and the cabin is still above baseline.'
                  : 'Both hold, so the likely cause is the ship.'
                : decision.outcome === 'shared'
                  ? 'Several people are off their usual, but the rule cannot blame the air. The crew medical officer gets the pattern, with no names.'
                  : decision.outcome === 'me'
                    ? 'One person is off their usual. That stays private to them.'
                    : 'No alert.'}
            </strong>
          </li>
        </ol>
        <ul className="lines">
          <li>CO₂-linked indicators are sleep, headache, fatigue and irritability. Mood and stress never count toward a ship alert.</li>
          <li>
            On the ISS, the odds of a reported headache doubled for each 1 mmHg of CO₂ (Law et al. 2014). NASA limits the 1-hour average to
            3 mmHg (NASA-STD-3001 Vol 2 [V2 6004]).
          </li>
          <li>
            The air is a suspect when it is above its own usual level, or when its 24 h mean is over 3 mmHg, so a cabin that stays high for
            weeks never counts as normal.
          </li>
          <li>Fluid shifts in microgravity cause headaches too, so one headache is never enough: the rule needs crew-wide timing and the CO₂ rise.</li>
          <li>This is a likely cause, re-checked at every check-in. It is not a diagnosis.</li>
        </ul>
        {evidence && (
          <p className="fine evidence-line">
            <Origin kind="simulated">crews</Origin> {evidence}
          </p>
        )}
      </Card>

      <RadiationCard />

      <Card title="Where the cabin data comes from" aside={<Origin kind="real" />}>
        <dl className="facts">
          <dt>Source</dt>
          <dd>
            <a href={meta.appUrl} target="_blank" rel="noreferrer">
              {meta.source}
            </a>
          </dd>
          <dt>Dataset</dt>
          <dd>
            <a href={meta.osdrLink} target="_blank" rel="noreferrer">
              {meta.mission}: {meta.missionTitle}
            </a>
            , ISS-side telemetry
          </dd>
          <dt>Snapshot</dt>
          <dd>
            fetched {meta.fetchedAt.slice(0, 10)} · SHA-256 <code>{meta.rawSha256.slice(0, 16)}…</code>
          </dd>
          <dt>Units</dt>
          <dd>{meta.conversion}</dd>
          <dt>Replay</dt>
          <dd>
            Real date {meta.replay.anchorDate} is shown as mission day {meta.replay.anchorMissionDay}. {meta.replay.note}
          </dd>
          <dt>Left out</dt>
          <dd>{meta.excluded}</dd>
          <dt>Caveat</dt>
          <dd>{meta.caveat}</dd>
          <dt>Data notes</dt>
          <dd>
            The rise starts as a step at exactly 00:00 UTC on 2018-08-20 (2.6 to 4.9 mmHg), steps down at 00:00 UTC the next day (4.9 to 4.3
            mmHg), and holds at 4.94 to 4.95 mmHg for several hours at a time. These may be artifacts of how the data was recorded or
            published, not changes in the cabin; the 1-hour peak that flags day 212 comes from them. The app replays the series as published
            and repairs nothing.
          </dd>
          <dt>Context</dt>
          <dd>
            Context, not cause: NASA's{' '}
            <a href="https://www.nasa.gov/blogs/stationreport/2018/08/16/iss-daily-summary-report-8-16-2018/" target="_blank" rel="noreferrer">
              ISS Daily Summary Report of 16 Aug 2018
            </a>
            , four days before this rise, describes a "split atmosphere" test of the Lab CO₂ removal assembly (CDRA), planned to last at least 5
            days. NASA's reports don't say whether the two are linked.
          </dd>
        </dl>
      </Card>
    </div>
  )
}
