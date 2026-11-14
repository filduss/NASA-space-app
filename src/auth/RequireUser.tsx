import { useEffect, type ReactNode } from 'react'
import { useStore } from '../state.tsx'
import { hrefOf, type Page } from './paths.ts'
import { mayOpen } from './session.ts'

/**
 * Shows a page only to a logged-in person whose role may open it. Nobody logged in goes to the
 * login with a way back; a logged-in person without access goes to their own dashboard.
 */
export function RequireUser({ page, children }: { page: Page; children: ReactNode }) {
  const { user } = useStore()
  const allowed = user !== null && mayOpen(user, page)
  useEffect(() => {
    if (allowed) return
    const base = import.meta.env.BASE_URL
    if (user) {
      window.location.replace(hrefOf('dashboard', base))
      return
    }
    const here = window.location.pathname + window.location.search
    window.location.replace(hrefOf('login', base, `?next=${encodeURIComponent(here)}`))
  }, [allowed, user])
  return allowed ? children : null
}
