// Two clocks. On board, ship time is UTC and the morning check-in is at 08:00. Mission Control on
// Earth reads the same moment in Houston local time. Mission days are real dates relabelled
// (cabin.json, meta.replay), so the real date behind a mission day decides summer or winter time.

export interface Replay {
  anchorDate: string
  anchorMissionDay: number
}

const DAY_MS = 86_400_000

/** The moment of a mission day's check-in, plus an optional delay in minutes (the comm delay). */
export function checkInAt(day: number, replay: Replay, plusMin = 0): Date {
  return new Date(Date.parse(`${replay.anchorDate}T08:00:00Z`) + (day - replay.anchorMissionDay) * DAY_MS + plusMin * 60_000)
}

const SHIP = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const HOUSTON = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })

/** "08:12 UTC" */
export function shipTime(d: Date): string {
  return `${SHIP.format(d)} UTC`
}

/** "03:12 CDT Houston" */
export function houstonTime(d: Date): string {
  return `${HOUSTON.format(d).replace(',', '')} Houston`
}
