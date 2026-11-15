import { RULES } from '../engine/config.ts'
import { airLevel, cabinLevel, worst } from '../dashboard/model.ts'
import { privateCount, shipFollowUp, type ShipFollowUp } from '../engine/privacy.ts'
import type { DayResult } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark } from './bits.tsx'
import { CrewTimeline } from './CrewTimeline.tsx'
import { celsius, comfortLine, FACTOR, mmHg, rhPercent } from './text.ts'

export function ShipBanner({ r, onOpen, followUp }: { r: DayResult; onOpen?: () => void; followUp?: ShipFollowUp | null }) {
  const { cabin, decision } = r
  // Orange or red follows the same cabin levels as the personal dashboard.
  const level = worst(cabinLevel(cabin), airLevel(cabin))
  const offAir = (['temp', 'rh'] as const).find((f) => cabin[f].outside)
  let tone: 'ok' | 'watch' | 'alert' | 'idle' = level
  let head = 'Cabin air is at its usual level'
  let body = `CO₂ ${mmHg(cabin.co2Mean)} over the last 24 h; usual ${mmHg(cabin.baseline)}. ${celsius(cabin.temp.value)} and ${rhPercent(cabin.rh.value)} humidity, inside NASA's comfort range.`
  if (decision.outcome === 'ship') {
    head = 'Likely the ship, not you'
    const parts = decision.causes.map((f) => {
      const n = `${decision.driftingOn[f].length} of ${decision.crewSize} crew`
      if (f === 'co2') {
        const air = cabin.elevated
          ? `Cabin CO₂ is ${mmHg(cabin.delta)} above its usual level`
          : `Cabin CO₂ is ${mmHg(cabin.co2Mean)} over 24 h, above NASA's ${RULES.co2LimitMmHg} mmHg limit`
        return `${air} and ${n} show CO₂-linked changes today`
      }
      return `The cabin ${f === 'temp' ? 'temperature' : 'humidity'} is ${comfortLine(f, cabin[f])}, and ${n} show ${FACTOR[f].feels} today`
    })
    body = `${parts.join('; ')}.`
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
  } else if (offAir) {
    head = `Cabin ${offAir === 'temp' ? 'temperature' : 'humidity'} is outside NASA's comfort range`
    body = `${comfortLine(offAir, cabin[offAir])}. Fewer than half the crew show ${FACTOR[offAir].feels}, so this is not a ship alert.`
  } else if (cabin.aboveLimit) {
    head = 'Cabin air is near its usual level'
    body = `24 h mean ${mmHg(cabin.co2Mean)} (usual ${mmHg(cabin.baseline)}), but a 1-hour average reached ${mmHg(cabin.co2Max1h)}, above the 3 mmHg limit.`
  }
  if (followUp && decision.outcome !== 'ship') {
    const off = followUp.stillOff
    body += ` After the ship alert of days ${followUp.alertStart}–${followUp.alertEnd}: ${followUp.recovered} of ${followUp.affected} crew who felt it are back to their usual${off ? `, and ${off === 1 ? '1 person still off has' : `${off} people still off have`} been told privately` : ''}.`
  }
  return (
    <section className={`banner banner-${tone}`} data-tour="ship-answer">
      <div className="banner-text">
        <h2>
          <Mark tone={tone}>{head}</Mark>
        </h2>
        <p>{body}</p>
      </div>
      {onOpen && (
        <button type="button" className={tone === 'ok' || tone === 'idle' ? 'btn' : 'btn btn-primary'} onClick={onOpen}>
          Cabin air
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
        tour="timeline"
      >
        <CrewTimeline viewer={s.role} />
        <p className="private-count" data-tour="private">
          <span aria-hidden="true">🔒</span> Mood and stress: {priv.off} of {priv.of} crew are off their own usual today. Counts only, never names.
        </p>
      </Card>
    </div>
  )
}
