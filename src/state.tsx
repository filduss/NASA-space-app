import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appPath, hrefOf, pageOf } from './auth/paths.ts'
import { isPinShaped, verifyPin } from './auth/pin.ts'
import { attemptsFor, clearFailures, currentUser, endSession, FREE_ATTEMPTS, recordFailure, startSession, viewKey, viewsFor, type User } from './auth/session.ts'
import type { AccountsFile, BacktestFile, CabinFile, CrewFile } from './data/types.ts'
import { runEngine } from './engine/escalation.ts'
import { MISSIONS, type MissionKey, type MissionSetting } from './engine/mission.ts'
import type { Viewer } from './engine/privacy.ts'
import type { CheckIn, ConferenceRequest, DayResult, SurgeonSummary } from './engine/types.ts'
import { wearableReading, type WearableReading } from './data/wearable.ts'

export type Role = Viewer
export type Screen = 'board' | 'checkin' | 'ship' | 'inbox' | 'summary'
const SCREENS: Screen[] = ['board', 'checkin', 'ship', 'inbox', 'summary']

/** ?day=, ?screen= and ?mission= open a page on a given day, screen and setting (links and the judge's tour). */
function fromUrl(): { day: number; screen: Screen | null; mission: MissionKey | null } {
  const q = new URLSearchParams(window.location.search)
  const screen = q.get('screen') as Screen | null
  const mission = q.get('mission') as MissionKey | null
  return {
    day: Number(q.get('day')),
    screen: screen && SCREENS.includes(screen) ? screen : null,
    mission: mission && mission in MISSIONS ? mission : null,
  }
}

/** Where a view opens: a crew member on their check-in, the flight surgeon on the summaries. */
function firstScreen(r: Role): Screen {
  return r.kind === 'crew' ? 'checkin' : r.kind === 'surgeon' ? 'summary' : 'board'
}

/** What the browser keeps between visits. Reaction-test results are never in here. */
interface Local {
  liveCheckIns: CheckIn[]
  shareWatch: Record<string, boolean>
  /** Conference requests made in this browser. */
  requests: ConferenceRequest[]
}
const EMPTY: Local = { liveCheckIns: [], shareWatch: {}, requests: [] }
const STORE_KEY = 'shipshape.v1'

function loadLocal(): Local {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return EMPTY
    // Only the fields this version keeps: older saves also carried XP events and quest ticks. An older
    // check-in's safety answer becomes an urgent conference request, so it is not lost.
    const saved = JSON.parse(raw) as Partial<Local>
    const liveCheckIns = (saved.liveCheckIns ?? []) as (CheckIn & { safetyFlag?: boolean })[]
    const fromOld = liveCheckIns.filter((c) => c.safetyFlag).map((c) => ({ crewId: c.crewId, day: c.day, urgent: true }))
    const requests = [...(saved.requests ?? [])]
    for (const r of fromOld) if (!requests.some((x) => x.crewId === r.crewId && x.day === r.day)) requests.push(r)
    return { liveCheckIns: liveCheckIns.map(({ safetyFlag: _old, ...c }) => c), shareWatch: saved.shareWatch ?? {}, requests }
  } catch {
    return EMPTY
  }
}

export interface ReactionResult {
  meanMs: number
  responses: number
  lapses: number
  falseStarts: number
}

interface Data {
  cabin: CabinFile
  crew: CrewFile
  accounts: AccountsFile
  backtest: BacktestFile | null
}

export type LoginResult = { ok: true } | { ok: false; reason: 'wrong'; attemptsLeft: number } | { ok: false; reason: 'locked'; lockedUntil: number }

