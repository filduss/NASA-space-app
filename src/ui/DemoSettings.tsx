import { hrefOf } from '../auth/paths.ts'
import { viewKey } from '../auth/session.ts'
import { MISSIONS, type MissionKey } from '../engine/mission.ts'
import { useStore, type Role } from '../state.tsx'
import { delayText } from './text.ts'

// The demo settings in the demo dock's settings popover (src/ui/DemoDock.tsx): who is looking,
// where the crew is and how far away Earth is, plus the challenge page and a reset. The mission day
// and the golden path are the dock's own controls.

export function DemoSettings() {
  const s = useStore()
  // Only the views this login may take on this page (viewsFor). Other people's views need their login.
  const views = s.views.length > 0 ? s.views : [s.role]
  const label = (r: Role) => (r.kind === 'crew' ? `Me (${s.nameOf(r.crewId)})` : r.kind === 'cmo' ? 'Crew medical officer' : 'Flight surgeon (Earth)')
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
