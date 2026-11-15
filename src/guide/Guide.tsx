import { useEffect, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import { EMERGENCY_LINE, ENTRIES, listed, readingsFor, SECTIONS, summary, visibleParts, type GuideEntry } from './entries.ts'
import { searchGuide } from './search.ts'

/** A link to one Guide entry, for the "?" next to a check-in item. */
export function guideHref(id: string): string {
  return `${hrefOf('guide', import.meta.env.BASE_URL)}#${id}`
}

export function GuideLink({ id, label }: { id: string; label: string }) {
  return (
    <a className="guide-q" href={guideHref(id)} aria-label={`${label}: open in the Guide`} title="Open in the Guide">
      ?
    </a>
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
      setOpen((o) => new Set(o).add(id))
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

  const results = query.trim() ? searchGuide(query) : null
  const list = (entries: GuideEntry[]) => (
    <div className="guide-list">
      {entries.map((e) => (
        <Entry key={e.id} entry={e} open={open.has(e.id)} onToggle={(o) => toggle(e.id, o)} />
      ))}
    </div>
  )

  return (
    <div className="stack guide">
      <p className="guide-emergency" role="note">
        {EMERGENCY_LINE}
      </p>
      <input
        type="search"
        className="guide-search"
        placeholder="Search: headache, can’t sleep, oxygen…"
        aria-label="Search the Guide"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results ? (
        results.length > 0 ? (
          list(results)
        ) : (
          <p className="muted">Nothing in the Guide matches “{query.trim()}”. Try another word, or ask your crew medical officer.</p>
        )
      ) : (
        SECTIONS.map((s) => (
          <section key={s.key} aria-labelledby={`guide-${s.key}`}>
            <h2 id={`guide-${s.key}`} className="guide-h">
              {s.title}
            </h2>
            {list(ENTRIES.filter((e) => e.section === s.key && listed(e)))}
          </section>
        ))
      )}
    </div>
  )
}

function Entry({ entry, open, onToggle }: { entry: GuideEntry; open: boolean; onToggle: (open: boolean) => void }) {
  const parts = visibleParts(entry)
  const readings = entry.section === 'risks' ? readingsFor(entry.risks[0]).filter(listed) : []
  return (
    <details id={entry.id} className="guide-entry" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <span className="guide-title">{entry.title}</span>
        <span className="guide-sum">{summary(entry)}</span>
      </summary>
      <div className="guide-body">
        {/* The first line is already the summary. */}
        {parts.slice(1).map((p) => (
          <div key={p.key} className={p.key === 'tellNow' ? 'guide-part guide-tell' : 'guide-part'}>
            <h3>{p.heading}</h3>
            {p.key === 'tellNow' ? (
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
                <a key={r.id} href={`#${r.id}`}>
                  {r.title}
                </a>
              ))}
            </p>
          </div>
        )}
      </div>
    </details>
  )
}
