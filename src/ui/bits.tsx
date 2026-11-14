import type { ReactNode } from 'react'

// Status is always shape + word, never color alone.
export type Tone = 'ok' | 'watch' | 'alert' | 'idle' | 'info'
const SHAPE: Record<Tone, string> = { ok: '●', watch: '▲', alert: '◆', idle: '○', info: '■' }

export function Mark({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`mark mark-${tone}`}>
      <span className="mark-shape" aria-hidden="true">
        {SHAPE[tone]}
      </span>
      <span>{children}</span>
    </span>
  )
}

/** Where a number came from: simulated, live or real. Shown next to everything. */
export function Origin({ kind, children }: { kind: 'simulated' | 'real' | 'live'; children?: ReactNode }) {
  const text = { simulated: 'Simulated', real: 'Real NASA data', live: 'Live, not stored' }[kind]
  return (
    <span className={`origin origin-${kind}`}>
      {text}
      {children ? <> · {children}</> : null}
    </span>
  )
}

export function Card({ title, aside, tone, children, id }: { title?: ReactNode; aside?: ReactNode; tone?: Tone; children: ReactNode; id?: string }) {
  return (
    <section className={`card${tone ? ` card-${tone}` : ''}`} id={id}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}
