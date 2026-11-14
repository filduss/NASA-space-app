import { RULES } from '../engine/config.ts'
import { INDICATORS } from '../engine/deviation.ts'
import type { IndicatorKey, PersonStatus } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { LineChart } from './charts.tsx'
import { delayText, fmt, indicatorLine } from './text.ts'
import { XpStrip } from './XpStrip.tsx'

const TREND_DAYS = 28

function chartValue(key: IndicatorKey, v: number): number {
  // Alertness is charted as reaction time in ms (lower is faster), the unit people know.
  return key === 'reaction' ? 1000 / v : v
}

function StatusCard({ me }: { me: PersonStatus }) {
  const s = useStore()
  const a = me.assessment
  const shared = s.local.shareWatch[me.crewId] === true
  const sentToday = s.todayResult.summaries.find((x) => x.crewId === me.crewId)

  if (!a.checkedIn) {
    return (
      <Card title="No check-in yet today">
        <p className="muted">Your trends below run up to your last check-in.</p>
        <button type="button" className="btn btn-primary" onClick={() => s.setScreen('checkin')}>
          Check in
        </button>
      </Card>
    )
  }
  if (a.safety) {
    return (
      <Card title="You asked to talk to someone" tone="alert">
        <p>Your crew medical officer was told privately as soon as you checked in, and a message is on its way to the flight surgeon ({delayText(s.commDelaySec)} to Earth).</p>
        <p className="muted">Nothing about this is on the crew board. The game is paused for you today.</p>
      </Card>
    )
  }
  if (me.attribution === 'none') {
    return (
      <Card title={<Mark tone="ok">Within your normal</Mark>}>
        <p className="muted">Everything you logged today sits inside your own usual range.</p>
      </Card>
    )
  }
  const lines = a.off.map((k) => indicatorLine(a.indicators[k], a.symptoms))
  return (
    <Card
      tone="watch"
      title={<Mark tone="watch">{me.attribution === 'ship' ? 'Likely the ship, not you' : 'Watch: something is off your usual'}</Mark>}
      aside={<span className="fine">🔒 Only you see this card</span>}
    >
      <ul className="lines">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {me.attribution === 'ship' && (
        <p>
          Most of the crew show the same kind of change while cabin CO₂ is above its usual level.{' '}
          <button type="button" className="link" onClick={() => s.setScreen('ship')}>
            See the ship alert
          </button>
        </p>
      )}
      {me.attribution === 'me' && (
        <p>
          {s.todayResult.cabin.hasData
            ? s.todayResult.cabin.elevated || s.todayResult.cabin.overLimit
              ? `Cabin CO₂ is ${s.todayResult.cabin.elevated ? 'above its usual level' : `above the ${RULES.co2LimitMmHg} mmHg limit`}, but you are the only one showing a change, so the rule does not blame the air yet.`
              : 'The cabin air is at its usual level and the rest of the crew is steady, so this is likely about you, not the ship.'
            : 'There is no cabin data today, so the air could not be checked.'}
        </p>
      )}
      {me.attribution === 'shared' && (
        <p>Others are off their usual today too, but the rule cannot blame the air. The crew medical officer sees that a pattern exists, without names.</p>
      )}
      {me.attribution !== 'ship' && (
        <>
          <p className="muted">
            A self-care idea, not an instruction: protect tonight's sleep window, and say so if you want cover on tomorrow's schedule. This is
            re-checked at your next check-in.
          </p>
          {me.tier >= 3 ? (
            <p className="notice">
              Day {me.episodeDay} off your usual.{' '}
              {sentToday
                ? `A summary was sent to the flight surgeon today; it reaches Earth after ${delayText(s.commDelaySec)}.`
                : `A summary went to the flight surgeon on day ${RULES.persistDays} of this; the crew medical officer can see your shared indicators.`}
            </p>
          ) : (
            <p className="fine">
              Day {me.episodeDay}. If this is still off on day {RULES.persistDays}, a summary goes to the flight surgeon and you are told.
            </p>
          )}
          <label className="tick">
            <input type="checkbox" checked={shared} onChange={() => s.toggleShare(me.crewId)} />
            <span>Share my private cards, mood and stress with the crew medical officer</span>
          </label>
        </>
      )}
    </Card>
  )
}

export function MeView({ crewId }: { crewId: string }) {
  const s = useStore()
  const me = s.todayResult.people[crewId]
  const from = s.today - TREND_DAYS + 1
  const history = s.results.filter((r) => r.day >= from)
  const lastIn = [...s.checkIns].filter((c) => c.crewId === crewId).sort((a, b) => b.day - a.day)[0]
  const ticks = [from, from + 9, from + 18, s.today].map((d) => ({ x: d, label: `${d}` }))

  return (
    <div className="stack">
      <StatusCard me={me} />
      <XpStrip crewId={crewId} />
      <Card
        title="My trends against my own normal"
        aside={
          <Origin kind={lastIn && !lastIn.simulated ? 'live' : 'simulated'}>
            last check-in day {lastIn?.day ?? 'n/a'}
          </Origin>
        }
      >
        <p className="muted">
          The band is your usual range from your own last {RULES.baselineWindowDays} normal days. ▲ marks a day outside it in the unwanted
          direction. Last {TREND_DAYS} days.
        </p>
        <div className="trends">
          {INDICATORS.filter((i) => i.key !== 'symptoms').map((spec) => {
            const pts = history.map((r) => {
              const v = r.people[crewId].assessment.indicators[spec.key].value
              return { x: r.day, y: v === null ? null : chartValue(spec.key, v) }
            })
            const band = history.flatMap((r) => {
              const b = r.people[crewId].assessment.indicators[spec.key].baseline
              if (!b) return []
              const lo = b.median - RULES.driftZ * b.spread
              const hi = b.median + RULES.driftZ * b.spread
              const a = chartValue(spec.key, lo > 0 ? lo : 0.1)
              const z = chartValue(spec.key, hi)
              return [{ x: r.day, lo: Math.min(a, z), hi: Math.max(a, z) }]
            })
            const marks = history.flatMap((r) => {
              const ind = r.people[crewId].assessment.indicators[spec.key]
              return ind.off && ind.value !== null ? [{ x: r.day, y: chartValue(spec.key, ind.value) }] : []
            })
            const today = me.assessment.indicators[spec.key]
            const isMs = spec.key === 'reaction'
            const domain: [number, number] | undefined = isMs ? undefined : spec.key === 'sleepHours' ? [3, 10] : [0, 10]
            return (
              <figure className="trend" key={spec.key}>
                <figcaption>
                  <span>
                    {spec.label}
                    {spec.privacy === 'private' && <span className="lock"> 🔒 private</span>}
                  </span>
                  <strong>{fmt(spec.key, today.value)}</strong>
                </figcaption>
                <LineChart
                  points={pts}
                  band={band}
                  marks={marks}
                  xTicks={ticks}
                  yDomain={domain}
                  height={130}
                  yFormat={(y) => `${Math.round(y)}`}
                  tooltip={(p) => ({ title: `Day ${p.x}`, value: isMs ? `${Math.round(p.y)} ms` : spec.key === 'sleepHours' ? `${p.y.toFixed(1)} h` : `${p.y}/10` })}
                  ariaLabel={`${spec.label}, last ${TREND_DAYS} days, with your usual range`}
                />
                <p className="fine">
                  {today.baseline
                    ? `Your usual: about ${fmt(spec.key, today.baseline.median)}`
                    : today.reason === 'not_measured'
                      ? 'Not measured today'
                      : 'No baseline yet'}
                </p>
              </figure>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
