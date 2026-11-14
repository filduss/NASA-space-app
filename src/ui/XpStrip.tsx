import { DAYS_NEEDED } from '../game/streak.ts'
import { XP } from '../game/xp.ts'
import { useStore } from '../state.tsx'

/** XP and the weekly streak. No ranking: the crew total is one number, never a table of people. */
export function XpStrip({ crewId }: { crewId: string | null }) {
  const s = useStore()
  if (crewId && s.pausedDays.has(`${crewId}|${s.today}`)) return null // safety answer: the game is out of the way
  const streak = crewId ? s.streakOf(crewId) : null
  return (
    <div className="xp">
      <div>
        <span className="xp-label">Crew XP</span>
        <strong>{s.crewXp.toLocaleString('en-US')}</strong>
      </div>
      {crewId && streak && (
        <>
          <div>
            <span className="xp-label">Your XP</span>
            <strong>{s.xpOf(crewId).toLocaleString('en-US')}</strong>
          </div>
          <div>
            <span className="xp-label">Weekly streak</span>
            <strong>
              {streak.weeks} {streak.weeks === 1 ? 'week' : 'weeks'}
            </strong>
          </div>
          <div>
            <span className="xp-label">This week</span>
            <strong>
              {Math.min(streak.thisWeek.covered, DAYS_NEEDED)}/{DAYS_NEEDED} days
            </strong>
            {streak.thisWeek.shields > 0 && <span className="fine"> incl. {streak.thisWeek.shields} shielded</span>}
          </div>
        </>
      )}
      <p className="fine xp-rule">
        +{XP.checkin} XP per check-in, the same on good and bad days. Nothing is earned for the reading itself, and nobody is ranked.
      </p>
    </div>
  )
}
