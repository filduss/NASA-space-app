import type { ReactNode } from 'react'
import { HRP_RISKS, type HrpRiskKey } from '../data/hrp.ts'

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

/** `tour` marks the card for the walkthrough (src/ui/Walkthrough.tsx). */
export function Card({ title, aside, tone, children, id, tour }: { title?: ReactNode; aside?: ReactNode; tone?: Tone; children: ReactNode; id?: string; tour?: string }) {
  return (
    <section className={`card${tone ? ` card-${tone}` : ''}`} id={id} data-tour={tour}>
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

/** "NASA risk: Sleep loss": the NASA Human System Risks a reading informs, each linked to NASA's page. */
export function RiskLinks({ risks }: { risks: HrpRiskKey[] }) {
  if (risks.length === 0) return null
  return (
    <span className="risk-links">
      NASA risk{risks.length > 1 ? 's' : ''}:{' '}
      {risks.map((k, i) => (
        <span key={k}>
          {i > 0 && ', '}
          <a href={HRP_RISKS[k].url} target="_blank" rel="noreferrer" title={HRP_RISKS[k].title}>
            {HRP_RISKS[k].short}
          </a>
        </span>
      ))}
    </span>
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
