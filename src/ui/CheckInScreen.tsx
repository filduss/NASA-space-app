import { useMemo, useState } from 'react'
import { SPEC, SYMPTOMS } from '../engine/deviation.ts'
import type { CheckIn, SymptomKey } from '../engine/types.ts'
import { XP } from '../game/xp.ts'
import { useStore, type ReactionResult } from '../state.tsx'
import { Card, Origin } from './bits.tsx'
import { ReactionTest } from './ReactionTest.tsx'
import { delayText } from './text.ts'

type SliderKey = 'sleepHours' | 'sleepQuality' | 'fatigue' | 'irritability' | 'stress' | 'mood'
const SLIDERS: { key: SliderKey; min: number; max: number; step: number; lo: string; hi: string }[] = [
  { key: 'sleepHours', min: 3, max: 10, step: 0.5, lo: '3 h', hi: '10 h' },
  { key: 'sleepQuality', min: 0, max: 10, step: 1, lo: 'Poor', hi: 'Great' },
  { key: 'fatigue', min: 0, max: 10, step: 1, lo: 'None', hi: 'Exhausted' },
  { key: 'irritability', min: 0, max: 10, step: 1, lo: 'Calm', hi: 'On edge' },
  { key: 'stress', min: 0, max: 10, step: 1, lo: 'Low', hi: 'High' },
  { key: 'mood', min: 0, max: 10, step: 1, lo: 'Low', hi: 'Good' },
]

export function CheckInScreen({ crewId }: { crewId: string }) {
  const s = useStore()
  const existing = s.checkIns.find((c) => c.crewId === crewId && c.day === s.today)
  const status = s.todayResult.people[crewId]

  // Sliders start at the person's own usual, so the starting position suggests nothing.
  const start = useMemo(() => {
    const v = {} as Record<SliderKey, number>
    for (const sl of SLIDERS) {
      const usual = status.assessment.indicators[sl.key].baseline?.median
      const base = existing && !existing.simulated ? existing[sl.key] : (usual ?? (sl.min + sl.max) / 2)
      v[sl.key] = Math.round(base / sl.step) * sl.step
    }
    return v
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, s.today])

  const [values, setValues] = useState(start)
  const [symptoms, setSymptoms] = useState<SymptomKey[]>(existing && !existing.simulated ? existing.symptoms : [])
  const [safety, setSafety] = useState(existing?.safetyFlag === true)
  const [reaction, setReaction] = useState<ReactionResult | null>(s.liveReaction[`${crewId}|${s.today}`] ?? null)
  const [sent, setSent] = useState(false)

  const submit = () => {
    const c: CheckIn = { crewId, day: s.today, ...values, symptoms, reactionMs: null, safetyFlag: safety || undefined, simulated: false }
    s.submitCheckIn(c, reaction)
    setSent(true)
    window.scrollTo({ top: 0 })
  }

  if (sent) {
    return (
      <div className="stack">
        {safety ? (
          <Card title="Thank you for saying so" tone="alert">
            <p>
              Your crew medical officer has been told privately, right now. The flight surgeon has been sent a message; it takes{' '}
              {delayText(s.commDelaySec)} to reach Earth.
            </p>
            <p>Nothing about this appears on the crew board. The game is paused for you today.</p>
          </Card>
        ) : (
          <Card title="Checked in">
            <p className="xp-earned">+{XP.checkin} XP: honest report</p>
            <p className="muted">The same XP whatever you answered. Your readings are compared with your own normal, not with anyone else's.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => s.setScreen('me')}>
                See my day
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => s.setScreen('board')}>
                Crew board
              </button>
            </div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="stack">
      <Card
        title={`Morning check-in, day ${s.today}`}
        aside={existing ? <Origin kind={existing.simulated ? 'simulated' : 'live'}>{existing.simulated ? 'today is pre-filled by the simulator' : 'you already checked in'}</Origin> : undefined}
      >
        <p className="muted">
          About a minute. {existing?.simulated ? `Submitting replaces ${s.nameOf(crewId)}'s simulated check-in for today with yours. ` : ''}
          You earn the same XP on a bad day as on a good one.
        </p>
        <div className="sliders">
          {SLIDERS.map((sl) => {
            const spec = SPEC[sl.key]
            return (
              <div className="slider" key={sl.key}>
                <label htmlFor={`sl-${sl.key}`}>
                  <span>
                    {spec.label}
                    {spec.privacy === 'private' && <span className="lock" title="Private: only you see this"> 🔒 private</span>}
                  </span>
                  <output>{sl.key === 'sleepHours' ? `${values[sl.key].toFixed(1)} h` : values[sl.key]}</output>
                </label>
                <input
                  id={`sl-${sl.key}`}
                  type="range"
                  min={sl.min}
                  max={sl.max}
                  step={sl.step}
                  value={values[sl.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [sl.key]: Number(e.target.value) }))}
                />
                <div className="ends">
                  <span>{sl.lo}</span>
                  <span>{sl.hi}</span>
                </div>
                <p className="why">Why we ask: {spec.whyWeAsk}</p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Symptoms today">
        <div className="ticks">
          {SYMPTOMS.map((sym) => (
            <label key={sym.key} className="tick">
              <input
                type="checkbox"
                checked={symptoms.includes(sym.key)}
                onChange={(e) => setSymptoms((cur) => (e.target.checked ? [...cur, sym.key] : cur.filter((x) => x !== sym.key)))}
              />
              <span>{sym.label}</span>
            </label>
          ))}
        </div>
        <p className="why">Why we ask: {SPEC.symptoms.whyWeAsk} Symptoms are shared with the crew by default.</p>
      </Card>

      <Card title="Reaction test" aside={<Origin kind="live" />}>
        <ReactionTest result={reaction} onResult={setReaction} />
        <p className="why">Why we ask: {SPEC.reaction.whyWeAsk} Optional in the demo.</p>
      </Card>

      <Card title="One more question">
        <label className="tick safety">
          <input type="checkbox" checked={safety} onChange={(e) => setSafety(e.target.checked)} />
          <span>I am not safe, or I need to talk to someone now</span>
        </label>
        <p className="why">
          If you tick this, the game steps out of the way and your crew medical officer and flight surgeon are told privately and
          immediately. It never appears on the crew board.
        </p>
      </Card>

      <button type="button" className="btn btn-primary btn-wide" onClick={submit}>
        Submit check-in
      </button>
    </div>
  )
}
