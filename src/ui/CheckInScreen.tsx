import { useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import { SPEC, SYMPTOMS } from '../engine/deviation.ts'
import type { CheckIn, SymptomKey } from '../engine/types.ts'
import { XP } from '../game/xp.ts'
import { useStore, type ReactionResult } from '../state.tsx'
import { Card, Origin } from './bits.tsx'
import { ReactionTest } from './ReactionTest.tsx'
import { delayText } from './text.ts'

type SliderKey = 'sleepHours' | 'sleepQuality' | 'fatigue' | 'irritability' | 'stress' | 'mood'
type Slider = { key: SliderKey; min: number; max: number; step: number; lo: string; hi: string }
const SLIDERS: Slider[] = [
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

  // Sliders start unset, never at the person's usual: a rushed check-in must not report "as usual" by
  // default, so each one is rated before the usual is shown, or explicitly set as usual. A check-in
  // already sent today starts from what was sent.
  const [values, setValues] = useState<Record<SliderKey, number | null>>(() => {
    const v = {} as Record<SliderKey, number | null>
    for (const sl of SLIDERS) v[sl.key] = existing && !existing.simulated ? existing[sl.key] : null
    return v
  })
  const set = (key: SliderKey, value: number) => setValues((v) => ({ ...v, [key]: value }))
  const usualOf = (sl: Slider) => {
    const usual = status.assessment.indicators[sl.key].baseline?.median ?? (sl.min + sl.max) / 2
    return Math.round(usual / sl.step) * sl.step
  }
  const unset = SLIDERS.filter((sl) => values[sl.key] === null)
  const restAsUsual = () =>
    setValues((v) => Object.fromEntries(SLIDERS.map((sl) => [sl.key, v[sl.key] ?? usualOf(sl)])) as Record<SliderKey, number>)
  const [symptoms, setSymptoms] = useState<SymptomKey[]>(existing && !existing.simulated ? existing.symptoms : [])
  // Optional; shown on the person's own dashboard only, never judged (engine/gravity.ts).
  const [exercise, setExercise] = useState<number | null>(existing && !existing.simulated ? (existing.exerciseMin ?? null) : null)
  const [safety, setSafety] = useState(existing?.safetyFlag === true)
  const [reaction, setReaction] = useState<ReactionResult | null>(s.liveReaction[`${crewId}|${s.today}`] ?? null)
  const [sent, setSent] = useState(false)

  const submit = () => {
    if (unset.length > 0) return
    const rated = values as Record<SliderKey, number>
    const c: CheckIn = { crewId, day: s.today, ...rated, symptoms, reactionMs: null, exerciseMin: exercise, safetyFlag: safety || undefined, simulated: false }
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
              <a className="btn btn-quiet" href={hrefOf('dashboard', import.meta.env.BASE_URL, `?day=${s.today}`)}>
                My dashboard
              </a>
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
          You earn the same XP on a bad day as on a good one. Rate each slider before you see your usual; if one is as usual, say so.
        </p>
        <div className="sliders">
          {SLIDERS.map((sl) => {
            const spec = SPEC[sl.key]
            const v = values[sl.key]
            return (
              <div className={v === null ? 'slider slider-unset' : 'slider'} key={sl.key}>
                <label htmlFor={`sl-${sl.key}`}>
                  <span>
                    {spec.label}
                    {spec.privacy === 'private' && <span className="lock" title="Private: only you see this"> 🔒 private</span>}
                  </span>
                  <output>{v === null ? 'Not set' : sl.key === 'sleepHours' ? `${v.toFixed(1)} h` : v}</output>
                </label>
                <input
                  id={`sl-${sl.key}`}
                  type="range"
                  min={sl.min}
                  max={sl.max}
                  step={sl.step}
                  value={v ?? (sl.min + sl.max) / 2}
                  onChange={(e) => set(sl.key, Number(e.target.value))}
                  // A tap on the thumb where it already sits sets it too.
                  onClick={(e) => v === null && set(sl.key, Number(e.currentTarget.value))}
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

      <Card title="Exercise yesterday">
        <div className={exercise === null ? 'slider slider-unset' : 'slider'}>
          <label htmlFor="sl-exercise">
            <span>Minutes</span>
            <output>{exercise === null ? 'Not logged' : `${exercise} min`}</output>
          </label>
          <input
            id="sl-exercise"
            type="range"
            min={0}
            max={180}
            step={15}
            value={exercise ?? 90}
            onChange={(e) => setExercise(Number(e.target.value))}
            onClick={(e) => exercise === null && setExercise(Number(e.currentTarget.value))}
          />
          <div className="ends">
            <span>None</span>
            <span>3 h</span>
          </div>
        </div>
        <p className="why">
          Why we ask: in spaceflight, weight-bearing bones lose on average 1 to 1.5% of their mineral density a month (NASA), and exercise is the
          countermeasure; ISS crews exercise about two hours a day. Shown only on your dashboard, never judged. Optional.
        </p>
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

      {unset.length > 0 && (
        <p className="fine unset-note">
          {unset.length} {unset.length === 1 ? 'slider is' : 'sliders are'} not set.{' '}
          <button type="button" className="link" onClick={restAsUsual}>
            Set {unset.length === 1 ? 'it' : 'them'} to my usual
          </button>
        </p>
      )}
      <button type="button" className="btn btn-primary btn-wide" onClick={submit} disabled={unset.length > 0}>
        Submit check-in
      </button>
    </div>
  )
}
