import { Component, type ErrorInfo, type ReactNode } from 'react'

// The last line of defence: without a boundary React unmounts the whole tree on a render error and
// the person is left with a black page. Here they get a way back instead.

/** The same key as STORE_KEY in state.tsx: the live check-ins and conference requests of this browser. */
const SAVED_INPUTS_KEY = 'shipshape.v1'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Shipshape stopped on an error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const clearAndReload = () => {
      try {
        localStorage.removeItem(SAVED_INPUTS_KEY)
      } catch {
        // storage unavailable: the reload alone is all that can be done
      }
      window.location.reload()
    }
    return (
      <div className="boot" role="alert">
        <h1 className="boot-title">This page hit a problem</h1>
        <p>Nothing was lost on the ship: the demo data is read-only. Reloading usually fixes it.</p>
        <p className="boot-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="btn" href={import.meta.env.BASE_URL}>
            Back to the start page
          </a>
        </p>
        <p className="fine">
          Still stuck? A check-in saved in this browser by an older version can cause this.{' '}
          <button type="button" className="link" onClick={clearAndReload}>
            Clear my saved inputs and reload
          </button>
        </p>
        <p className="fine boot-detail">{error.message}</p>
      </div>
    )
  }
}
