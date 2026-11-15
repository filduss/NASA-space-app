import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { Login } from './auth/Login.tsx'
import { appPath, pageOf } from './auth/paths.ts'
import { RequireUser } from './auth/RequireUser.tsx'
import { TourBar } from './auth/TourBar.tsx'
import { StoreProvider } from './state.tsx'
import { ChallengePage } from './ui/Challenge.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import './styles.css'

// Five pages, no router: "/" is the login with the judge's tour, /challenge the public challenge page,
// /dashboard the personal dashboard, /checkin the crew member's own check-in and /app the crew app
// (the medical console). The last three need a logged-in person who may open them.
// The dashboard (and three.js with it) loads only when that page is opened.
const Dashboard = lazy(() => import('./dashboard/Dashboard.tsx').then((m) => ({ default: m.Dashboard })))
const page = pageOf(appPath(window.location.pathname, import.meta.env.BASE_URL))

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        {page !== 'login' && <TourBar />}
        <Suspense fallback={<p className="boot">Loading…</p>}>
          {page === 'login' ? (
            <Login />
          ) : page === 'challenge' ? (
            <ChallengePage />
          ) : (
            <RequireUser page={page}>{page === 'dashboard' ? <Dashboard /> : <App page={page} />}</RequireUser>
          )}
        </Suspense>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
