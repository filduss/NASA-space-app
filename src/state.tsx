import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hrefOf } from './auth/paths.ts'
import { isPinShaped, verifyPin } from './auth/pin.ts'
import { attemptsFor, clearFailures, currentUser, endSession, FREE_ATTEMPTS, mayOpen, recordFailure, startSession, type User } from './auth/session.ts'
import type { AccountsFile, BacktestFile, CabinFile, CrewFile } from './data/types.ts'
import { runEngine } from './engine/escalation.ts'
import type { Viewer } from './engine/privacy.ts'
import type { CheckIn, DayResult, SurgeonSummary } from './engine/types.ts'
import { weeklyStreak, type Streak } from './game/streak.ts'
import type { QuestLog } from './game/quests.ts'
import { checkInEvent, totalXp, type GameEvent } from './game/xp.ts'

export type Role = Viewer
export type Screen = 'board' | 'checkin' | 'me' | 'ship' | 'learn' | 'inbox' | 'summary'

/** What the browser keeps between visits. Reaction-test results are never in here. */
interface Local {
  liveCheckIns: CheckIn[]
  events: GameEvent[]
  questLog: QuestLog
  shareWatch: Record<string, boolean>
}
const EMPTY: Local = { liveCheckIns: [], events: [], questLog: {}, shareWatch: {} }
const STORE_KEY = 'shipshape.v1'

function loadLocal(): Local {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Local>) } : EMPTY
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
  logIn: (crewId: string, pin: string) => Promise<LoginResult>
  logOut: () => void
  role: Role
  setRole: (r: Role) => void
  screen: Screen
  setScreen: (s: Screen) => void
  today: number
  setToday: (d: number) => void
  dayRange: [number, number]
  commDelayMin: number
  setCommDelayMin: (m: number) => void
  nameOf: (crewId: string) => string
  /** Check-ins up to today: simulated ones, with live entries replacing them. */
  checkIns: CheckIn[]
  results: DayResult[]
  todayResult: DayResult
  summaries: SurgeonSummary[]
  local: Local
  events: GameEvent[]
  pausedDays: ReadonlySet<string>
  xpOf: (crewId: string) => number
  crewXp: number
  streakOf: (crewId: string) => Streak
  /** In memory only, gone on reload: the live reaction test is never stored. */
  liveReaction: Record<string, ReactionResult>
  submitCheckIn: (c: CheckIn, reaction: ReactionResult | null) => void
  toggleShare: (crewId: string) => void
  doQuestStep: (questId: string, stepId: string, crewId: string) => void
  addEvent: (e: GameEvent) => void
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

  if (error) return <p className="boot">Could not load the data files ({error}). Run <code>npm run data</code>.</p>
  if (!data) return <p className="boot">Loading…</p>
  return <Ready data={data}>{children}</Ready>
}

