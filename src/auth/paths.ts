// The five pages, without a router. "/" is the login and "/challenge" is public; the other three need a
// logged-in person.

export type Page = 'login' | 'challenge' | 'dashboard' | 'checkin' | 'app'

const PAGE_PATHS: Record<Exclude<Page, 'login'>, string> = { challenge: '/challenge', dashboard: '/dashboard', checkin: '/checkin', app: '/app' }

/** Path inside the app, without the deploy base and without a trailing slash ("" for the root). */
export function appPath(pathname: string, base: string): string {
  const p = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname
  return p.replace(/\/+$/, '')
}

export function pageOf(path: string): Page {
  const found = (Object.keys(PAGE_PATHS) as Exclude<Page, 'login'>[]).find((p) => PAGE_PATHS[p] === path)
  return found ?? 'login'
}

/** A URL for a page, under the deploy base. */
export function hrefOf(page: Page, base: string, search = ''): string {
  const path = page === 'login' ? '' : PAGE_PATHS[page].slice(1)
  return `${base}${path}${search}`
}

/**
 * Where to go after login. Only our own pages are accepted (with their query string),
 * so a crafted ?next= link cannot send someone to another site.
 */
export function safeNext(raw: string | null, base: string, origin: string): string {
  const fallback = hrefOf('dashboard', base)
  if (!raw) return fallback
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return fallback
  }
  if (url.origin !== origin) return fallback
  const page = pageOf(appPath(url.pathname, base))
  return page === 'login' ? fallback : hrefOf(page, base, url.search)
}
