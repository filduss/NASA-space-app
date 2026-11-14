// XP rewards measuring and acting, never the reading itself.
// The functions here cannot see a reading: they take the event type and who did it, nothing else.

export type GameEventType = 'checkin' | 'action' | 'learn' | 'kudos'

export interface GameEvent {
  type: GameEventType
  crewId: string
  day: number
  /** What it was for: a quest step id, a learn card id, or the action being thanked. */
  ref?: string
}

/** Fixed XP per event type. Symbolic; there is nothing to buy and nobody is ranked. */
export const XP: Record<GameEventType, number> = {
  checkin: 10,
  action: 15,
  learn: 5,
  kudos: 3,
}

export function xpFor(event: GameEvent): number {
  return XP[event.type]
}

/**
 * The XP event for a check-in. It accepts only who and when, so a bad-day report
 * and a good-day report are the same event by construction.
 */
export function checkInEvent(who: { crewId: string; day: number }): GameEvent {
  return { type: 'checkin', crewId: who.crewId, day: who.day }
}

function eventKey(e: GameEvent): string {
  // One check-in per day, one read per learn card, one credit per quest step, one kudos per action.
  switch (e.type) {
    case 'checkin':
      return `checkin|${e.crewId}|${e.day}`
    case 'learn':
      return `learn|${e.crewId}|${e.ref ?? ''}`
    default:
      return `${e.type}|${e.crewId}|${e.ref ?? e.day}`
  }
}

/** Drop repeats so nothing can be farmed. */
export function dedupeEvents(events: GameEvent[]): GameEvent[] {
  const seen = new Set<string>()
  const out: GameEvent[] = []
  for (const e of events) {
    const k = eventKey(e)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(e)
    }
  }
  return out
}

/**
 * Total XP. `pausedDays` lists crew-days on which the game is paused (a safety answer):
 * nothing is earned or shown for those.
 */
export function totalXp(events: GameEvent[], crewId?: string, pausedDays?: ReadonlySet<string>): number {
  let sum = 0
  for (const e of dedupeEvents(events)) {
    if (crewId !== undefined && e.crewId !== crewId) continue
    if (pausedDays?.has(`${e.crewId}|${e.day}`)) continue
    sum += xpFor(e)
  }
  return sum
}
