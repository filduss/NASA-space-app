import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { SPEC, SYMPTOMS } from '../engine/deviation.ts'
import type { SymptomKey } from '../engine/types.ts'
import { vitalLines, type WearableReading } from '../data/wearable.ts'
import { hrefOf } from '../auth/paths.ts'
import { useStore, type ReactionResult } from '../state.tsx'
import { Card, Mark, Origin } from './bits.tsx'
import {
  formFrom,
  left,
  noSymptoms,
  rate,
  RATINGS,
  toCheckIn,
  toggleSymptom,
  type CheckInForm,
  type Rating,
  type RatingKey,
} from './checkInForm.ts'
import { ReactionTest } from './ReactionTest.tsx'
import { delayText, hoursText, symptomLabel } from './text.ts'

const SCALE = Array.from({ length: 11 }, (_, i) => i)

export function CheckInScreen({ crewId }: { crewId: string }) {
  const s = useStore()
  const existing = s.checkIns.find((c) => c.crewId === crewId && c.day === s.today)
  const sentLive = existing && !existing.simulated ? existing : undefined
  const wearable = s.wearableToday(crewId)

  const [form, setForm] = useState<CheckInForm>(() => formFrom(existing))
  const [mode, setMode] = useState<'form' | 'receipt'>(sentLive ? 'receipt' : 'form')
  const [reaction, setReaction] = useState<ReactionResult | null>(s.liveReaction[`${crewId}|${s.today}`] ?? null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLElement>(null)

  const missing = left(form)

  const submit = () => {
    const c = toCheckIn(form, { crewId, day: s.today, wearable })
    if (!c) return
    s.submitCheckIn(c, reaction)
    setMode('receipt')
    window.scrollTo({ top: 0 })
  }

  const needHelp = () => {
    setHelpOpen(true)
    helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (mode === 'receipt' && sentLive) {
    return <Receipt crewId={crewId} reaction={reaction} onChange={() => setMode('form')} />
  }

  return (
    <div className="stack checkin">
      <div className="ci-intro">
        <p>
          About a minute. Sleep, fatigue, irritability and symptoms go to your crew medical officer and your flight surgeon. Mood and
          stress stay yours, unless you are still off on day 3: then your flight surgeon is told.
          {existing?.simulated && <span className="fine"> Sending replaces the simulator's check-in for {s.nameOf(crewId)} today.</span>}
        </p>
        <button type="button" className="link ci-help-link" onClick={needHelp}>
          Need help now?
        </button>
      </div>

      <Card title="Last night" aside={<Origin kind="simulated">from your wearable</Origin>}>
        <WearableLine wearable={wearable} />
      </Card>

      <Card title="How you feel this morning">
        <div className="ci-ratings">
          {RATINGS.map((r) => (
            <RatingRow key={r.key} rating={r} value={form.ratings[r.key]} onChange={(v) => setForm((f) => rate(f, r.key, v))} />
          ))}
        </div>
      </Card>

      <Card title="Symptoms since yesterday">
        <SymptomTiles value={form.symptoms} onToggle={(k) => setForm((f) => toggleSymptom(f, k))} onNone={() => setForm(noSymptoms)} />
      </Card>

      <Card title="Reaction test" aside={<Origin kind="live" />}>
        <p className="muted ci-optional">Optional.</p>
        <ReactionTest result={reaction} onResult={setReaction} />
      </Card>

      <section ref={helpRef} id="conference" className="ci-anchor">
        <ConferenceCard crewId={crewId} open={helpOpen} onOpen={() => setHelpOpen(true)} />
      </section>

      <div className="ci-bar" role="region" aria-label="Send the check-in">
        <button type="button" className="btn btn-primary ci-send" onClick={submit} disabled={missing > 0}>
          {sentLive ? 'Send changes' : 'Send check-in'}
        </button>
      </div>
    </div>
  )
}

function WearableLine({ wearable }: { wearable: WearableReading | null }) {
  if (!wearable) return <p className="muted">No wearable reading for last night.</p>
  return (
    <>
      <dl className="ci-wearable">
        <div>
          <dt>Slept</dt>
          <dd>{wearable.sleepHours === null ? 'no reading' : hoursText(wearable.sleepHours)}</dd>
        </div>
        <div>
          <dt>Exercise yesterday</dt>
          <dd>{wearable.exerciseMin === null ? 'none logged' : `${wearable.exerciseMin} min`}</dd>
        </div>
      </dl>
      {wearable.vitals && (
        <>
          <dl className="ci-wearable ci-vitals">
            {vitalLines(wearable.vitals).map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
          <p className="fine">Vitals are shown for information: the rules don't use them yet.</p>
        </>
      )}
    </>
  )
}

/** One 0-10 rating: a radio group of tap targets, unset until chosen. */
function RatingRow({ rating, value, onChange }: { rating: Rating; value: number | null; onChange: (v: number) => void }) {
  const id = useId()
  const group = useRef<HTMLDivElement>(null)
  // Roving focus: the chosen number, or 0 before anything is chosen, is the one Tab stop.
  const stop = value ?? 0

  const choose = (v: number, focus: boolean) => {
    onChange(v)
    if (focus) group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[v]?.focus()
  }
  // The ARIA radio-group pattern: arrows move from the focused number and choose it, wrapping at the ends.
  const onKey = (e: KeyboardEvent) => {
    const at = Number((e.target as HTMLElement).dataset.v ?? stop)
    const last = SCALE.length - 1
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (at + 1) % SCALE.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (at + last) % SCALE.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next === null) return
    e.preventDefault()
    choose(next, true)
  }

  return (
    <div className={value === null ? 'ci-rating ci-unset' : 'ci-rating'}>
      <div className="ci-rating-head">
        <span id={`${id}-q`} className="ci-question">
          {rating.question}
        </span>
      </div>
      <div ref={group} className="ci-scale" role="radiogroup" aria-labelledby={`${id}-q`} aria-describedby={`${id}-ends`} onKeyDown={onKey}>
        {SCALE.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            data-v={v}
            aria-checked={value === v}
            tabIndex={v === stop ? 0 : -1}
            className={value === v ? 'ci-num ci-num-on' : 'ci-num'}
            onClick={() => choose(v, false)}
          >
            {v}
          </button>
        ))}
      </div>
      <div id={`${id}-ends`} className="ci-ends">
        <span>0 {rating.lo}</span>
        <span>{rating.hi} 10</span>
      </div>
    </div>
  )
}

function SymptomTiles({ value, onToggle, onNone }: { value: SymptomKey[] | null; onToggle: (k: SymptomKey) => void; onNone: () => void }) {
  const none = value !== null && value.length === 0
  return (
    <div className="ci-tiles" role="group" aria-label="Symptoms since yesterday">
      {SYMPTOMS.map((sym) => {
        const on = value?.includes(sym.key) === true
        return (
          <button key={sym.key} type="button" className={on ? 'ci-tile ci-tile-on' : 'ci-tile'} aria-pressed={on} onClick={() => onToggle(sym.key)}>
            <span className="ci-tick" aria-hidden="true">
              {on ? '✓' : ''}
            </span>
            {sym.label}
          </button>
        )
      })}
      <button type="button" className={none ? 'ci-tile ci-tile-none ci-tile-on' : 'ci-tile ci-tile-none'} aria-pressed={none} onClick={onNone}>
        <span className="ci-tick" aria-hidden="true">
          {none ? '✓' : ''}
        </span>
        None today
      </button>
    </div>
  )
}

/**
 * Who is told about a request, by name: the medical officer on board and the flight surgeon on Earth.
 * `selfIsMedical` when the person asking is the medical officer: nobody else on board is told.
 */
function useCareTeam(crewId: string) {
  const s = useStore()
  const medical = s.data.accounts.accounts.find((a) => a.role === 'medical')
  const surgeon = s.data.accounts.accounts.find((a) => a.role === 'surgeon')
  return {
    medical: medical && medical.crewId !== crewId ? s.nameOf(medical.crewId) : null,
    selfIsMedical: medical?.crewId === crewId,
    surgeon: surgeon ? s.nameOf(surgeon.crewId) : null,
  }
}

function ConferenceCard({ crewId, open, onOpen }: { crewId: string; open: boolean; onOpen: () => void }) {
  const s = useStore()
  const team = useCareTeam(crewId)
  const sent = s.todayResult.people[crewId]?.conference ?? null
  const [urgent, setUrgent] = useState<boolean | null>(null)
  const delay = delayText(s.commDelaySec)
  const surgeon = team.surgeon ? `${team.surgeon}, your flight surgeon,` : 'Your flight surgeon'
  const onBoard = team.selfIsMedical
    ? 'You are the crew medical officer, so nobody else on board is told.'
    : `${team.medical ? `${team.medical}, the crew medical officer,` : 'The crew medical officer'} has been told privately, now.`
  const onBoardShort = team.selfIsMedical ? 'Nobody else on board is told (you are the medical officer)' : `${team.medical ?? 'The crew medical officer'} on board is told at once`

  if (sent) {
    const isUrgent = sent === 'urgent'
    return (
      <Card title="Talk to your flight surgeon" tone={isUrgent ? 'alert' : undefined}>
        <p role="status">
          <Mark tone={isUrgent ? 'alert' : 'ok'}>{isUrgent ? 'Urgent request sent' : 'Request sent'}</Mark>
        </p>
        <p className="muted">
          {isUrgent
            ? `${onBoard} ${surgeon} gets your request in ${delay}. Nothing about it appears on the crew board.`
            : `${surgeon} gets your request in ${delay} and will take it at the next scheduled conference. Nobody on board is told.`}
        </p>
        {!isUrgent && (
          <button type="button" className="btn btn-quiet" onClick={() => s.requestConference(crewId, true)}>
            Make it urgent
          </button>
        )}
      </Card>
    )
  }

  return (
    <Card title="Talk to your flight surgeon">
      <p className="muted">Ask for a private medical conference at any time, without finishing the check-in.</p>
      {!open ? (
        <button type="button" className="btn" onClick={onOpen}>
          Ask for a conference
        </button>
      ) : (
        <fieldset className="ci-conf">
          <legend className="sr-only">When do you need it?</legend>
          <label className={urgent === false ? 'ci-choice ci-choice-on' : 'ci-choice'}>
            <input type="radio" name="conference" checked={urgent === false} onChange={() => setUrgent(false)} />
            <span>
              <strong>At the next scheduled conference</strong>
              <span className="fine">Only {team.surgeon ?? 'your flight surgeon'} is told.</span>
            </span>
          </label>
          <label className={urgent === true ? 'ci-choice ci-choice-on ci-choice-urgent' : 'ci-choice'}>
            <input type="radio" name="conference" checked={urgent === true} onChange={() => setUrgent(true)} />
            <span>
              <strong>Urgent: now</strong>
              <span className="fine">
                {onBoardShort}; {team.surgeon ?? 'the flight surgeon'} gets it in {delay}.
              </span>
            </span>
          </label>
          <button
            type="button"
            className={urgent ? 'btn btn-primary btn-urgent' : 'btn btn-primary'}
            disabled={urgent === null}
            onClick={() => urgent !== null && s.requestConference(crewId, urgent)}
          >
            Send request
          </button>
        </fieldset>
      )}
    </Card>
  )
}

function Receipt({ crewId, reaction, onChange }: { crewId: string; reaction: ReactionResult | null; onChange: () => void }) {
  const s = useStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const sent = s.checkIns.find((c) => c.crewId === crewId && c.day === s.today && !c.simulated)
  if (!sent) return null
  const ratings: RatingKey[] = RATINGS.map((r) => r.key)
  return (
    <div className="stack checkin">
      <Card title={<Mark tone="ok">Checked in, day {s.today}</Mark>} aside={<span className="origin">Saved in this browser</span>}>
        <dl className="ci-receipt">
          {ratings.map((k) => (
            <div key={k}>
              <dt>{SPEC[k].label}</dt>
              <dd>{sent[k]}/10</dd>
            </div>
          ))}
          <div>
            <dt>Symptoms</dt>
            <dd>{sent.symptoms.length ? sent.symptoms.map(symptomLabel).join(', ') : 'None'}</dd>
          </div>
          <div>
            <dt>Reaction test</dt>
            <dd>{reaction ? `${Math.round(reaction.meanMs)} ms average` : 'Not taken'}</dd>
          </div>
          <div>
            <dt>Slept (wearable)</dt>
            <dd>{sent.sleepHours !== null ? hoursText(sent.sleepHours) : 'No reading'}</dd>
          </div>
        </dl>
        <div className="row">
          <a className="btn btn-primary" href={hrefOf('dashboard', import.meta.env.BASE_URL, `?day=${s.today}`)}>
            See my dashboard
          </a>
          <button type="button" className="btn btn-quiet" onClick={onChange}>
            Change today's answers
          </button>
        </div>
      </Card>
      <ConferenceCard crewId={crewId} open={helpOpen} onOpen={() => setHelpOpen(true)} />
    </div>
  )
}
