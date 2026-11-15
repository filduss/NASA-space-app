import { useEffect, useRef, useState, type ReactNode } from 'react'
import { hrefOf } from '../auth/paths.ts'
import {
  CONCERN_LINE,
  EMERGENCY_LINE,
  ENTRIES,
  entryById,
  listed,
  readingsFor,
  SECTIONS,
  summary,
  visibleParts,
  type GuideEntry,
} from './entries.ts'
import { searchGuide } from './search.ts'

/** A link to one Guide entry, from any page. */
function guideHref(id: string): string {
  return `${hrefOf('guide', import.meta.env.BASE_URL)}#${id}`
}

/**
 * The "?" next to a check-in item, or a text button when given children. It opens the entry in a sheet over
 * the page instead of leaving it, so a half-filled check-in is not lost. `toGuide` adds a link on to the
 * whole Guide, for pages with nothing to lose by leaving (the dashboard).
 */
export function GuideLink({
  id,
  label,
  children,
  className,
  toGuide = false,
}: {
  id: string
  label: string
  children?: ReactNode
  className?: string
  toGuide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const entry = entryById(id)

  useEffect(() => {
    if (open) dialog.current?.showModal()
  }, [open])

  if (!entry) return null
  const close = () => dialog.current?.close()
  return (
    <>
      <button
        type="button"
        className={className ?? (children ? 'link guide-text' : 'guide-q')}
        aria-label={children ? undefined : `${label}: what it means`}
        title={`${entry.title}: what it means`}
        onClick={(e) => {
          // The button can sit inside something clickable, such as a dashboard tile that opens a chart.
          e.stopPropagation()
          setOpen(true)
        }}>
        {children ?? '?'}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="guide-sheet"
          aria-labelledby={`sheet-${id}`}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            // React passes clicks in the sheet up to the button's parents; keep them here.
            e.stopPropagation()
            // A click on the backdrop lands on the dialog itself; the content fills it otherwise.
            if (e.target === e.currentTarget) close()
          }}>
          <div className="guide-sheet-in">
            <div className="guide-sheet-head">
              <h2 id={`sheet-${id}`}>{entry.title}</h2>
              <button type="button" className="guide-sheet-x" aria-label="Close" onClick={close}>
                ×
              </button>
            </div>
            <p className="guide-sum">{summary(entry)}</p>
            <EntryBody entry={entry} />
            {toGuide && (
              <a className="guide-sheet-more" href={guideHref(id)}>
                Open in the Guide
              </a>
            )}
          </div>
        </dialog>
      )}
    </>
  )
}

const hashId = () => decodeURIComponent(window.location.hash.slice(1))

/**
 * The Guide: a search box over plain explanations of every reading. Passive: it never shows the reader's
 * own numbers. An entry opens in place; `/guide#sleep` opens one directly.
 */
export function Guide() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set(hashId() ? [hashId()] : []))

  useEffect(() => {
    const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
    const onHash = () => {
      const id = hashId()
      if (!id) return
      setQuery('')
      // Section jumps scroll by themselves; only an entry needs opening.
      if (entryById(id)) setOpen((o) => new Set(o).add(id))
      scrollTo(id)
    }
    if (hashId()) scrollTo(hashId())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const toggle = (id: string, isOpen: boolean) =>
    setOpen((o) => {
      if (o.has(id) === isOpen) return o
      const next = new Set(o)
      if (isOpen) next.add(id)
      else next.delete(id)
      return next
    })

  const q = query.trim()
  const results = q ? searchGuide(q) : null
  const list = (entries: GuideEntry[]) => (
    <div className="guide-list">
      {entries.map((e) => (
        <Entry key={e.id} entry={e} open={open.has(e.id)} onToggle={(o) => toggle(e.id, o)} mixed={!!results} />
      ))}
    </div>
  )

  return (
    <div className="stack guide">
      <div className="guide-note" role="note">
        <p>{EMERGENCY_LINE}</p>
        <p>{CONCERN_LINE}</p>
      </div>
      <div className="guide-find">
        <input
          type="search"
          className="guide-search"
          placeholder="Search: headache, can’t sleep, oxygen…"
          aria-label="Search the Guide"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!results && (
        <nav className="guide-jump" aria-label="Guide sections">
          {SECTIONS.map((s) => (
            <a key={s.key} href={`#guide-${s.key}`}>
              {s.title}
            </a>
          ))}
        </nav>
      )}
      {results ? (
        <section aria-label="Search results">
          <p className="guide-count" aria-live="polite">
            {results.length === 0
              ? `Nothing in the Guide matches “${q}”. Try another word, or ask your crew medical officer.`
              : `${results.length} ${results.length === 1 ? 'entry' : 'entries'} for “${q}”, best match first`}
          </p>
          {list(results)}
        </section>
      ) : (
        SECTIONS.map((s) => (
          <section key={s.key} id={`guide-${s.key}`} className="guide-section" aria-labelledby={`guide-${s.key}-h`}>
            <h2 id={`guide-${s.key}-h`} className="guide-h">
              {s.title}
            </h2>
            {list(ENTRIES.filter((e) => e.section === s.key && listed(e)))}
          </section>
        ))
      )}
    </div>
  )
}

/** `mixed`: shown among entries of every section, as search results are, so a risk says it is one. */
function Entry({ entry, open, onToggle, mixed }: { entry: GuideEntry; open: boolean; onToggle: (open: boolean) => void; mixed: boolean }) {
  return (
    <details id={entry.id} className="guide-entry" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <span className="guide-title">
          {mixed && entry.section === 'risks' && <span className="guide-kind">NASA risk</span>}
          {entry.title}
        </span>
        <span className="guide-sum">{summary(entry)}</span>
      </summary>
      <div className="guide-body">
        <EntryBody entry={entry} />
      </div>
    </details>
  )
}

/** Everything after the summary line: steps first, then why, limits, warning signs, and the app's part last. */
function EntryBody({ entry }: { entry: GuideEntry }) {
  const readings = entry.section === 'risks' ? readingsFor(entry.risks[0]).filter(listed) : []
  return (
    <>
      {/* The first line is already the summary. */}
      {visibleParts(entry)
        .slice(1)
        .map((p) => (
          <div key={p.key} className={`guide-part guide-${p.key}`}>
            <h3>{p.heading}</h3>
            {p.key === 'howTo' ? (
              <ol>
                {p.lines.map((l) => (
                  <li key={l.text}>{l.text}</li>
                ))}
              </ol>
            ) : p.key === 'tellNow' ? (
              <ul>
                {p.lines.map((l) => (
                  <li key={l.text}>{l.text}</li>
                ))}
              </ul>
            ) : (
              <p>{p.lines.map((l) => l.text).join(' ')}</p>
            )}
          </div>
        ))}
      {readings.length > 0 && (
        <div className="guide-part">
          <h3>Readings that inform it</h3>
          <p className="guide-links">
            {readings.map((r) => (
              <a key={r.id} href={guideHref(r.id)}>
                {r.title}
              </a>
            ))}
          </p>
        </div>
      )}
    </>
  )
}
