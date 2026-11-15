import { useMemo } from 'react'
import { cabinLevel } from '../dashboard/model.ts'
import { RULES } from '../engine/config.ts'
import { shipFollowUp } from '../engine/privacy.ts'
import type { CabinFactor, CabinStatus } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin, RiskLinks, Stat } from './bits.tsx'
import { LineChart } from './charts.tsx'
import { ShipBanner } from './CrewBoard.tsx'
import { FollowUpCard } from './FollowUp.tsx'
import { QuestCard } from './QuestCard.tsx'
import { RadiationCard } from './Radiation.tsx'
import { causeWords, celsius, comfortLine, evidenceLine, FACTOR, list, mmHg, rhPercent } from './text.ts'

const CHART_DAYS = 14

/** "Cabin CO₂ is off and enough of the crew feel it, so the likely cause is the ship", and what that rules out. */
function shipVerdict(causes: CabinFactor[], cabin: CabinStatus): string {
  const named = causeWords(causes)
  const ruledOut = (['temp', 'rh'] as const).filter((f) => !causes.includes(f) && cabin[f].value !== null && !cabin[f].outside)
  const out = ruledOut.length
    ? ` ${capital(causeWords(ruledOut))} ${ruledOut.length > 1 ? 'are' : 'is'} inside NASA's comfort range, so ${ruledOut.length > 1 ? 'they are' : 'it is'} ruled out.`
    : ''
  return `${capital(named)} ${causes.length > 1 ? 'are' : 'is'} off and enough of the crew feel it, so the likely cause is the ship.${out}`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
  // Real days across every ISS trace in the backtest, from the engine's own cabin status.
  const traces = Object.values(s.data.backtest?.meta.traces ?? {}).flatMap((t) => (t.cabin ? [t.cabin] : []))
  const allDays = traces.reduce((n, t) => n + t.daysWithData, 0)
  const offDays = (f: 'co2' | 'temp' | 'rh') => traces.reduce((n, t) => n + t.suspectDays[f], 0)
  const airSuspects = cabin.suspects.filter((f) => f !== 'co2') as ('temp' | 'rh')[]

  return (
    <div className="stack">
      <ShipBanner r={r} />
      {followUp && <FollowUpCard f={followUp} />}

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

      <Card title="Cabin temperature and humidity" aside={<Origin kind="real">{meta.mission}, NASA OSDR</Origin>}>
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
        <p className="fine">
          From the same ISS telemetry as the CO₂. The comfort range is the one NASA's cabin standard cites for comfort and performance
          (NASA-STD-3001 Vol 2 [V2 6013]); outside 18–27 °C or 25–75% humidity is over its crew health limits ([V2 6012]). The rule blames the
          temperature only when half the crew sleep worse, and the humidity only when half the crew have a stuffy nose or dry, sore eyes. On
          the ISS, CO₂ is the factor that moves: across the missions above, humidity never left the comfort range.
        </p>
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
          {(['temp', 'rh'] as const).map((f) => (
            <li key={f} className={cabin[f].outside ? 'rule-watch' : undefined}>
              <Mark tone={cabin[f].outside ? 'watch' : cabin[f].value === null ? 'idle' : 'ok'}>
                Cabin {f === 'temp' ? 'temperature' : 'humidity'}: {comfortLine(f, cabin[f])}
              </Mark>
            </li>
          ))}
          <li className={affected.length >= needed ? 'rule-watch' : undefined}>
            <Mark tone={affected.length >= needed ? 'watch' : 'ok'}>
              {affected.length} of {decision.crewSize} crew drift on CO₂-linked indicators today{affected.length ? ` (${list(affected)})` : ''}; the rule
              needs {needed}
            </Mark>
          </li>
          {airSuspects.map((f) => {
            const who = decision.driftingOn[f].map(s.nameOf)
            return (
              <li key={f} className={who.length >= needed ? 'rule-watch' : undefined}>
                <Mark tone={who.length >= needed ? 'watch' : 'ok'}>
                  {who.length} of {decision.crewSize} crew show {FACTOR[f].feels} today{who.length ? ` (${list(who)})` : ''}; the rule needs {needed}
                </Mark>
              </li>
            )
          })}
          <li className={decision.outcome === 'ship' ? 'rule-watch rule-verdict' : 'rule-verdict'}>
            <strong>
              {decision.outcome === 'ship'
                ? decision.held
                  ? `Ship alert still on: it was raised earlier and ${causeWords(decision.causes)} is still off its usual.`
                  : shipVerdict(decision.causes, cabin)
                : decision.outcome === 'shared'
                  ? 'Several people are off their usual, but the rule cannot blame the air. The crew medical officer gets the pattern, with no names.'
                  : decision.outcome === 'me'
                    ? 'One person is off their usual. That stays private to them.'
                    : 'No alert.'}
            </strong>
          </li>
        </ol>
        <ul className="lines">
          <li>
            Each cabin factor has its own indicators: CO₂ headache, sleep, fatigue and irritability; temperature sleep; humidity a stuffy
            nose and dry or sore eyes. Mood and stress never count toward a ship alert.
          </li>
          <li>
            On the ISS, the odds of a reported headache doubled for each 1 mmHg of CO₂ (Law et al. 2014). NASA limits the 1-hour average to
            3 mmHg (NASA-STD-3001 Vol 2 [V2 6004]).
          </li>
          <li>
            From earlier missions, NASA reports headaches with fatigue and malaise at 2.8–4.5 mmHg, and fatigue, decreased sleep and nausea
            above 4.5 mmHg (OCHMO-TB-004). Its sleep risk names temperature among what disturbs sleep in space, and its cabin standard
            expects dry, stuffy, irritated eyes and nose outside the humidity range ([V2 6012]).
            <RiskLinks risks={['co2', 'sleep']} />
          </li>
          <li>
            CO₂ is a suspect when it is above its own usual level, or when its 24 h mean is over 3 mmHg, so a cabin that stays high for
            weeks never counts as normal. Temperature and humidity are suspects outside NASA's comfort range.
          </li>
          <li>
            Fluid shifts in microgravity cause headaches too (OCHMO-TB-004), so one headache is never enough: the rule needs crew-wide timing
            and the CO₂ rise.
          </li>
          <li>This is a likely cause, re-checked at every check-in. It is not a diagnosis.</li>
        </ul>
        {evidence && (
          <p className="fine evidence-line">
            <Origin kind="simulated">crews</Origin> {evidence}
          </p>
        )}
      </Card>

      {decision.outcome === 'ship' && <QuestCard />}

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
