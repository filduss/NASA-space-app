import type { BacktestScenario } from '../data/types.ts'
import { XP } from '../game/xp.ts'
import { useStore } from '../state.tsx'
import { Card, Origin } from './bits.tsx'

// Two 20-second explainers (more are a "Next" item). Reading one earns XP once.
const CARDS = [
  {
    id: 'reaction-test',
    title: 'Why a reaction test?',
    body: [
      'Sleep loss slows you down before you feel it. A reaction test catches that: you wait, a signal appears, you respond, and your speed is compared with your own usual.',
      'NASA flew a 3-minute version on the ISS as the Reaction Self Test. In that study, nights under 6 hours were linked to slower responses and higher stress.',
      'Here the test runs 30 seconds and browser timing adds lag, so treat your number as an estimate.',
    ],
    sources: ['NASA Spinoff 2013: PVT-B, flown as the ISS Reaction Self-Test', 'Sleep deficiency in spaceflight: the ISS Reaction Self Test study'],
  },
  {
    id: 'co2-and-sleep',
    title: 'How CO₂ and sleep affect you',
    body: [
      'A spacecraft cabin holds more CO₂ than air on Earth. On the ISS, the odds of a crew member reporting a headache doubled for each extra 1 mmHg of CO₂.',
      'Higher CO₂ has also been linked to poor sleep, fatigue and irritability. NASA limits the 1-hour average to 3 mmHg.',
      'That is why this app checks the air before it asks about you. There is no good evidence that CO₂ changes mood, so mood never counts toward a ship alert.',
    ],
    sources: ['Law et al. 2014, ISS CO₂ levels and reported headaches', 'NASA OCHMO-TB-004 / NASA-STD-3001 Vol 2 [V2 6004]'],
  },
]

const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`)
const perDays = (rate: number) => (rate > 0 ? `1 per ${Math.round(1 / rate)} days` : 'none')

function EvidenceRow({ sc }: { sc: BacktestScenario }) {
  return (
    <tr>
      <th scope="row">{sc.name}</th>
      <td>{pct(sc.shipOrMeAccuracy)}</td>
      <td>{sc.ship.delayDaysMedian ?? 'n/a'} d</td>
      <td>{pct(sc.ship.missedShare)}</td>
      <td>{pct(sc.individual.missedShare)}</td>
      <td>{perDays(sc.falseAlarms.shipPerCrewDay)}</td>
      <td>{perDays(sc.falseAlarms.surgeonSummaryPerCrewDay)}</td>
    </tr>
  )
}

export function LearnCards() {
  const s = useStore()
  const me = s.role.kind === 'crew' ? s.role.crewId : null
  const bt = s.data.backtest
  const base = bt?.scenarios[0]
  return (
    <div className="stack">
      {CARDS.map((card) => {
        const read = me !== null && s.local.events.some((e) => e.type === 'learn' && e.crewId === me && e.ref === card.id)
        return (
          <Card key={card.id} title={card.title} aside={<span className="fine">20-second read</span>}>
            {card.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="fine">Sources: {card.sources.join('; ')}. Links in docs/CITATIONS.md.</p>
            {me && (
              <button
                type="button"
                className="btn btn-quiet"
                disabled={read}
                onClick={() => s.addEvent({ type: 'learn', crewId: me, day: s.today, ref: card.id })}
              >
                {read ? `Read · +${XP.learn} XP earned` : `Mark as read · +${XP.learn} XP`}
              </button>
            )}
          </Card>
        )
      })}

      <Card title="Does the rule work? Measured on simulated crews" aside={<Origin kind="simulated">crews</Origin>}>
        {bt && base ? (
          <>
            <p>
              {bt.meta.crews} simulated crews of {bt.meta.crewSize} lived through {Object.keys(bt.meta.traces).length} real ISS CO₂ traces (
              {base.crewDays.toLocaleString('en-US')} crew-days). In the base case the rule named the right cause in{' '}
              <strong>{pct(base.shipOrMeAccuracy)}</strong> of alerts raised during an event, and missed{' '}
              <strong>{pct(base.ship.missedShareRise2Plus)}</strong> of CO₂ rises of 2 mmHg or more ({pct(base.ship.missedShare)} of all rises
              from 1 mmHg).
            </p>
            <div className="scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Right cause</th>
                    <th>Ship alert delay (median)</th>
                    <th>CO₂ rises missed</th>
                    <th>Personal events missed</th>
                    <th>False ship alerts</th>
                    <th>Needless surgeon summaries</th>
                  </tr>
                </thead>
                <tbody>
                  {bt.scenarios.map((sc) => (
                    <EvidenceRow key={sc.name} sc={sc} />
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>What these numbers mean, and their limits</summary>
              <dl className="facts">
                {Object.entries(bt.definitions).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="lines">
                {bt.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
                <li>
                  Only {base.ship.events / (bt.meta.crews / Object.keys(bt.meta.traces).length)} distinct CO₂ rises exist in the real traces; each
                  is replayed for many simulated crews.
                </li>
                <li>{bt.meta.tuning}</li>
              </ul>
            </details>
          </>
        ) : (
          <p className="muted">
            No backtest file found. Run <code>npm run data:backtest</code>.
          </p>
        )}
      </Card>
    </div>
  )
}
