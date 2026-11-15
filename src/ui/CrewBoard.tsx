import { RULES } from '../engine/config.ts'
import { cabinLevel } from '../dashboard/model.ts'
import { privateCount, shipFollowUp, type ShipFollowUp } from '../engine/privacy.ts'
import type { DayResult } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { CrewTimeline } from './CrewTimeline.tsx'
import { QuestCard } from './QuestCard.tsx'
import { mmHg } from './text.ts'
import { XpStrip } from './XpStrip.tsx'

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
          {decision.outcome === 'ship' ? 'Why, and what to do' : 'Cabin air'}
        </button>
      )}
    </section>
  )
}

export function CrewBoard() {
  const s = useStore()
  const r = s.todayResult
  const priv = privateCount(r)

  return (
    <div className="stack">
      <ShipBanner r={r} onOpen={() => s.setScreen('ship')} followUp={shipFollowUp(s.results)} />

      <Card
        title="Crew timeline, last 14 days"
        aside={<Origin kind="simulated">crew · shared indicators only</Origin>}
      >
        <CrewTimeline viewer={s.role} />
        <p className="private-count">
          <span aria-hidden="true">🔒</span> Mood and stress: {priv.off} of {priv.of} crew are off their own usual today. Counts only, never names.
        </p>
      </Card>

      <QuestCard />
      <XpStrip crewId={null} />
    </div>
  )
}