interface Store {
  data: Data
  /** The logged-in person, checked against accounts.json; null on the login page. */
  user: User | null
  /**
   * Checks the PIN and starts the session. With `goTo`, a correct PIN loads that URL straight away
   * and the logged-in person on this page is left as they were: a tour link on a page the new
   * person may not open would otherwise be overtaken by RequireUser sending them home.
   */
  logIn: (crewId: string, pin: string, goTo?: string) => Promise<LoginResult>
  logOut: () => void
  /** The views this person may take on this page (viewsFor). */
  views: Role[]
  role: Role
  setRole: (r: Role) => void
  screen: Screen
  setScreen: (s: Screen) => void
  today: number
  setToday: (d: number) => void
  dayRange: [number, number]
  /** Where the crew is. Changes the comm delay and the radiation dose rate, never the rules. */
  mission: MissionSetting
  setMission: (k: MissionKey) => void
  /** One-way signal delay to Earth, seconds. */
  commDelaySec: number
  setCommDelaySec: (s: number) => void
  nameOf: (crewId: string) => string
  /** Check-ins up to today: simulated ones, with live entries replacing them. */
  checkIns: CheckIn[]
  results: DayResult[]
  todayResult: DayResult
  summaries: SurgeonSummary[]
  local: Local
  /** In memory only, gone on reload: the live reaction test is never stored. */
  liveReaction: Record<string, ReactionResult>
  submitCheckIn: (c: CheckIn, reaction: ReactionResult | null) => void
  /** Sends a conference request on its own, without the check-in. A second request the same day can only make it urgent. */
  requestConference: (crewId: string, urgent: boolean) => void
  /** The wearable's reading for a person today; null when it has none. */
  wearableToday: (crewId: string) => WearableReading | null
  toggleShare: (crewId: string) => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('store not ready')
  return s
}

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  return (await res.json()) as T
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      getJson<CabinFile>('cabin.json'),
      getJson<CrewFile>('crew.json'),
      getJson<AccountsFile>('accounts.json'),
      getJson<BacktestFile>('backtest.json').catch(() => null),
    ])
      .then(([cabin, crew, accounts, backtest]) => alive && setData({ cabin, crew, accounts, backtest }))
      .catch((e: unknown) => alive && setError(String(e)))
    return () => {
      alive = false
    }
  }, [])

  if (error)
    return (
      <div className="boot" role="alert">
        <h1 className="boot-title">Ship Or Me? could not load its data</h1>
        <p>The connection may have dropped while the page was loading.</p>
        <p className="boot-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
        <p className="fine boot-detail">
          {error}. Running from source? <code>public/data/</code> is committed; <code>npm run data</code> rebuilds it.
        </p>
      </div>
    )
  if (!data) return <p className="boot">Loading…</p>
  return <Ready data={data}>{children}</Ready>
}

