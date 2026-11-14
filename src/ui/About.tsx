import type { BacktestScenario } from '../data/types.ts'
import { useStore, type Screen } from '../state.tsx'
import { Card, Origin } from './bits.tsx'

// For judges and visitors: where the demo answers each of the challenge's five questions, the evidence
// that the rule works, and how the same rule carries over to an Antarctic winter station.

type Store = ReturnType<typeof useStore>

// Golden-path days (see RoleSwitcher): the ship alert opens on 213, Chen's day-3 summary goes on 223.
const SHIP_DAY = 213
const DAY_THREE = 223

function asCrew(s: Store, screen: Screen) {
  s.setRole({ kind: 'crew', crewId: s.data.crew.crew[0].id })
  s.setScreen(screen)
}
// The flight surgeon has no Ship tab, so that view switches to a crew member first.
const toShip = (s: Store) => (s.role.kind === 'surgeon' ? asCrew(s, 'ship') : s.setScreen('ship'))

const QUESTIONS: { q: string; a: string; jump: string; go: (s: Store) => void }[] = [
  {
    q: 'Which measurements can be performed in space?',
    a: "A morning check-in: sliders for sleep, fatigue, irritability, stress and mood, symptom ticks, and a 30-second reaction test (a short version of the ISS Reaction Self-Test). The ship's sensors add cabin CO₂.",
    jump: 'Open the check-in',
    go: (s) => asCrew(s, 'checkin'),
  },
  {
    q: 'Why is an exam needed?',
    a: 'Every check-in item says why it is asked. Each reading is compared with that person\'s own normal rather than a population range, because people differ and spaceflight changes the body.',
    jump: 'Open the check-in',
    go: (s) => asCrew(s, 'checkin'),
  },
  {
    q: 'How do spaceflight hazards affect these indicators?',
    a: 'Closed environment: cabin CO₂ is linked to headaches, poor sleep and fatigue. Space radiation: a dose budget against NASA\'s career limit. Distance from Earth: the mission setting sets the delay to the flight surgeon. Gravity: microgravity fluid shifts cause headaches too, so one headache never blames the air. Isolation: mood and stress are tracked privately.',
    jump: 'Open the Ship screen',
    go: toShip,
  },
  {
    q: 'When does a result need the crew or the flight surgeon?',
    a: 'One day off your own normal: a private card (tier 1). A ship alert or a crew-wide pattern: the crew medical officer (tier 2). Still off on day 3: a summary to the flight surgeon, sent with the comm delay (tier 3). A safety answer: both, at once (tier 4).',
    jump: `See the flight surgeon's summaries on day ${DAY_THREE}`,
    go: (s) => {
      s.setToday(DAY_THREE)
      s.setRole({ kind: 'surgeon' })
    },
  },
  {
    q: 'What actions can prevent a critical condition?',
    a: 'A ship alert opens the crew quest "Clear the air", and afterwards the app re-checks whether the air and the crew recovered. A private card carries a self-care idea. The radiation card says when to go to the storm shelter. Anything still off on day 3 reaches the flight surgeon.',
    jump: `See day ${SHIP_DAY} on the Ship screen`,
    go: (s) => {
      s.setToday(SHIP_DAY)
      toShip(s)
    },
  },
]

function ChallengeMap() {
  const s = useStore()
  return (
    <Card title="How Shipshape answers the challenge">
      <p className="muted">The challenge asks five questions. Each one is answered somewhere in this demo; the button takes you there.</p>
      <ol className="qa">
        {QUESTIONS.map((x) => (
          <li key={x.q}>
            <p className="qa-q">{x.q}</p>
            <p>{x.a}</p>
            <button type="button" className="btn btn-quiet" onClick={() => x.go(s)}>
              {x.jump}
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

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
      <td>{sc.alertLoad?.perPerson.caseDays ? pct(1 - sc.alertLoad.shipshape.caseDays / sc.alertLoad.perPerson.caseDays) : 'n/a'}</td>
    </tr>
  )
}

function Evidence() {
  const s = useStore()
  const bt = s.data.backtest
  const base = bt?.scenarios[0]
  return (
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
          {base.alertLoad && (
            <p>
              Compared with a rule that gives each person their own alert, on the same crews: during the {base.alertLoad.shipEvents} CO₂
              rises that rule called it a personal problem on {base.alertLoad.perPerson.caseDays} person-days and sent the flight surgeon{' '}
              {base.alertLoad.perPerson.personSummaries} individual summaries. Shipshape did so on{' '}
              <strong>{base.alertLoad.shipshape.caseDays}</strong> person-days and sent <strong>{base.alertLoad.shipshape.personSummaries}</strong>{' '}
              individual summaries, plus one crew-level summary for every 3 days of a ship alert ({base.alertLoad.shipshape.shipSummaries}).
            </p>
          )}
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
                  <th>Fewer personal cases than one alert per person</th>
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
  )
}

function Antarctica() {
  const s = useStore()
  const run = () => {
    s.setMission('antarctica')
    if (s.role.kind === 'surgeon') asCrew(s, 'board')
    else s.setScreen('board')
  }
  return (
    <Card title="Beyond spaceflight: Antarctic stations">
      <p>
        The closest place on Earth to Shipshape's crew is a research station through the polar winter. At Concordia, 3,200 m up on the
        Antarctic plateau, the winter crew runs the base on its own for three-quarters of a year, about four months of it without the Sun,
        and once the last plane has left no help can come from outside. ESA sends a doctor there every year because the station is similar
        in some respects to spaceflight.
      </p>
      <p>
        The station doctor faces the question a crew medical officer faces on the way to Mars: when several people sleep badly at once, is it
        them, or the station?
      </p>
      <div className="scroll">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Mars transit</th>
              <th>Antarctic winter</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Who checks in</th>
              <td>4 crew</td>
              <td>The winter crew</td>
            </tr>
            <tr>
              <th scope="row">What the rule checks</th>
              <td>Cabin CO₂ from the ship's sensors</td>
              <td>Indoor CO₂ from a sensor in the living quarters</td>
            </tr>
            <tr>
              <th scope="row">First medical help</th>
              <td>Crew medical officer</td>
              <td>Station doctor</td>
            </tr>
            <tr>
              <th scope="row">Help from home</th>
              <td>Flight surgeon, 4 to 22 minutes away</td>
              <td>Doctors at home by satellite link; no flight out until spring</td>
            </tr>
            <tr>
              <th scope="row">Shared causes to rule out</th>
              <td>Cabin CO₂</td>
              <td>The air today; altitude and the polar night next</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" onClick={run}>
        Run the demo as an Antarctic station
      </button>
      <p className="fine">
        Not built yet: the rule checks the air only, and altitude and the polar night would be further station-wide signals. The demo keeps
        replaying the ISS CO₂ trace. Australia alone keeps about 80 people through the winter at its four stations. Sources:{' '}
        <a href="https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Concordia/The_long_winter_ahead" target="_blank" rel="noreferrer">
          ESA, The long winter ahead (2013)
        </a>
        ;{' '}
        <a href="https://www.esa.int/about-us/directorates/human-and-robotic-exploration/getting-ready-for-space/concordia" target="_blank" rel="noreferrer">
          ESA, Concordia
        </a>
        ;{' '}
        <a href="https://www.antarctica.gov.au/about-antarctica/people-in-antarctica/how-many/" target="_blank" rel="noreferrer">
          Australian Antarctic Program, How many people live in Antarctica?
        </a>
        .
      </p>
    </Card>
  )
}

export function About() {
  return (
    <div className="stack">
      <ChallengeMap />
      <Evidence />
      <Antarctica />
    </div>
  )
}
