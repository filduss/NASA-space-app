import { hrefOf, type Page } from '../auth/paths.ts'
import { mayOpen, type User } from '../auth/session.ts'
import './toolbar.css'

type ToolbarPage = Exclude<Page, 'login' | 'challenge'>

const LABEL: Record<ToolbarPage, string> = {
  dashboard: 'My dashboard',
  checkin: 'Check in',
  app: 'Crew app',
}

/** Toolbar glyphs, drawn in the spirit of SF Symbols: one stroke weight, rounded ends. */
function Glyph({ kind }: { kind: ToolbarPage | 'logout' }) {
  return (
    <svg className="tbtn-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {kind === 'dashboard' && (
        <>
          <rect x="2.25" y="2.25" width="5.75" height="5.75" rx="1.6" />
          <rect x="10" y="2.25" width="5.75" height="5.75" rx="1.6" />
          <rect x="2.25" y="10" width="5.75" height="5.75" rx="1.6" />
          <rect x="10" y="10" width="5.75" height="5.75" rx="1.6" />
        </>
      )}
      {kind === 'checkin' && (
        <>
          <rect x="3.25" y="2.75" width="11.5" height="13" rx="2.5" />
          <path d="M6.5 2.75v-.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5M6.25 9.4l1.8 1.8 3.7-3.9" />
        </>
      )}
      {kind === 'app' && (
        <>
          <rect x="1.75" y="4.75" width="14.5" height="10.5" rx="2.5" />
          <path d="M6.5 4.75v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M9 7.6v5M6.5 10.1h5" />
        </>
      )}
      {kind === 'logout' && <path d="M7.5 2.75H4.75a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2H7.5M12 5.5L15.25 9 12 12.5M15 9H7" />}
    </svg>
  )
}

/**
 * The page toolbar: links to the person's other pages (only those they may open), then log out.
 * The same buttons on /dashboard, /checkin and /app.
 */
export function Toolbar({ user, pages, day, onLogOut }: { user: User; pages: ToolbarPage[]; day: number; onLogOut: () => void }) {
  const links = pages.filter((p) => mayOpen(user, p))
  return (
    <nav className="toolbar" aria-label="Account">
      {links.map((p) => (
        <a key={p} className="tbtn" href={hrefOf(p, import.meta.env.BASE_URL, `?day=${day}`)} title={LABEL[p]}>
          <Glyph kind={p} />
          <span className="tbtn-label">{LABEL[p]}</span>
        </a>
      ))}
      {links.length > 0 && <span className="toolbar-sep" aria-hidden="true" />}
      <button type="button" className="tbtn tbtn-quiet" onClick={onLogOut} title="Log out">
        <Glyph kind="logout" />
        <span className="tbtn-label">Log out</span>
      </button>
    </nav>
  )
}
