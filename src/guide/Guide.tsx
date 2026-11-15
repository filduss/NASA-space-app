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
const entryOfHash = () => (entryById(hashId()) ? hashId() : null)

/** Shown in the reading pane on a wide screen before a topic is picked. */
const FIRST = 'you-or-ship'

/**
 * The Guide: a list of topics with a search box, and a reading pane for the open one. Passive: it never
 * shows the reader's own numbers. The open topic is the URL's hash (`/guide#sleep`), so links, the back
 * button and a reload all land on it. On a phone the list and the topic take turns; side by side otherwise.
 */
export function Guide() {
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<string | null>(entryOfHash)
  const pane = useRef<HTMLElement>(null)

  useEffect(() => {
    const onHash = () => {
      setCurrent(entryOfHash())
      // Bring the start of the topic into view when the page has scrolled past it.
      requestAnimationFrame(() => {
        const top = pane.current?.getBoundingClientRect().top ?? 0
        if (top < 0) pane.current?.scrollIntoView({ block: 'start' })
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const backToList = () => {
    history.pushState(null, '', window.location.pathname + window.location.search)
    setCurrent(null)
  }

  const q = query.trim()
  const results = q ? searchGuide(q) : null
  const shown = entryById(current ?? FIRST)!

  return (
    <div className="guide">
      <div className="guide-note" role="note">
        <p>{EMERGENCY_LINE}</p>
        <p>{CONCERN_LINE}</p>
      </div>
      <div className={current ? 'guide-layout guide-reading' : 'guide-layout'}>
        <nav className="guide-side" aria-label="Guide topics">
          <input
            type="search"
            className="guide-search"
            placeholder="Search: headache, can’t sleep…"
            aria-label="Search the Guide"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results ? (
            <>
              <p className="guide-count" aria-live="polite">
                {results.length === 0
                  ? `Nothing matches “${q}”. Try another word, or ask your crew medical officer.`
                  : `${results.length} ${results.length === 1 ? 'topic' : 'topics'}, best match first`}
              </p>
              <Rows entries={results} current={shown.id} mixed />
            </>
          ) : (
            SECTIONS.map((s) => (
              <section key={s.key} aria-labelledby={`guide-${s.key}`}>
                <h2 id={`guide-${s.key}`} className="guide-h">
                  {s.title}
                </h2>
                <Rows entries={ENTRIES.filter((e) => e.section === s.key && listed(e))} current={shown.id} />
              </section>
            ))
          )}
        </nav>
        <article ref={pane} className="guide-pane" aria-labelledby="guide-pane-title">
          <button type="button" className="guide-back" onClick={backToList}>
            ‹ All topics
          </button>
          {shown.section === 'risks' && <p className="guide-kind">NASA risk</p>}
          <h2 id="guide-pane-title" className="guide-pane-title">
            {shown.title}
          </h2>
          <p className="guide-lead">{summary(shown)}</p>
          <EntryBody entry={shown} />
        </article>
      </div>
    </div>
  )
}

/** Topics as rows of a grouped list. `mixed`: rows from every section, as search results are, so a risk says it is one. */
function Rows({ entries, current, mixed = false }: { entries: GuideEntry[]; current: string; mixed?: boolean }) {
  return (
    <ul className="guide-rows">
      {entries.map((e) => (
        <li key={e.id}>
          <a href={`#${e.id}`} className="guide-row" aria-current={e.id === current ? 'true' : undefined}>
            <span className="guide-row-title">
              {mixed && e.section === 'risks' && <span className="guide-tag">NASA risk</span>}
              {e.title}
            </span>
            <span className="guide-row-sum">{summary(e)}</span>
          </a>
        </li>
      ))}
    </ul>
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