function Ready({ data, children }: { data: Data; children: ReactNode }) {
  const [firstDay, lastDay] = data.crew.meta.days
  const dayRange: [number, number] = [firstDay + 21, lastDay]
  const [user, setUser] = useState<User | null>(() => currentUser(sessionStorage, data.accounts.accounts, Date.now()))
  const [role, setRoleState] = useState<Role>({ kind: 'crew', crewId: data.crew.crew[0].id })
  const [screen, setScreen] = useState<Screen>('board')
  const [today, setToday] = useState(data.crew.meta.demoDay)
  const [commDelayMin, setCommDelayMin] = useState(12)
  const [local, setLocal] = useState<Local>(loadLocal)
  const [liveReaction, setLiveReaction] = useState<Record<string, ReactionResult>>({})

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(local))
    } catch {
      // storage can be unavailable (private window); the app still works for the session
    }
  }, [local])

  // "Viewing as" is part of the crew app, so only someone who may open the crew app can change it.
  const setRole = useCallback(
    (r: Role) => {
      if (!user || !mayOpen(user, 'app')) return
      setRoleState(r)
      setScreen(r.kind === 'surgeon' ? 'summary' : 'board')
    },
    [user],
  )

  const logIn = useCallback(
    async (crewId: string, pin: string): Promise<LoginResult> => {
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
      setUser({ crewId, role: account.role })
      return { ok: true }
    },
    [data],
  )

  // Ends the session and reloads the login page fresh, with no ?next= back to where the person was.
  const logOut = useCallback(() => {
    endSession(sessionStorage)
    window.location.assign(hrefOf('login', import.meta.env.BASE_URL))
  }, [])

  const names = useMemo(() => new Map(data.crew.crew.map((c) => [c.id, c.name])), [data])
  const nameOf = useCallback((id: string) => names.get(id) ?? id, [names])
  const crewIds = useMemo(() => data.crew.crew.map((c) => c.id), [data])

  const checkIns = useMemo(() => {
    const live = new Map(local.liveCheckIns.map((c) => [`${c.crewId}|${c.day}`, c]))
    const merged = data.crew.checkIns.filter((c) => c.day <= today && !live.has(`${c.crewId}|${c.day}`))
    for (const c of live.values()) if (c.day <= today) merged.push(c)
    return merged
  }, [data, local.liveCheckIns, today])

  const results = useMemo(
    () => runEngine({ crewIds, checkIns, cabin: data.cabin.daily, fromDay: firstDay, toDay: today, shareWatch: local.shareWatch }),
    [crewIds, checkIns, data, firstDay, today, local.shareWatch],
  )
  const todayResult = results[results.length - 1]
  const summaries = useMemo(() => results.flatMap((r) => r.summaries).reverse(), [results])

  const pausedDays = useMemo(() => {
    const s = new Set<string>()
    for (const c of checkIns) if (c.safetyFlag) s.add(`${c.crewId}|${c.day}`)
    return s
  }, [checkIns])

  // Every check-in earns the same XP, simulated or live; the event carries no reading.
  const events = useMemo(
    () => [...checkIns.map(checkInEvent), ...local.events.filter((e) => e.day <= today)],
    [checkIns, local.events, today],
  )
  const xpOf = useCallback((id: string) => totalXp(events, id, pausedDays), [events, pausedDays])
  const crewXp = useMemo(() => totalXp(events, undefined, pausedDays), [events, pausedDays])

  const streakOf = useCallback(
    (id: string) => {
      const mine = new Set(checkIns.filter((c) => c.crewId === id).map((c) => c.day))
      const shields = new Set(data.crew.shieldDays.filter((s) => s.crewIds.includes(id)).map((s) => s.day))
      return weeklyStreak(mine, shields, today, firstDay)
    },
    [checkIns, data, today, firstDay],
  )

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

  const toggleShare = useCallback((id: string) => {
    setLocal((l) => ({ ...l, shareWatch: { ...l.shareWatch, [id]: !l.shareWatch[id] } }))
  }, [])

  const addEvent = useCallback((e: GameEvent) => setLocal((l) => ({ ...l, events: [...l.events, e] })), [])

  const doQuestStep = useCallback(
    (questId: string, stepId: string, crewId: string) => {
      setLocal((l) => {
        if (l.questLog[questId]?.[stepId]) return l
        return {
          ...l,
          questLog: { ...l.questLog, [questId]: { ...l.questLog[questId], [stepId]: { crewId, day: today } } },
          events: [...l.events, { type: 'action', crewId, day: today, ref: `${questId}|${stepId}` }],
        }
      })
    },
    [today],
  )

  const reset = useCallback(() => {
    setLocal(EMPTY)
    setLiveReaction({})
  }, [])

  const store: Store = {
    data,
    user,
    logIn,
    logOut,
    role,
    setRole,
    screen,
    setScreen,
    today,
    setToday,
    dayRange,
    commDelayMin,
    setCommDelayMin,
    nameOf,
    checkIns,
    results,
    todayResult,
    summaries,
    local,
    events,
    pausedDays,
    xpOf,
    crewXp,
    streakOf,
    liveReaction,
    submitCheckIn,
    toggleShare,
    doQuestStep,
    addEvent,
    reset,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
