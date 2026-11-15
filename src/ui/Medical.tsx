import { cabinLevel } from '../dashboard/model.ts'
import { boardPerson, cmoInbox, type CmoItem } from '../engine/privacy.ts'
import { RULES } from '../engine/config.ts'
import { SPEC } from '../engine/deviation.ts'
import type { CabinFactor, SurgeonSummary } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { checkInAt, houstonTime, shipTime } from './clock.ts'
import { airLine, causeWords, delayText, fmt, indicatorLineThird, list, mmHg, symptomLabel } from './text.ts'

/** "CO₂-linked changes", or the factors by name when the air behind the alert is not (only) CO₂. */
function changesFor(causes: CabinFactor[] | undefined): string {
  return !causes || (causes.length === 1 && causes[0] === 'co2') ? 'CO₂-linked changes' : `changes linked to ${causeWords(causes)}`
}

function CmoLine({ item }: { item: CmoItem }) {
  const s = useStore()
  const labels = list(item.indicators.map((k) => SPEC[k].label.toLowerCase()))
  switch (item.kind) {
    case 'urgent':
      return (
        <li className="inbox-alert">
          <Mark tone="alert">
            {s.nameOf(item.crewId as string)} asked for an urgent conference. Reach them privately now. The flight surgeon has been sent the request.
          </Mark>
        </li>
      )
    case 'ship':
      return (
        <li className="inbox-watch">
          <Mark tone="watch">
            Ship alert: {item.count} of {item.of} crew show {changesFor(item.causes)}
            {labels ? ` (${labels})` : ''}.
          </Mark>
        </li>
      )
    case 'shared_pattern':
      return (
        <li className="inbox-watch">
          <Mark tone="watch">
            A shared pattern that is not the air: {item.count} of {item.of} crew are off their usual ({labels}). No names are given.
          </Mark>
        </li>
      )
    case 'persistent':
      // Day 3 or later is red, as on the personal dashboard.
      return (
        <li className="inbox-alert">
          <Mark tone="alert">
            {s.nameOf(item.crewId as string)}: still off their usual on day 3 or later ({labels}). A summary has gone to the flight surgeon.
          </Mark>
        </li>
      )
    default:
      return (
        <li>
          <Mark tone="info">
            {s.nameOf(item.crewId as string)} chose to share a Watch with you{labels ? `: ${labels}` : ''}.
          </Mark>
        </li>
      )
  }
}

