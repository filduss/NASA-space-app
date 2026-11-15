import { hrefOf } from '../auth/paths.ts'
import { viewKey } from '../auth/session.ts'
import { MISSIONS, type MissionKey } from '../engine/mission.ts'
import { useStore, type Role } from '../state.tsx'
import { delayText } from './text.ts'

// Demo control: who is looking, which mission day it is, where the crew is and how far away Earth is.
// The golden path of the demo is four days, the same on the personal dashboard: 212 (crew OK, CO2
// starting to climb), 213 (ship), 221 (air normal, one still off), 223 (day 3).
const GOLDEN: { day: number; label: string }[] = [
  { day: 212, label: 'CO₂ starts to climb' },
  { day: 213, label: 'Likely the ship' },
  { day: 221, label: 'Air normal, one still off' },
  { day: 223, label: 'Day 3 to Earth' },
]

export function RoleSwitcher() {
  const s = useStore()
  const [min, max] = s.dayRange
  // Only the views this login may take on this page (viewsFor). Other people's views need their login.
  const views = s.views.length > 0 ? s.views : [s.role]
  const label = (r: Role) => (r.kind === 'crew' ? `Me (${s.nameOf(r.crewId)})` : r.kind === 'cmo' ? 'Crew medical officer' : 'Flight surgeon (Earth)')
  const step = (d: number) => s.setToday(Math.min(max, Math.max(min, s.today + d)))
  // The flight surgeon's login cannot clear crew inputs.
  const earth = s.user?.role === 'surgeon'
  return (
    <div className="switcher" aria-label="Demo controls">
      {views.length > 1 ? (
        <label className="field">
          <span>Viewing as</span>
          <select
            value={viewKey(s.role)}
            onChange={(e) => {
              const v = views.find((x) => viewKey(x) === e.target.value)
              if (v) s.setRole(v)
            }}
          >
            {views.map((v) => (
              <option key={viewKey(v)} value={viewKey(v)}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="field">
          <span>Viewing as</span>
          <output className="field-fixed">{label(views[0])}</output>
        </div>
      )}
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
      <a className="link switcher-link" href={hrefOf('challenge', import.meta.env.BASE_URL)}>
        How it answers the challenge
      </a>
      {!earth && (
        <button
          type="button"
          className="link"
          onClick={() => {
            if (window.confirm('Clear the live check-ins and conference requests you added in this browser?')) s.reset()
          }}
        >
          Reset my inputs
        </button>
      )}
    </div>
  )
}
