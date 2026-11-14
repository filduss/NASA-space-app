import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { Login } from './auth/Login.tsx'
import { appPath, pageOf } from './auth/paths.ts'
import { RequireUser } from './auth/RequireUser.tsx'
import { StoreProvider } from './state.tsx'
import './styles.css'

// Three pages, no router: "/" is the login, /dashboard the personal dashboard, /app the crew app
// (medical officer only).
// The dashboard (and three.js with it) loads only when that page is opened.
const Dashboard = lazy(() => import('./dashboard/Dashboard.tsx').then((m) => ({ default: m.Dashboard })))
const page = pageOf(appPath(window.location.pathname, import.meta.env.BASE_URL))

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <StoreProvider>
      <Suspense fallback={<p className="boot">Loading…</p>}>
        {page === 'login' ? (
          <Login />
        ) : (
          <RequireUser page={page}>{page === 'dashboard' ? <Dashboard /> : <App />}</RequireUser>
        )}
      </Suspense>
    </StoreProvider>
  </StrictMode>,
)
