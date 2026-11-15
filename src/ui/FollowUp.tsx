import { RULES } from '../engine/config.ts'
import type { ShipFollowUp } from '../engine/privacy.ts'
import { useStore } from '../state.tsx'
import { Card, Mark } from './bits.tsx'
import { mmHg } from './text.ts'

/** The re-check after a ship alert: is the air back to usual, and are the crew it touched? Counts only, never names. */
export function FollowUpCard({ f }: { f: ShipFollowUp }) {
  const s = useStore()
  const { cabin } = s.todayResult
  return (
    <Card title="Did the fix work?" aside={<span className="count">day {f.daysSince} after the ship alert</span>}>
      <ul className="checks">
        <li>
          <Mark tone={f.airBack === null ? 'idle' : f.airBack ? 'ok' : 'watch'}>
            {f.airBack === null
              ? 'No cabin data today, so the air could not be re-checked.'
              : f.airBack
                ? `The air is back to its usual level: ${mmHg(cabin.co2Mean)} over 24 h, usual ${mmHg(cabin.baseline)}.`
                : `The air is still above its usual level or the ${RULES.co2LimitMmHg} mmHg limit.`}
          </Mark>
        </li>
        <li>
          <Mark tone={f.stillOff > 0 ? 'watch' : 'ok'}>
            {f.recovered} of {f.affected} crew who felt it are back to their own usual.
          </Mark>
        </li>
        {f.stillOff > 0 && (
          <li>
            <Mark tone="info">
              {f.stillOff} still off: told privately that it is now likely about them, and their {RULES.persistDays}-day count has started.
            </Mark>
          </li>
        )}
        {f.notCheckedIn > 0 && (
          <li>
            <Mark tone="idle">{f.notCheckedIn} not checked in yet today.</Mark>
          </li>
        )}
      </ul>
      <p className="fine">
        Ship alert of days {f.alertStart} to {f.alertEnd}. The app re-checks the air and the crew at every check-in for {RULES.followUpDays}{' '}
        days after an alert ends. Getting better after the fix does not prove the fix caused it.
      </p>
    </Card>
  )
}