export function CmoInbox() {
  const s = useStore()
  const r = s.todayResult
  const items = cmoInbox(r, s.local.shareWatch)
  return (
    <div className="stack">
      <Card title={`Crew medical officer, day ${s.today}`} aside={<Origin kind="simulated" />}>
        {items.length ? (
          <ul className="inbox">
            {items.map((it, i) => (
              <CmoLine key={i} item={it} />
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing needs you today. A private Watch stays with the person: it reaches nobody else unless it lasts to day 3.</p>
        )}
      </Card>
      <Card title="Shared readings today">
        <div className="scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Crew</th>
                <th>Sleep</th>
                <th>Sleep quality</th>
                <th>Symptoms</th>
                <th>Off own usual</th>
                <th>Mood and stress</th>
              </tr>
            </thead>
            <tbody>
              {s.data.crew.crew.map((c) => {
                const p = r.people[c.id]
                const a = p.assessment
                const shared = s.local.shareWatch[c.id] === true
                // What an urgent conference request hides from the board is hidden here too.
                const board = boardPerson(p)
                const symptoms = board.symptoms
                // The reasons the alert above counts, per person: shared indicators only, as on the crew board.
                const off = board.off.map((k) => SPEC[k].label)
                return (
                  <tr key={c.id} className={a.checkedIn && off.length ? 'row-watch' : undefined}>
                    <th scope="row">{c.name}</th>
                    {a.checkedIn ? (
                      <>
                        <td>{fmt('sleepHours', a.indicators.sleepHours.value)}</td>
                        <td>{fmt('sleepQuality', a.indicators.sleepQuality.value)}</td>
                        <td>{p.conference === 'urgent' ? 'none shown' : symptoms.map(symptomLabel).join(', ') || 'none'}</td>
                        <td>{off.length ? <Mark tone="watch">{list(off)}</Mark> : 'nothing'}</td>
                        <td>
                          {shared
                            ? `mood ${fmt('mood', a.indicators.mood.value)}, stress ${fmt('stress', a.indicators.stress.value)}`
                            : 'private'}
                        </td>
                      </>
                    ) : (
                      <td colSpan={5}>no check-in today</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">You see what is shared for everyone: sleep, fatigue, irritability, alertness and symptoms. Mood and stress are private: the crew board gives only a count, with no names.</p>
      </Card>
    </div>
  )
}

/** Summaries go out on day 3 and then every 3 days while the cause lasts; the label says which this is. */
function summaryKind(sum: SurgeonSummary): string {
  if (sum.kind === 'ship') return `Ship summary, one every ${RULES.persistDays} days of an alert`
  return sum.episodeDay > RULES.persistDays ? `Follow-up summary, day ${sum.episodeDay}` : `Day-${RULES.persistDays} summary`
}

function SummaryDoc({ sum }: { sum: SurgeonSummary }) {
  const s = useStore()
  const name = sum.crewId ? s.nameOf(sum.crewId) : ''
  const sent = checkInAt(sum.day, s.data.cabin.meta.replay)
  const received = checkInAt(sum.day, s.data.cabin.meta.replay, s.commDelaySec)
  const cabinLine = sum.cabin.hasData
    ? `Cabin CO₂ ${mmHg(sum.cabin.co2Mean)} over 24 h${sum.cabin.overLimit ? ', above the 3 mmHg limit' : ''} (usual ${mmHg(sum.cabin.baseline)}), highest 1-hour average ${mmHg(sum.cabin.co2Max1h)}${sum.cabin.aboveLimit && !sum.cabin.overLimit ? ', above the 3 mmHg limit' : ''}. ${airLine(sum.cabin)}`
    : 'No usable cabin data for this day.'
  const title = {
    ship: `Ship alert, day ${sum.episodeDay} of the alert`,
    urgent: `Urgent conference request: ${name}`,
    conference: `Conference request: ${name}`,
    person: `${name}: off own usual for ${sum.episodeDay} days`,
  }[sum.kind]
  // A routine request is not a health alert: no orange or red.
  const tone = sum.kind === 'conference' ? '' : sum.kind === 'ship' && cabinLevel(sum.cabin) !== 'alert' ? ' doc-watch' : ' doc-alert'
  return (
    <article className={`doc${tone}`}>
      <header>
        <h3>{title}</h3>
        <p className="fine">
          {sum.kind === 'urgent' || sum.kind === 'conference' ? 'Request' : sum.immediate ? 'Sent immediately' : summaryKind(sum)}, sent mission day {sum.day} at {shipTime(sent)} ship time · received{' '}
          {delayText(s.commDelaySec)} later, <strong>{houstonTime(received)}</strong> ({shipTime(received)})
        </p>
      </header>
      {sum.kind === 'ship' && (
        <>
          <p>{cabinLine}</p>
          <p>
            {sum.affected?.length
              ? `${sum.affected.length} crew with ${changesFor(sum.causes)} today: ${list(sum.affected.map(s.nameOf))}.`
              : `No crew member shows ${changesFor(sum.causes)} today; the alert is held because ${causeWords(sum.causes ?? ['co2'])} is still off its usual.`}{' '}
            Likely cause by the ship-or-me rule: {causeWords(sum.causes ?? ['co2'])}.
          </p>
        </>
      )}
      {sum.kind === 'person' && (
        <>
          <ul className="lines">
            {sum.indicators.map((i) => (
              <li key={i.key}>
                {indicatorLineThird(i)}
                {i.key !== 'symptoms' && i.usual !== null ? ` (${fmt(i.key, i.value)}; usual ${fmt(i.key, i.usual)})` : ''}
              </li>
            ))}
          </ul>
          <p>
            {cabinLine}{' '}
            {sum.attribution === 'shared'
              ? 'Other crew were off their usual too, without a CO₂ rise: a shared pattern that is not the air.'
              : 'The rest of the crew is steady, so the likely cause is individual, not the cabin air.'}
          </p>
          <p className="fine">{name} has been told this summary was sent. Private readings appear here because this is a day-3 summary.</p>
        </>
      )}
      {sum.kind === 'urgent' && (
        <>
          <p>{name} asked for an urgent private medical conference. The crew medical officer on board was told at the same time.</p>
          <p className="fine">Nothing is shown on the crew board.</p>
        </>
      )}
      {sum.kind === 'conference' && (
        <>
          <p>{name} asked for a private medical conference at the next scheduled one.</p>
          <p className="fine">The request carries no readings. Nobody on board was told.</p>
        </>
      )}
    </article>
  )
}

export function SurgeonView() {
  const s = useStore()
  return (
    <div className="stack">
      <Card title="Flight-surgeon summaries" aside={<Origin kind="simulated">crew</Origin>}>
        <p className="muted">
          One page per event, written from fixed templates by the rules engine; no AI wording. It supports your judgement and does not
          replace it. Messages arrive {delayText(s.commDelaySec)} after they are sent.
        </p>
        {s.summaries.length === 0 && <p>Nothing has been sent up to mission day {s.today}.</p>}
      </Card>
      {s.summaries.map((sum) => (
        <SummaryDoc key={sum.id} sum={sum} />
      ))}
    </div>
  )
}
