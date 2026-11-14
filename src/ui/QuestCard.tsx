import { clearTheAirQuest, questProgress, sleepLogQuest, HABIT_NIGHTS } from '../game/quests.ts'
import { weekOf } from '../game/streak.ts'
import { XP } from '../game/xp.ts'
import { useStore } from '../state.tsx'
import { Card } from './bits.tsx'

/** The one quest card: the ship quest while a ship alert is active, otherwise the weekly habit. */
export function QuestCard() {
  const s = useStore()
  const r = s.todayResult
  const actor = s.role.kind === 'crew' ? s.role.crewId : null
  const crewIds = s.data.crew.crew.map((c) => c.id)

  if (r.decision.outcome === 'ship' && r.shipEpisodeStart !== null) {
    const quest = clearTheAirQuest(r.shipEpisodeStart)
    const log = s.local.questLog[quest.id] ?? {}
    const prog = questProgress(quest, s.local.questLog)
    return (
      <Card title={`Crew quest: ${quest.title}`} aside={<span className="count">{prog.done} of {prog.total} done</span>}>
        <p className="muted">{quest.why}</p>
        <ul className="steps">
          {quest.steps.map((step) => {
            const done = log[step.id]
            const kudosRef = `${quest.id}|${step.id}`
            const thanked = actor !== null && s.local.events.some((e) => e.type === 'kudos' && e.crewId === actor && e.ref === kudosRef)
            return (
              <li key={step.id} className={done ? 'step-done' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!done}
                    disabled={!!done || actor === null}
                    onChange={() => actor && s.doQuestStep(quest.id, step.id, actor)}
                  />
                  <span>{step.label}</span>
                </label>
                {done && (
                  <span className="step-meta">
                    {s.nameOf(done.crewId)}, day {done.day} · +{XP.action} XP
                    {actor && done.crewId !== actor && (
                      <button
                        type="button"
                        className="link"
                        disabled={thanked}
                        onClick={() => s.addEvent({ type: 'kudos', crewId: actor, day: s.today, ref: kudosRef })}
                      >
                        {thanked ? 'Thanked' : `Thank ${s.nameOf(done.crewId)}`}
                      </button>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <p className="fine">
          {prog.complete
            ? 'Steps done. The air is re-checked at the next check-in; the alert ends when the cabin is back to its usual level.'
            : actor
              ? `Each step earns ${XP.action} XP for doing it, whatever the next reading says.`
              : 'Crew members tick steps as they do them.'}{' '}
          Steps are illustrative for the demo, not a flight procedure.
        </p>
      </Card>
    )
  }

  const habit = sleepLogQuest(weekOf(s.today), crewIds, s.checkIns, s.today)
  return (
    <Card title={`Crew quest: ${habit.quest.title}`} aside={<span className="count">{habit.doneCount} of {crewIds.length} there</span>}>
      <p className="muted">{habit.quest.why}</p>
      <ul className="habit">
        {crewIds.map((id) => {
          const n = Math.min(habit.nights[id], HABIT_NIGHTS)
          return (
            <li key={id}>
              <span>{s.nameOf(id)}</span>
              <span className="pips" aria-label={`${n} of ${HABIT_NIGHTS} nights logged`}>
                {Array.from({ length: HABIT_NIGHTS }, (_, i) => (
                  <i key={i} className={i < n ? 'pip pip-on' : 'pip'} />
                ))}
              </span>
              <span className="count">{n}/{HABIT_NIGHTS}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
