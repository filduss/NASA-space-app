import { useEffect } from 'react'
import type { TourStop } from '../auth/demo.ts'
import { hrefOf } from '../auth/paths.ts'
import { homePage } from '../auth/session.ts'
import { TourLink } from '../auth/TourLink.tsx'
import type { BacktestScenario } from '../data/types.ts'
import { useStore } from '../state.tsx'
import { Card, Origin } from './bits.tsx'

// The public page for judges and visitors, with no login: where the demo answers each of the
// challenge's five questions, the evidence that the rule works, and how the same rule carries over to
// an Antarctic winter station. Each button opens the demo as the person who would see that screen.

const QUESTIONS: { q: string; a: string; jump: string; stop: TourStop }[] = [
  {
    q: 'Which measurements can be performed in space?',
    a: "A morning check-in: sliders for sleep, fatigue, irritability, stress and mood, symptom ticks, and a 30-second reaction test (a short version of the ISS Reaction Self-Test). The ship's sensors add cabin CO₂.",
    jump: 'Open the check-in, as Anna',
    stop: { as: 'anna', page: 'checkin' },
  },
  {
    q: 'Why is an exam needed?',
    a: "Every check-in item says why it is asked. Each reading is compared with that person's own normal rather than a population range, because people differ and spaceflight changes the body.",
    jump: "See Chen's readings against his own normal",
    stop: { as: 'chen', page: 'dashboard', search: '?day=212' },
  },
  {
    q: 'How do spaceflight hazards affect these indicators?',
    a: "Closed environment: cabin CO₂ is linked to headaches, poor sleep and fatigue. Space radiation: a dose budget against NASA's career limit. Distance from Earth: the mission setting sets the delay to the flight surgeon. Gravity: without it bones and muscles carry no load, so each check-in can log yesterday's exercise, and the dashboard flags the hip, spine and muscles when it falls short; and since microgravity fluid shifts cause headaches too, one headache never blames the air. Isolation and confinement: mood and stress are tracked privately, against the person's usual and against their starting normal, so a slow slide is caught too.",
    jump: 'Open the Ship screen on day 213',
    stop: { as: 'dana', page: 'app', search: '?day=213&screen=ship' },
  },
  {
    q: 'When does a result need the crew or the flight surgeon?',
    a: 'One day off your own normal: a private card (tier 1). A ship alert or a crew-wide pattern: the crew medical officer (tier 2). Still off on day 3: a summary to the flight surgeon, sent with the comm delay (tier 3). A safety answer: both, at once (tier 4).',
    jump: 'See what reached Earth by day 223, as the flight surgeon',
    stop: { as: 'mira', page: 'app', search: '?day=223&screen=summary' },
  },
  {
    q: 'What actions can prevent a critical condition?',
    a: 'A ship alert opens the crew quest "Clear the air", and afterwards the app re-checks whether the air and the crew recovered. A private card carries a self-care idea. The radiation card says when to go to the storm shelter. Anything still off on day 3 reaches the flight surgeon.',
    jump: 'See day 213 on the Ship screen',
    stop: { as: 'dana', page: 'app', search: '?day=213&screen=ship' },
  },
]

function ChallengeMap() {
  return (
    <Card title="The challenge's five questions">
      <p className="muted">Each one is answered somewhere in this demo; the button opens it, logged in as the person who would see it.</p>
      <ol className="qa">
        {QUESTIONS.map((x) => (
          <li key={x.q}>
            <p className="qa-q">{x.q}</p>
            <p>{x.a}</p>
            <TourLink stop={x.stop} className="btn btn-quiet">
              {x.jump}
            </TourLink>
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
  const slow = bt?.scenarios.find((x) => x.slowDecline)?.slowDecline
  const mask = base?.masking
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
          {mask && (
            <p>
              Its known blind spot: a personal problem that starts during a ship alert is put down to the ship until the air recovers. Of the{' '}
              {mask.overlappingShipAlert.events} personal events that overlapped a CO₂ rise, {mask.overlappingShipAlert.neverLabelledPersonal} never got a
              personal label and {mask.overlappingShipAlert.neverReachedSurgeon} never reached the flight surgeon ({mask.noShipAlert.neverReachedSurgeon} of{' '}
              {mask.noShipAlert.events} with no rise). The accuracy above leaves out the {base.accuracyMixedExcluded} person-days when both happened at once.
            </p>
          )}
          {slow && (
            <p>
              A slow decline: when one person's mood slid 0.1 points a day, the check against their starting normal flagged{' '}
              <strong>{pct(slow.flaggedShare)}</strong> of the slides, a median of {slow.flagDelayDaysMedian} days in, and {pct(slow.toSurgeonShare)} reached the
              flight surgeon. Without that check a slide like this becomes the person's own normal and is never flagged.
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
      <TourLink stop={{ as: 'dana', page: 'app', search: '?mission=antarctica&screen=board' }} className="btn">
        Run the demo as an Antarctic station
      </TourLink>
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

export function ChallengePage() {
  const s = useStore()
  const base = import.meta.env.BASE_URL
  useEffect(() => {
    document.title = 'How it answers the challenge · Shipshape'
  }, [])
  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-brand">
          <span className="appicon" aria-hidden="true">
            S
          </span>
          <div>
            <p className="appbar-name">Shipshape</p>
            <p className="appbar-meta">Is it me, or the ship?</p>
          </div>
        </div>
        <span />
        <nav className="account" aria-label="Pages">
          <a className="link" href={hrefOf('login', base)}>
            Judge's tour
          </a>
          {s.user && (
            <a className="link" href={hrefOf(homePage(s.user), base)}>
              Back to the demo
            </a>
          )}
        </nav>
      </header>

      <section className="intro">
        <div>
          <p className="intro-eyebrow">NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions</p>
          <h1>How Shipshape answers the challenge</h1>
        </div>
        <span className="origins">
          <Origin kind="simulated">crew</Origin>
          <Origin kind="real">ISS CO₂, {s.data.cabin.meta.mission}</Origin>
        </span>
      </section>

      <main>
        <div className="stack">
          <ChallengeMap />
          <Evidence />
          <Antarctica />
        </div>
      </main>

      <footer className="foot">
        <p>
          Shipshape says "likely" and never diagnoses; it supports the flight surgeon and never replaces one. The crew is simulated; the cabin
          CO₂ is real ISS telemetry from NASA's Open Science Data Repository.
        </p>
      </footer>
    </div>
  )
}
