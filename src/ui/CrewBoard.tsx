import { boardPerson, privateCount } from '../engine/privacy.ts'
import type { DayResult } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { Body } from './Body.tsx'
import { QuestCard } from './QuestCard.tsx'
import { boardWords, mmHg } from './text.ts'
import { XpStrip } from './XpStrip.tsx'

export function ShipBanner({ r, onOpen }: { r: DayResult; onOpen?: () => void }) {
  const { cabin, decision } = r
  let tone: 'ok' | 'watch' | 'idle' = 'ok'
  let head = 'Cabin air is at its usual level'
  let body = `CO₂ ${mmHg(cabin.co2Mean)} over the last 24 h; usual ${mmHg(cabin.baseline)}.`
  if (decision.outcome === 'ship') {
    tone = 'watch'
    head = 'Likely the ship, not you'
    body = `Cabin CO₂ is ${mmHg(cabin.delta)} above its usual level and ${decision.driftingCo2.length} of ${decision.crewSize} crew show CO₂-linked changes today.`
    if (decision.held) body += ' The alert stays on until the air is back to normal.'
  } else if (!cabin.hasData) {
    tone = 'idle'
    head = 'No cabin air data for today'
    body = cabin.lastDataDay ? `Last usable reading: day ${cabin.lastDataDay}. The ship-or-me rule cannot check the air until data returns.` : 'The ship-or-me rule cannot check the air.'
  } else if (cabin.elevated) {
    tone = 'watch'
    head = 'Cabin CO₂ is above its usual level'
    body = `${mmHg(cabin.co2Mean)} against a usual ${mmHg(cabin.baseline)}. Fewer than half the crew show CO₂-linked changes, so this is not a ship alert.`
  } else if (cabin.aboveLimit) {
    head = 'Cabin air is near its usual level'
    body = `24 h mean ${mmHg(cabin.co2Mean)} (usual ${mmHg(cabin.baseline)}), but a 1-hour average reached ${mmHg(cabin.co2Max1h)}, above the 3 mmHg limit.`
    tone = 'watch'
  }
  return (
    <section className={`banner banner-${tone}`}>
      <div>
        <h2>
          <Mark tone={tone}>{head}</Mark>
        </h2>
        <p>{body}</p>
        <Origin kind="real">ISS telemetry, NASA OSDR · {cabin.hours} of 24 h of data for day {r.day}</Origin>
      </div>
      {onOpen && (
        <button type="button" className="btn" onClick={onOpen}>
          {decision.outcome === 'ship' ? 'Why, and what to do' : 'Cabin air'}
        </button>
      )}
    </section>
  )
}

export function CrewBoard() {
  const s = useStore()
  const r = s.todayResult
  const me = s.role.kind === 'crew' ? s.role.crewId : null
  const priv = privateCount(r)
  const shields = s.data.crew.shieldDays.filter((d) => d.day === s.today)

  return (
    <div className="stack">
      <ShipBanner r={r} onOpen={() => s.setScreen('ship')} />

      <Card title={`Crew, mission day ${s.today}`} aside={<Origin kind="simulated">shared indicators only</Origin>}>
        <div className="crew">
          {s.data.crew.crew.map((c) => {
            const p = boardPerson(r.people[c.id])
            const words = boardWords(p.off, p.symptoms)
            const shield = shields.find((d) => d.crewIds.includes(c.id))
            return (
              <article key={c.id} className={`person${me === c.id ? ' person-me' : ''}`}>
                <Body
                  zones={words.map((w) => w.zone)}
                  absent={!p.checkedIn}
                  label={`${c.name}: ${p.checkedIn ? (words.length ? words.map((w) => w.word).join(', ') : 'OK') : 'no check-in today'}`}
                />
                <h3>
                  {c.name}
                  {me === c.id && <span className="you"> (you)</span>}
                </h3>
                {!p.checkedIn ? (
                  <Mark tone="idle">{shield ? `${shield.label} day, shielded` : 'No check-in yet'}</Mark>
                ) : words.length === 0 ? (
                  <Mark tone="ok">OK</Mark>
                ) : (
                  <ul className="words">
                    {words.map((w) => (
                      <li key={w.word}>
                        <Mark tone="watch">{w.word}</Mark>
                      </li>
                    ))}
                  </ul>
                )}
                {p.shipAffected && <p className="fine">Likely the ship</p>}
                {p.live && <Origin kind="live">entered in this browser</Origin>}
              </article>
            )
          })}
        </div>
        <p className="private-count">
          <span aria-hidden="true">🔒</span> Mood and stress: {priv.off} of {priv.of} crew are off their own usual today. Counts only, never names.
        </p>
      </Card>

      <QuestCard />
      <XpStrip crewId={me} />
    </div>
  )
}
