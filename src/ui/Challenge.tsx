import { useEffect } from 'react'
import type { TourStop } from '../auth/demo.ts'
import { hrefOf } from '../auth/paths.ts'
import { homePage } from '../auth/session.ts'
import { TourLink } from '../auth/TourLink.tsx'
import { HRP_MAP } from '../data/hrp.ts'
import type { BacktestScenario, TraceCabin } from '../data/types.ts'
import { RULES } from '../engine/config.ts'
import { useStore } from '../state.tsx'
import { Card, RiskLinks } from './bits.tsx'
import './toolbar.css'
import { list } from './text.ts'

// The public page for judges and visitors, with no login: where the demo answers each of the
// challenge's five questions, the evidence that the rule works, and how the same rule carries over to
// an Antarctic winter station. Each button opens the demo as the person who would see that screen.

const QUESTIONS: { q: string; a: string; jump: string; stop: TourStop }[] = [
  {
    q: 'Which measurements can be performed in space?',
    a: "A one-minute morning check-in: five 0-10 ratings (sleep quality, fatigue, irritability, stress and mood), symptom ticks and an optional 30-second reaction test (a short version of the ISS Reaction Self-Test). A wrist wearable measures sleep and exercise, so nobody types them in (simulated here). The ship's sensors add cabin CO₂, temperature and humidity (real ISS data). Each reading links to the NASA Human System Risk it informs (below).",
    jump: 'Open the check-in, as Anna',
    stop: { as: 'anna', page: 'checkin' },
  },
  {
    q: 'Why is an exam needed?',
    a: "One reading on its own says little: people differ and spaceflight changes the body. So each reading is compared with that person's own normal rather than a population range, and a change is only called the ship's when the cabin air and the rest of the crew agree. The dashboard shows each reading beside the person's usual.",
    jump: "See Chen's readings against his own normal",
    stop: { as: 'chen', page: 'dashboard', search: '?day=212' },
  },
  {
    q: 'How do spaceflight hazards affect these indicators?',
    a: "Closed environment: cabin CO₂, temperature and humidity are checked every day against NASA's limits, and each has its own readings: CO₂ headaches, poor sleep and fatigue, temperature sleep, dry air a stuffy nose and sore eyes. The rule blames the factor whose changes half the crew share. Space radiation: a dose budget against NASA's career limit. Distance from Earth: the mission setting sets the delay to the flight surgeon. Gravity: without it bones and muscles carry no load, so the wearable logs each day's exercise against a daily target, and the dashboard turns the core and muscle zones orange when it falls short; and since microgravity fluid shifts cause headaches too, one headache never blames the air. Isolation and confinement: mood and stress are tracked privately, against the person's usual and against their starting normal, so a slow slide is caught too.",
    jump: 'Open the Ship screen on day 213',
    stop: { as: 'dana', page: 'app', search: '?day=213&screen=ship' },
  },
  {
    q: 'When does a result need the crew or the flight surgeon?',
    a: 'One day off your own normal: a Watch on your own dashboard, which only you see (tier 1). A ship alert or a crew-wide pattern: the crew medical officer (tier 2). Still off on day 3: a summary to the flight surgeon, sent with the comm delay (tier 3). An urgent conference request: both, at once (tier 4).',
    jump: 'See what reached Earth by day 223, as the flight surgeon',
    stop: { as: 'mira', page: 'app', search: '?day=223&screen=summary' },
  },
  {
    q: 'What actions can prevent a critical condition?',
    a: 'During a ship alert the Ship screen lists what to do now: check the air first, before anyone is treated as a patient. After the alert the app re-checks whether the air and the crew recovered. The radiation card says when to go to the storm shelter. Anything still off on day 3 reaches the flight surgeon.',
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
  const split = sc.accuracyByClass
  return (
    <tr>
      <th scope="row">{sc.name}</th>
      <td>{split ? `${pct(split.shipDays.accuracy)} / ${pct(split.personalDays.accuracy)}` : pct(sc.shipOrMeAccuracy)}</td>
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
    <Card title="Does the rule work? Measured on simulated crews">
      {bt && base ? (
        <>
          <p>
            {bt.meta.crews} simulated crews of {bt.meta.crewSize} lived through {Object.keys(bt.meta.traces).length} real ISS cabin traces (
            {base.crewDays.toLocaleString('en-US')} crew-days). In the base case the rule named the right cause in{' '}
            <strong>{pct(base.shipOrMeAccuracy)}</strong> of alerts raised during an event
            {base.accuracyByClass && (
              <>
                : on days with a CO₂ rise it said "the ship" in <strong>{pct(base.accuracyByClass.shipDays.accuracy)}</strong> of alerts, and on days
                with one person's own problem it said "not the ship" in <strong>{pct(base.accuracyByClass.personalDays.accuracy)}</strong>
              </>
            )}
            . It missed <strong>{pct(base.ship.missedShareRise2Plus)}</strong> of CO₂ rises of 2 mmHg or more ({pct(base.ship.missedShare)} of all
            rises from 1 mmHg).
          </p>
          <p className="muted">
            Read these as a stress test, not a validation. The simulated crews feel CO₂ through the same indicators the rule reads, so the
            figures show how the rule copes with noise, missed check-ins and weaker or stronger effects. They do not show how real crews
            behave; that needs real crew data, which is medical and not public.
          </p>
          {base.shipByCause && (
            <p>
              Ship alerts by cause: CO₂ on {base.shipByCause.co2.crewDays} crew-days, temperature on {base.shipByCause.temp.crewDays}, humidity on{' '}
              {base.shipByCause.rh.crewDays}. Checking temperature and humidity changed no number above: on these real traces they rarely leave
              NASA's comfort range (next card), and no crew effect of them is simulated, so the backtest measures what the checks cost, not what
              they catch.
            </p>
          )}
          {base.alertLoad && (
            <p>
              Compared with a rule that gives each person their own alert, on the same crews: during the {base.alertLoad.shipEvents} CO₂
              rises that rule called it a personal problem on {base.alertLoad.perPerson.caseDays} person-days and sent the flight surgeon{' '}
              {base.alertLoad.perPerson.personSummaries} individual summaries. Ship Or Me? did so on{' '}
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
                  <th>Right cause: CO₂-rise days / own-problem days</th>
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

const year = (date: string) => date.slice(0, 4)

/** The real cabin across every ISS trace: which factor actually moves, counted by the app's own rules. */
function CabinTraces() {
  const s = useStore()
  const traces = Object.entries(s.data.backtest?.meta.traces ?? {}).flatMap(([m, t]) => (t.cabin ? [{ m, c: t.cabin }] : []))
  if (traces.length === 0) return null
  const sum = (pick: (c: TraceCabin) => number) => traces.reduce((n, t) => n + pick(t.c), 0)
  const years = traces.flatMap((t) => t.c.dates.map(year)).sort()
  const cool = traces.filter((t) => t.c.suspectDays.temp > 0)
  const rhLo = Math.min(...traces.map((t) => t.c.rhRange[0]))
  const rhHi = Math.max(...traces.map((t) => t.c.rhRange[1]))
  const [tLo, tHi] = RULES.tempComfortC
  const [hLo, hHi] = RULES.rhComfortPct
  return (
    <Card title={`What ${traces.length} ISS missions show`}>
      <p>
        The rule checks three cabin factors from the same ISS telemetry. Over {sum((c) => c.daysWithData)} real days ({years[0]}–{years.at(-1)}),
        CO₂ was a suspect on {sum((c) => c.suspectDays.co2)} days and over NASA's {RULES.co2LimitMmHg} mmHg limit on {sum((c) => c.co2OverLimitDays)}.
        Temperature left NASA's comfort range ({tLo}–{tHi} °C) on {sum((c) => c.suspectDays.temp)} days
        {cool.length ? ` (${list(cool.map((t) => `${t.m}, ${year(t.c.dates[0])}`))})` : ''}, and humidity on {sum((c) => c.suspectDays.rh) || 'none'}:
        it stayed between {Math.round(rhLo)}% and {Math.round(rhHi)}%. On the ISS, CO₂ is the cabin factor that moves. Temperature and humidity
        are checked every day, and on these traces they are ruled out by name.
      </p>
      <div className="scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Days</th>
              <th>CO₂ suspect (over 3 mmHg)</th>
              <th>Temperature outside {tLo}–{tHi} °C</th>
              <th>Humidity outside {hLo}–{hHi}%</th>
              <th>Temperature range</th>
              <th>Humidity range</th>
            </tr>
          </thead>
          <tbody>
            {traces.map(({ m, c }) => (
              <tr key={m}>
                <th scope="row">
                  {m} <span className="muted">{c.dates[0].slice(0, 7)}</span>
                </th>
                <td>{c.daysWithData}</td>
                <td>
                  {c.suspectDays.co2} ({c.co2OverLimitDays})
                </td>
                <td>{c.suspectDays.temp}</td>
                <td>{c.suspectDays.rh}</td>
                <td>
                  {c.tempRange[0].toFixed(1)}–{c.tempRange[1].toFixed(1)} °C
                </td>
                <td>
                  {Math.round(c.rhRange[0])}–{Math.round(c.rhRange[1])}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">
        Daily 24 h means, counted with the app's own cabin status. Comfort range from NASA-STD-3001 Vol 2 [V2 6013]; 3 mmHg from [V2 6004]. The
        telemetry is ISS-side data published for Rodent Research payloads in NASA's Open Science Data Repository; it may differ from a
        cabin-wide average.
      </p>
    </Card>
  )
}

/** The simulated crews set beside published figures for real ISS crews. */
function CrewVsIss() {
  const s = useStore()
  const iss = s.data.backtest?.meta.issCrews
  const sim = s.data.backtest?.scenarios[0]?.crewStats
  if (!iss || !sim) return null
  const share = (v: number) => `${(v * 100).toFixed(1)}%`
  const moreMin = Math.round(((sim.sleepHoursMean - iss.sleepHours.value) * 60) / 10) * 10
  return (
    <Card title="Simulated crews beside real ISS crews">
      <p className="muted">
        The crews are simulated, so we set them beside published figures for real ISS crews. The simulator is not tuned to these numbers;
        where they differ, we say so.
      </p>
      <div className="scroll">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Real ISS crews</th>
              <th>Simulated crews</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Sleep in flight</th>
              <td>
                {iss.sleepHours.text}
                <span className="cite">{iss.sleepHours.source}</span>
              </td>
              <td>{sim.sleepHoursMean.toFixed(1)} h on average</td>
            </tr>
            <tr>
              <th scope="row">Days with a reported headache</th>
              <td>
                {iss.headacheDayShare.text} ({share(iss.headacheDayShare.value)})
                <span className="cite">{iss.headacheDayShare.source}</span>
              </td>
              <td>{share(sim.headacheDayShare)} of check-ins</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Headaches come out close. Our crews sleep about {moreMin} minutes more than ISS astronauts reported, so on real crews the rule "under 6 h on
        3 of the last 7 nights" would fire more often. On the ISS, nights under 6 h went with slower responses, more stress and higher workload,
        which is why the check-in asks about sleep first.
      </p>
    </Card>
  )
}

/** Every reading in the app and the NASA Human System Risk it informs. */
function HrpMap() {
  return (
    <Card title="Each reading and its NASA risk">
      <p className="muted">
        NASA's Human Research Program works to reduce a list of Human System Risks. Each reading in Ship Or Me? informs one or more of them; the
        links open NASA's page for that risk.
      </p>
      <ul className="hrp-list">
        {HRP_MAP.map((r) => (
          <li key={r.item}>
            <p className="hrp-item">
              {r.item} <span className="hrp-kind">{r.kind}</span>
            </p>
            <RiskLinks risks={r.risks} />
            <p className="fine">{r.nasa}</p>
          </li>
        ))}
      </ul>
      <p className="fine">
        Risk titles as on NASA's{' '}
        <a href="https://www.nasa.gov/hhp/human-system-risks/" target="_blank" rel="noreferrer">
          Human System Risks
        </a>{' '}
        page, read 15 Nov 2026; hover a link for the full title. Temperature and humidity have no risk of their own on that list, so they are
        linked to the risks their effects fall under and to NASA's cabin standard.
      </p>
    </Card>
  )
}

function Antarctica() {
  return (
    <Card title="Beyond spaceflight: Antarctic stations">
      <p>
        The closest place on Earth to this crew is a research station through the polar winter. At Concordia, 3,200 m up on the
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
    document.title = 'How it answers the challenge · Ship Or Me?'
  }, [])
  return (
    <div className="app">
      {/* The same head row as every other page: no top bar, the title on the left and the links on the right. */}
      <header className="intro intro-page intro-links">
        <div className="intro-title">
          <p className="intro-eyebrow">NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions</p>
          <h1>How it answers the challenge</h1>
        </div>
        <nav className="toolbar" aria-label="Pages">
          <a className="tbtn tbtn-text" href={hrefOf('login', base)}>
            Judge's tour
          </a>
          {s.user && (
            <a className="tbtn tbtn-text" href={hrefOf(homePage(s.user), base)}>
              Back to the demo
            </a>
          )}
        </nav>
      </header>

      <main>
        <div className="stack">
          <ChallengeMap />
          <Evidence />
          <CabinTraces />
          <CrewVsIss />
          <HrpMap />
          <Antarctica />
        </div>
      </main>

      <footer className="foot">
        <p>
          Ship Or Me? says "likely" and never diagnoses; it supports the flight surgeon and never replaces one.
        </p>
      </footer>
    </div>
  )
}
