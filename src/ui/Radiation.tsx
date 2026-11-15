import { CAREER_LIMIT_MSV, doseBudget } from '../engine/mission.ts'
import { useStore } from '../state.tsx'
import { Card, Stat } from './bits.tsx'
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
  return (
    <Card title="Radiation">
      <div className="stats">
        <Stat label="Dose rate here" value={`${r.doseMSvPerDay} mSv a day`} note={r.note} />
        <Stat label="This mission so far" value={mSv(b.missionMSv)} note={`by mission day ${s.today}, without solar storms`} />
        <Stat label="Career limit used" value={percent(b.careerShare)} note={`of NASA's ${CAREER_LIMIT_MSV} mSv, this mission only`} />
        <Stat label="Career limit reached" value={`Day ${b.limitDay.toLocaleString('en-US')}`} note="at this rate, with no earlier missions" />
      </div>
    </Card>
  )
}
