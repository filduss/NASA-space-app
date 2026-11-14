import { cmoInbox, type CmoItem } from '../engine/privacy.ts'
import { SPEC } from '../engine/deviation.ts'
import type { SurgeonSummary } from '../engine/types.ts'
import { clearTheAirQuest, questProgress } from '../game/quests.ts'
import { useStore } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import { fmt, indicatorLineThird, list, mmHg, symptomLabel } from './text.ts'

function CmoLine({ item }: { item: CmoItem }) {
  const s = useStore()
  const labels = list(item.indicators.map((k) => SPEC[k].label.toLowerCase()))
  switch (item.kind) {
    case 'safety':
      return (
        <li>
          <Mark tone="alert">
            {s.nameOf(item.crewId as string)} asked to talk to someone now. Reach them privately. The flight surgeon has been sent a message.
          </Mark>
        </li>
      )
    case 'ship':
      return (
        <li>
          <Mark tone="watch">
            Ship alert: {item.count} of {item.of} crew show CO₂-linked changes{labels ? ` (${labels})` : ''}.
          </Mark>
        </li>
      )
    case 'shared_pattern':
      return (
        <li>
          <Mark tone="watch">
            A shared pattern that is not the air: {item.count} of {item.of} crew are off their usual ({labels}). No names are given.
          </Mark>
        </li>
      )
    case 'persistent':
      return (
        <li>
          <Mark tone="watch">
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
          <p className="muted">Nothing needs you today. Private Watch cards stay with the person unless they share them.</p>
        )}
      </Card>
      <Card title="Sleep and symptoms today">
        <div className="scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Crew</th>
                <th>Sleep</th>
                <th>Sleep quality</th>
                <th>Symptoms</th>
                <th>Mood and stress</th>
              </tr>
            </thead>
            <tbody>
              {s.data.crew.crew.map((c) => {
                const p = r.people[c.id]
                const a = p.assessment
                const shared = s.local.shareWatch[c.id] === true
                return (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    {a.checkedIn ? (
                      <>
                        <td>{fmt('sleepHours', a.indicators.sleepHours.value)}</td>
                        <td>{fmt('sleepQuality', a.indicators.sleepQuality.value)}</td>
                        <td>{a.safety ? 'none shown' : a.symptoms.map(symptomLabel).join(', ') || 'none'}</td>
                        <td>
                          {shared
                            ? `mood ${fmt('mood', a.indicators.mood.value)}, stress ${fmt('stress', a.indicators.stress.value)}`
                            : 'private (not shared)'}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4}>no check-in today</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">You see sleep and symptoms for everyone. Mood and stress appear only when the person shares them.</p>
      </Card>
    </div>
  )
}

function SummaryDoc({ sum }: { sum: SurgeonSummary }) {
  const s = useStore()
  const name = sum.crewId ? s.nameOf(sum.crewId) : ''
  const cabinLine = sum.cabin.hasData
    ? `Cabin CO₂ ${mmHg(sum.cabin.co2Mean)} over 24 h (usual ${mmHg(sum.cabin.baseline)}), highest 1-hour average ${mmHg(sum.cabin.co2Max1h)}${sum.cabin.aboveLimit ? ', above the 3 mmHg limit' : ''}.`
    : 'No usable cabin CO₂ data for this day.'
  const title =
    sum.kind === 'ship' ? `Ship alert, day ${sum.episodeDay} of the alert` : sum.kind === 'safety' ? `Safety answer: ${name}` : `${name}: off own usual for ${sum.episodeDay} days`
  let quest: string | null = null
  if (sum.kind === 'ship') {
    const start = sum.day - sum.episodeDay + 1
    // Only steps that were done by the time this summary was sent.
    const q = clearTheAirQuest(start)
    const asSent = Object.fromEntries(Object.entries(s.local.questLog[q.id] ?? {}).filter(([, v]) => v.day <= sum.day))
    const p = questProgress(q, { [q.id]: asSent })
    quest = `Crew quest "Clear the air": ${p.done} of ${p.total} steps done.`
  }
  return (
    <article className="doc">
      <header>
        <h3>{title}</h3>
        <p className="fine">
          Sent mission day {sum.day} at check-in · {sum.immediate ? 'sent immediately' : 'day-3 summary'} · received on Earth {s.commDelayMin} min
          later
        </p>
      </header>
      {sum.kind === 'ship' && (
        <>
          <p>{cabinLine}</p>
          <p>
            {sum.affected?.length
              ? `${sum.affected.length} crew with CO₂-linked changes today: ${list(sum.affected.map(s.nameOf))}.`
              : 'No crew member shows CO₂-linked changes today; the alert is held because the cabin is still above its baseline.'}{' '}
            Likely cause by the ship-or-me rule: cabin air.
          </p>
          {quest && <p>{quest}</p>}
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
      {sum.kind === 'safety' && (
        <>
          <p>{name} ticked "I am not safe, or I need to talk to someone now" at check-in. The crew medical officer was told at the same time.</p>
          <p className="fine">The game is paused for {name}. Nothing is shown on the crew board.</p>
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
          replace it. Messages arrive {s.commDelayMin} minutes after they are sent.
        </p>
        {s.summaries.length === 0 && <p>Nothing has been sent up to mission day {s.today}.</p>}
      </Card>
      {s.summaries.map((sum) => (
        <SummaryDoc key={sum.id} sum={sum} />
      ))}
    </div>
  )
}
