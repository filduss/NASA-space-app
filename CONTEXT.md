# Ship Or Me?

A crew check-in for long missions that says whether a bad day is "likely you" or "likely the ship". This file fixes the words the team uses for its parts.

## Language

### Daily input

**Check-in**:
The morning self-report a crew member fills in: what only the person can tell, such as sleep quality, fatigue, irritability, stress, mood and symptoms. Its answers go to the **Flight surgeon** only.
_Avoid_: survey, questionnaire, form (in UI text)

**Wearable**:
The wrist device each crew member wears, modelled on NASA's actigraph, that measures sleep duration and exercise without the person typing anything. In the demo its readings are simulated.
_Avoid_: watch, smartwatch, actigraph (in UI text)

**Wearable reading**:
A value the **Wearable** measured (last night's sleep duration, yesterday's exercise minutes), shown on the **Check-in** but not asked in it.
_Avoid_: watch data, sensor data

**Reaction test**:
The optional 30-second alertness test on the **Check-in**, modelled on NASA's PVT-B.
_Avoid_: PVT (in UI text), game

**Conference request**:
A crew member's request, made from the **Check-in**, for a private medical conference with their **Flight surgeon**, modelled on NASA's weekly Private Medical Conference that crews can also ask for at any time.
_Avoid_: safety flag, "I am not safe"

**Urgent conference request**:
A **Conference request** marked urgent: the one case in which the **Crew medical officer** on board is told at once, because Earth is minutes away.
_Avoid_: emergency flag, safety answer

### People

**Flight surgeon**:
The physician on Earth who receives check-in summaries and conference requests.

**Crew medical officer**:
The crew member trained to give care on board, who sees another person's check-in only after that person makes an **Urgent conference request**.
_Avoid_: CMO (in UI text), doctor

### Escalation

**Watch**:
The tier-1 private level a crew member gets on a day one of their indicators is off their own normal, shown on their own dashboard. Only they see it unless it is shared with the crew medical officer (the engine supports this; no screen offers the toggle since the Me screen was removed).
_Avoid_: using "watch" for the **Wearable**

## Relationships

- A **Check-in** belongs to one crew member and one mission day.
- A **Check-in** shows that night's **Wearable readings** but never asks for them.
- A **Check-in**'s answers reach the **Flight surgeon**, never crewmates; crewmates see only an unnamed count in a ship alert.
- An **Urgent conference request** also reaches the **Crew medical officer**.
- A drifting indicator on a **Check-in** or a **Wearable reading** can open a **Watch**.

## Example dialogue

> **Dev:** "Chen's sleep was short again. Did he report it on the **Check-in**?"
> **Domain expert:** "No, the **Wearable** measured it. The **Check-in** only shows it. He rated his sleep quality himself, and the two together opened a **Watch**."

## Flagged ambiguities

- "safety question" / "I am not safe" was the old wording for asking for help. Resolved: it is a **Conference request**, urgent or not.
- "watch" meant both the tier-1 private card and the wrist device. Resolved: **Watch** is the tier-1 level only. The device is the **Wearable**.
