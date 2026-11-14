import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactionResult } from '../state.tsx'
import { Origin } from './bits.tsx'

// A short reaction test in the style of NASA's Reaction Self Test (PVT-B): wait, then tap as soon
// as the counter starts. The flight protocol is 3 minutes; the demo runs 30 seconds.
// Browser timing includes display and input lag, so the result is an estimate. It is never stored.
const DURATION_MS = 30_000
const MIN_WAIT_MS = 1000
const MAX_WAIT_MS = 4000
const LAPSE_MS = 500 // demo parameter
const TIMEOUT_MS = 3000

type Phase = 'idle' | 'waiting' | 'go' | 'done'

export function ReactionTest({ result, onResult }: { result: ReactionResult | null; onResult: (r: ReactionResult | null) => void }) {
  const [phase, setPhase] = useState<Phase>(result ? 'done' : 'idle')
  const [elapsed, setElapsed] = useState(0)
  const [last, setLast] = useState<string>('')
  const startedAt = useRef(0)
  const goAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)
  const times = useRef<number[]>([])
  const falseStarts = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  const finish = useCallback(() => {
    window.clearTimeout(timer.current)
    if (raf.current) cancelAnimationFrame(raf.current)
    const t = times.current
    setPhase('done')
    onResult(
      t.length
        ? {
            meanMs: Math.round(t.reduce((a, b) => a + b, 0) / t.length),
            responses: t.length,
            lapses: t.filter((x) => x >= LAPSE_MS).length,
            falseStarts: falseStarts.current,
          }
        : null,
    )
  }, [onResult])

  const arm = useCallback(() => {
    if (performance.now() - startedAt.current >= DURATION_MS) return finish()
    setPhase('waiting')
    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS)
    timer.current = window.setTimeout(() => {
      goAt.current = performance.now()
      setPhase('go')
      timer.current = window.setTimeout(() => {
        // no response: counts as a lapse at the timeout
        times.current.push(TIMEOUT_MS)
        setLast('No response')
        arm()
      }, TIMEOUT_MS)
    }, wait)
  }, [finish])

  const start = () => {
    times.current = []
    falseStarts.current = 0
    startedAt.current = performance.now()
    setLast('')
    setElapsed(0)
    const tick = () => {
      setElapsed(performance.now() - startedAt.current)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    arm()
  }

  const tap = useCallback(() => {
    if (phaseRef.current === 'go') {
      const rt = performance.now() - goAt.current
      window.clearTimeout(timer.current)
      times.current.push(rt)
      setLast(`${Math.round(rt)} ms`)
      arm()
    } else if (phaseRef.current === 'waiting') {
      falseStarts.current += 1
      setLast('Too early')
    }
  }, [arm])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (phaseRef.current === 'go' || phaseRef.current === 'waiting')) {
        e.preventDefault()
        tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer.current)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [tap])

  const running = phase === 'waiting' || phase === 'go'
  const left = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000))

  return (
    <div className="rt">
      {phase === 'idle' && (
        <button type="button" className="btn" onClick={start}>
          Start the 30-second test
        </button>
      )}
      {running && (
        <button type="button" className={`rt-pad rt-${phase}`} onPointerDown={tap} aria-label="Tap when the pad lights up">
          <span className="rt-big">{phase === 'go' ? 'TAP' : 'Wait…'}</span>
          <span className="rt-small">
            {left} s left{last ? ` · last: ${last}` : ''} · tap here or press space
          </span>
        </button>
      )}
      {phase === 'done' && (
        <div className="rt-result">
          {result ? (
            <p>
              <strong>{result.meanMs} ms</strong> mean response · {result.responses} responses · {result.lapses} slow (≥ {LAPSE_MS} ms) ·{' '}
              {result.falseStarts} early taps
            </p>
          ) : (
            <p>No responses recorded.</p>
          )}
          <p className="fine">
            <Origin kind="live" /> Shown for this session only. Browser timing is an estimate, and you have no baseline here yet, so it is
            not compared with anything.
          </p>
          <button type="button" className="link" onClick={start}>
            Run it again
          </button>
        </div>
      )}
    </div>
  )
}