function Ready({ data, children }: { data: Data; children: ReactNode }) {
  const [firstDay, lastDay] = data.crew.meta.days
  const dayRange: [number, number] = [firstDay + 21, lastDay]
  const [url] = useState(fromUrl)
  const [user, setUser] = useState<User | null>(() => currentUser(sessionStorage, data.accounts.accounts, Date.now()))
  // A person only ever takes the views their role allows on this page (viewsFor): never another
  // crew member's. Pages without views (the dashboard) never read the role.
  const [views] = useState<Role[]>(() => (user ? viewsFor(user, pageOf(appPath(window.location.pathname, import.meta.env.BASE_URL))) : []))
  const [role, setRoleState] = useState<Role>(() => views[0] ?? { kind: 'crew', crewId: user?.crewId ?? data.crew.crew[0].id })
  const [screen, setScreen] = useState<Screen>(() => url.screen ?? firstScreen(role))
  const [today, setToday] = useState(() => (Number.isInteger(url.day) && url.day >= dayRange[0] && url.day <= dayRange[1] ? url.day : data.crew.meta.demoDay))
  const [missionKey, setMissionKey] = useState<MissionKey>(url.mission ?? 'mars')
  const [commDelaySec, setCommDelaySec] = useState(MISSIONS[url.mission ?? 'mars'].defaultDelaySec)
  const [local, setLocal] = useState<Local>(loadLocal)
  const [liveReaction, setLiveReaction] = useState<Record<string, ReactionResult>>({})

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(local))
    } catch {
      // storage can be unavailable (private window); the app still works for the session
    }
  }, [local])

  // "Viewing as" offers only the views this person's role allows.
  const setRole = useCallback(
    (r: Role) => {
      if (!views.some((v) => viewKey(v) === viewKey(r))) return
      setRoleState(r)
      setScreen(firstScreen(r))
    },
    [views],
  )

  const logIn = useCallback(
    async (crewId: string, pin: string, goTo?: string): Promise<LoginResult> => {
      const now = Date.now()
      const before = attemptsFor(localStorage, crewId)
      if (before.lockedUntil > now) return { ok: false, reason: 'locked', lockedUntil: before.lockedUntil }
      const account = data.accounts.accounts.find((a) => a.crewId === crewId)
      const ok = account !== undefined && isPinShaped(pin) && (await verifyPin(account, pin, data.accounts.meta.kdf))
      if (!ok) {
        const after = recordFailure(localStorage, crewId, Date.now())
        if (after.lockedUntil > 0) return { ok: false, reason: 'locked', lockedUntil: after.lockedUntil }
        return { ok: false, reason: 'wrong', attemptsLeft: FREE_ATTEMPTS - after.fails }
      }
      clearFailures(localStorage, crewId)
      startSession(sessionStorage, crewId, Date.now())
      if (goTo) window.location.assign(goTo)
      else setUser({ crewId, role: account.role })
      return { ok: true }
    },
    [data],
  )

  // Ends the session and reloads the login page fresh, with no ?next= back to where the person was.
  const logOut = useCallback(() => {
    endSession(sessionStorage)
    window.location.assign(hrefOf('login', import.meta.env.BASE_URL))
  }, [])

  // A new setting brings its own distance to Earth, so the delay resets to that setting's default.
  const setMission = useCallback((k: MissionKey) => {
    setMissionKey(k)
    setCommDelaySec(MISSIONS[k].defaultDelaySec)
  }, [])

  const names = useMemo(() => {
    const m = new Map(data.crew.crew.map((c) => [c.id, c.name]))
    for (const a of data.accounts.accounts) if (a.name && !m.has(a.crewId)) m.set(a.crewId, a.name)
    return m
  }, [data])
  const nameOf = useCallback((id: string) => names.get(id) ?? id, [names])
  const crewIds = useMemo(() => data.crew.crew.map((c) => c.id), [data])

  const checkIns = useMemo(() => {
    const live = new Map(local.liveCheckIns.map((c) => [`${c.crewId}|${c.day}`, c]))
    const merged = data.crew.checkIns.filter((c) => c.day <= today && !live.has(`${c.crewId}|${c.day}`))
    for (const c of live.values()) if (c.day <= today) merged.push(c)
    return merged
  }, [data, local.liveCheckIns, today])

  const results = useMemo(
    () => runEngine({ crewIds, checkIns, cabin: data.cabin.daily, fromDay: firstDay, toDay: today, shareWatch: local.shareWatch, requests: local.requests }),
    [crewIds, checkIns, data, firstDay, today, local.shareWatch, local.requests],
  )
  const todayResult = results[results.length - 1]
  const summaries = useMemo(() => results.flatMap((r) => r.summaries).reverse(), [results])

  const submitCheckIn = useCallback((c: CheckIn, reaction: ReactionResult | null) => {
    // The reaction result stays in memory for this session; storage only ever gets null.
    const stored: CheckIn = { ...c, reactionMs: null, simulated: false }
    setLocal((l) => ({
      ...l,
      liveCheckIns: [...l.liveCheckIns.filter((x) => !(x.crewId === c.crewId && x.day === c.day)), stored],
    }))
    setLiveReaction((r) => {
      const next = { ...r }
      if (reaction) next[`${c.crewId}|${c.day}`] = reaction
      else delete next[`${c.crewId}|${c.day}`]
      return next
    })
  }, [])

  const requestConference = useCallback(
    (crewId: string, urgent: boolean) => {
      setLocal((l) => {
        const same = l.requests.find((r) => r.crewId === crewId && r.day === today)
        if (same && (same.urgent || !urgent)) return l
        return { ...l, requests: [...l.requests.filter((r) => r !== same), { crewId, day: today, urgent }] }
      })
    },
    [today],
  )

  const wearableToday = useCallback((id: string) => wearableReading(data.crew, id, today), [data, today])

  const toggleShare = useCallback((id: string) => {
    setLocal((l) => ({ ...l, shareWatch: { ...l.shareWatch, [id]: !l.shareWatch[id] } }))
  }, [])

  const reset = useCallback(() => {
    setLocal(EMPTY)
    setLiveReaction({})
  }, [])

  const store: Store = {
    data,
    user,
    logIn,
    logOut,
    views,
    role,
    setRole,
    screen,
    setScreen,
    today,
    setToday,
    dayRange,
    mission: MISSIONS[missionKey],
    setMission,
    commDelaySec,
    setCommDelaySec,
    nameOf,
    checkIns,
    results,
    todayResult,
    summaries,
    local,
    liveReaction,
    submitCheckIn,
    requestConference,
    wearableToday,
    toggleShare,
    reset,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
