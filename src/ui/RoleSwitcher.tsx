import { MISSIONS, type MissionKey } from '../engine/mission.ts'
import { useStore, type Role } from '../state.tsx'
import { delayText } from './text.ts'

// Demo control: who is looking, which mission day it is, where the crew is and how far away Earth is.
// The golden path of the demo is four days: 212 (all OK), 213 (ship), 221 (one still off), 223 (day 3).
const GOLDEN: { day: number; label: string }[] = [
  { day: 212, label: 'All OK' },
  { day: 213, label: 'CO₂ rises' },
  { day: 221, label: 'Air normal' },
  { day: 223, label: 'Day 3' },
]

function roleValue(r: Role): string {
  return r.kind === 'crew' ? r.crewId : r.kind
}

export function RoleSwitcher() {
  const s = useStore()
  const [min, max] = s.dayRange
  const setRole = (v: string) => {
    if (v === 'cmo') s.setRole({ kind: 'cmo' })
    else if (v === 'surgeon') s.setRole({ kind: 'surgeon' })
    else s.setRole({ kind: 'crew', crewId: v })
  }
  const step = (d: number) => s.setToday(Math.min(max, Math.max(min, s.today + d)))
  return (
    <div className="switcher" aria-label="Demo controls">
      <label className="field">
        <span>Viewing as</span>
        <select value={roleValue(s.role)} onChange={(e) => setRole(e.target.value)}>
          <optgroup label="Crew">
            {s.data.crew.crew.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Medical">
            <option value="cmo">Crew medical officer</option>
            <option value="surgeon">Flight surgeon (Earth)</option>
          </optgroup>
        </select>
      </label>
      <div className="field">
        <span>Mission day</span>
        <div className="stepper">
          <button type="button" onClick={() => step(-1)} disabled={s.today <= min} aria-label="Previous day">
            ‹
          </button>
          <output aria-live="polite">{s.today}</output>
          <button type="button" onClick={() => step(1)} disabled={s.today >= max} aria-label="Next day">
            ›
          </button>
        </div>
      </div>
      <div className="field">
        <span>Golden path</span>
        <div className="chips">
          {GOLDEN.map((g) => (
            <button
              type="button"
              key={g.day}
              className={`chip${s.today === g.day ? ' chip-on' : ''}`}
              onClick={() => s.setToday(g.day)}
              title={`Jump to mission day ${g.day}`}
            >
              {g.day} · {g.label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Mission</span>
        <select value={s.mission.key} onChange={(e) => s.setMission(e.target.value as MissionKey)}>
          {Object.values(MISSIONS).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {s.mission.delaysSec.length > 1 ? (
        <label className="field">
          <span>Comm delay (one way)</span>
          <select value={s.commDelaySec} onChange={(e) => s.setCommDelaySec(Number(e.target.value))}>
            {s.mission.delaysSec.map((d) => (
              <option key={d} value={d}>
                {Math.round(d / 60)} min
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="field">
          <span>Comm delay (one way)</span>
          <output>{delayText(s.commDelaySec)}</output>
        </div>
      )}
      <button type="button" className="link" onClick={() => s.setScreen('about')}>
        How it answers the challenge
      </button>
      <button
        type="button"
        className="link"
        onClick={() => {
          if (window.confirm('Clear the live check-ins, quest ticks and XP you added in this browser?')) s.reset()
        }}
      >
        Reset my inputs
      </button>
    </div>
  )
}
