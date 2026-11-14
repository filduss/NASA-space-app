import { CAREER_LIMIT_MSV, MISSIONS, RADIATION_LIMITS_SOURCE, doseBudget } from '../engine/mission.ts'
import { useStore } from '../state.tsx'
import { Card, Origin, Stat } from './bits.tsx'
import { mSv, percent } from './text.ts'

// Radiation belongs to the ship: everyone aboard gets about the same dose and nobody can feel it.
// So it is shown as a dose budget for the setting, never judged per person, and never fed to the
// ship-or-me rule.
export function RadiationCard() {
  const s = useStore()
  const m = s.mission
  const r = m.radiation
  if (!r) {
    return (
      <Card title="Radiation">
        <p>
          On Earth the atmosphere and the magnetic field shield the {m.label.toLowerCase()} from space radiation, so there is no dose
          budget to track here. Switch the mission to the ISS, the Moon or Mars in the demo controls to see one.
        </p>
      </Card>
    )
  }
  const b = doseBudget(r, s.today)
  const space = Object.values(MISSIONS).flatMap((x) => (x.radiation ? [{ x, rad: x.radiation }] : []))
  return (
    <Card title="Radiation" aside={<Origin kind="estimate">published rate, {m.label}</Origin>}>
      <div className="stats">
        <Stat label="Dose rate here" value={`${r.doseMSvPerDay} mSv a day`} note={r.note} />
        <Stat label="This mission so far" value={mSv(b.missionMSv)} note={`by mission day ${s.today}, without solar storms`} />
        <Stat label="Career limit used" value={percent(b.careerShare)} note={`of NASA's ${CAREER_LIMIT_MSV} mSv, this mission only`} />
        <Stat label="Career limit reached" value={`Day ${b.limitDay.toLocaleString('en-US')}`} note="at this rate, with no earlier missions" />
      </div>
      <ul className="lines">
        <li>
          Radiation is the ship's, not yours: everyone aboard gets about the same dose and nobody can feel it, so a check-in cannot measure
          it and the ship-or-me rule does not use it.
        </li>
        <li>
          Over a career it raises cancer risk and may affect thinking and behavior, so NASA keeps the career dose under {CAREER_LIMIT_MSV} mSv
          (NASA-STD-3001 Vol 1 [V1 4030]).
        </li>
        <li>
          A large solar storm can cause nausea, vomiting and fatigue. When the ship's monitors or the ground warn of one, go to the storm
          shelter (crew quarters lined with water and stowage) until the all-clear. In a NASA example for a capsule, that cut each person's
          dose from the event to about a third.
        </li>
      </ul>
      <details>
        <summary>Compare the space settings</summary>
        <div className="scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Dose a day</th>
                <th>Measured as</th>
                <th>Career limit reached</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {space.map(({ x, rad }) => (
                <tr key={x.key}>
                  <th scope="row">
                    {x.label}
                    {x.key === m.key ? ' (now)' : ''}
                  </th>
                  <td>{rad.doseMSvPerDay} mSv</td>
                  <td>{rad.quantity}</td>
                  <td>day {doseBudget(rad, s.today).limitDay.toLocaleString('en-US')}</td>
                  <td>
                    <a href={rad.source.url} target="_blank" rel="noreferrer">
                      {rad.source.label}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="fine">
        The rate is a published average for the place, not this crew's dosimeters. It moves with the 11-year solar cycle, and solar storms
        come on top. The Moon and Mars figures are dose equivalent measured by detectors, while NASA's limit is effective dose, so the
        percentages are estimates. Rate:{' '}
        <a href={r.source.url} target="_blank" rel="noreferrer">
          {r.source.label}
        </a>
        . Limit and storm shelter:{' '}
        <a href={RADIATION_LIMITS_SOURCE.url} target="_blank" rel="noreferrer">
          {RADIATION_LIMITS_SOURCE.label}
        </a>
        .
      </p>
    </Card>
  )
}
