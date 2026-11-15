import { RULES } from '../engine/config.ts'
import { cabinLevel } from '../dashboard/model.ts'
import { boardPerson, privateCount, shipFollowUp, type ShipFollowUp } from '../engine/privacy.ts'
import type { DayResult } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { CrewTimeline } from './CrewTimeline.tsx'
import { boardWords, mmHg } from './text.ts'

export function ShipBanner({ r, onOpen, followUp }: { r: DayResult; onOpen?: () => void; followUp?: ShipFollowUp | null }) {
  const { cabin, decision } = r
  // Orange or red follows the same cabin level as the personal dashboard.
  const level = cabinLevel(cabin)
  let tone: 'ok' | 'watch' | 'alert' | 'idle' = level
  let head = 'Cabin air is at its usual level'
  let body = `CO₂ ${mmHg(cabin.co2Mean)} over the last 24 h; usual ${mmHg(cabin.baseline)}.`
  if (decision.outcome === 'ship') {
    head = 'Likely the ship, not you'
    const air = cabin.elevated
      ? `Cabin CO₂ is ${mmHg(cabin.delta)} above its usual level`
      : `Cabin CO₂ is ${mmHg(cabin.co2Mean)} over 24 h, above NASA's ${RULES.co2LimitMmHg} mmHg limit`
    body = `${air} and ${decision.driftingCo2.length} of ${decision.crewSize} crew show CO₂-linked changes today.`
    if (decision.held) body += ' The alert stays on until the air is back to normal.'
  } else if (!cabin.hasData) {
    tone = 'idle'
    head = 'No cabin air data for today'
    body = cabin.lastDataDay ? `Last usable reading: day ${cabin.lastDataDay}. The ship-or-me rule cannot check the air until data returns.` : 'The ship-or-me rule cannot check the air.'
  } else if (cabin.elevated) {
    head = 'Cabin CO₂ is above its usual level'
    body = `${mmHg(cabin.co2Mean)} against a usual ${mmHg(cabin.baseline)}. Fewer than half the crew show CO₂-linked changes, so this is not a ship alert.`
  } else if (cabin.overLimit) {
    head = `Cabin CO₂ is above NASA's ${RULES.co2LimitMmHg} mmHg limit`
    body = `${mmHg(cabin.co2Mean)} over 24 h, even though that has become its usual level. Fewer than half the crew show CO₂-linked changes, so this is not a ship alert.`
  } else if (cabin.aboveLimit) {
    head = 'Cabin air is near its usual level'
    body = `24 h mean ${mmHg(cabin.co2Mean)} (usual ${mmHg(cabin.baseline)}), but a 1-hour average reached ${mmHg(cabin.co2Max1h)}, above the 3 mmHg limit.`
  }
  if (followUp && decision.outcome !== 'ship') {
    const off = followUp.stillOff
    body += ` After the ship alert of days ${followUp.alertStart}–${followUp.alertEnd}: ${followUp.recovered} of ${followUp.affected} crew who felt it are back to their usual${off ? `, and ${off === 1 ? '1 person still off has' : `${off} people still off have`} been told privately` : ''}.`
  }
  return (
    <section className={`banner banner-${tone}`}>
      <div className="banner-text">
        <h2>
          <Mark tone={tone}>{head}</Mark>
        </h2>
        <p>{body}</p>
        <Origin kind="real">ISS telemetry, NASA OSDR · {cabin.hours} of 24 h of data for day {r.day}</Origin>
      </div>
      {onOpen && (
        <button type="button" className={tone === 'ok' || tone === 'idle' ? 'btn' : 'btn btn-primary'} onClick={onOpen}>
          {decision.outcome === 'ship' ? 'Why the app says this' : 'Cabin air'}
        </button>
      )}
    </section>
  )
}

/** Today's board for a crew member: shared indicators for everyone, today only, as before. */
function TodayOnBoard({ me }: { me: string }) {
  const s = useStore()
  const r = s.todayResult
  return (
    <section className="today" aria-label="Today on the crew board">
      <h3>Today on the board</h3>
      <ul>
        {s.data.crew.crew.map((c) => {
          const p = boardPerson(r.people[c.id])
          const words = boardWords(p.off, p.symptoms)
          return (
            <li key={c.id} className={p.checkedIn && words.length ? 'today-watch' : undefined}>
              <span className="tl-person">
                {c.name}
                {me === c.id && <span className="you"> (you)</span>}
              </span>
              <span className="today-words">
                {!p.checkedIn ? (
                  <Mark tone="idle">No check-in yet</Mark>
                ) : words.length === 0 ? (
                  <Mark tone="ok">OK</Mark>
                ) : (
                  <Mark tone="watch">{words.map((w) => w.word).join(', ')}</Mark>
                )}
                {p.shipAffected && <span className="fine"> · likely the ship</span>}
                {p.live && <Origin kind="live">entered in this browser</Origin>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function CrewBoard() {
  const s = useStore()
  const r = s.todayResult
  const me = s.role.kind === 'crew' ? s.role.crewId : null
  const priv = privateCount(r)

  return (
    <div className="stack">
      <ShipBanner r={r} onOpen={() => s.setScreen('ship')} followUp={shipFollowUp(s.results)} />

      <Card
        title="Crew timeline, last 14 days"
        aside={<Origin kind="simulated">crew · shared indicators only</Origin>}
      >
        {me && <p className="muted">You see the cabin air, how many crew drift, and your own row. Nobody else's history is shown to you.</p>}
        <CrewTimeline viewer={s.role} />
        {me && <TodayOnBoard me={me} />}
        <p className="private-count">
          <span aria-hidden="true">🔒</span> Mood and stress: {priv.off} of {priv.of} crew are off their own usual today. Counts only, never names.
        </p>
      </Card>

    </div>
  )
}
