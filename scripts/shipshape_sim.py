"""Seeded crew simulator shared by simulate_crew.py and backtest.py (stdlib only).

Everything this module produces is SIMULATED. What is calibrated to a published figure
and what is a demo parameter is spelled out in SimParams below and in docs/SPEC.md.
"""
from __future__ import annotations

import json
import math
import random
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path

from shipshape_data import ROOT

CREW = [("anna", "Anna"), ("ben", "Ben"), ("chen", "Chen"), ("dana", "Dana")]
CREW_IDS = [c[0] for c in CREW]


@dataclass
class SimParams:
    # --- calibrated to published figures -------------------------------------------------
    # Law et al. 2014, J Occup Environ Med 56(5):477-83, doi:10.1097/JOM.0000000000000158: the odds of a reported headache doubled per 1 mmHg of CO2, and
    # keeping the risk below 1% needed CO2 under 2.5 mmHg. We apply it per daily check-in to
    # the 24 h mean; the paper used 7-day averages, so the daily use is our simplification.
    headache_p_ref: float = 0.01
    headache_ref_mmhg: float = 2.5
    headache_odds_per_mmhg: float = 2.0
    # --- demo parameters (not from a paper; varied in the sensitivity checks) ---------------
    # Shift of sleep quality, fatigue and irritability per mmHg of CO2 above the reference,
    # in units of the person's own day-to-day spread. Direction is from the literature,
    # the size is ours.
    co2_shift_sd_per_mmhg: float = 0.6
    co2_effect_scale: float = 1.0  # multiplies both CO2 effects: 0.5 = halved, 2 = doubled
    noise_scale: float = 1.0  # multiplies self-report noise
    miss_rate: float = 0.03  # share of check-ins skipped
    event_start_rate: float = 0.012  # chance per person-day that an individual event starts
    short_sleep_rt_penalty: float = 0.06  # slower responses after under 6 h of sleep
    eva_rate: float = 0.035  # chance per day of a spacewalk (two crew skip the check-in)
    # --- backtest scenarios only (off by default; never used for the demo crew) ---------------
    # One crew member (CREW_IDS[seed % 4]) has a slow decline: mood falls and stress rises by this
    # many slider points per day from day `slow_decline_from` of the trace. That person gets no other
    # events, so the decline is measured on its own.
    slow_decline_rate: float = 0.0
    slow_decline_from: int = 15
    # One crew member (CREW_IDS[seed % 4]) under-reports: never ticks a symptom and reports each slider
    # one point better than it is.
    underreporter: bool = False


@dataclass
class Person:
    crew_id: str
    sleep_hours: float
    sleep_quality: float
    fatigue: float
    irritability: float
    stress: float
    mood: float
    reaction_ms: float


@dataclass
class Event:
    crewId: str
    kind: str  # sleep_loss | symptom_run | stress | slow_decline (backtest scenario)
    startDay: int
    endDay: int
    scripted: bool = False


@dataclass
class SimResult:
    check_ins: list[dict]
    events: list[Event]
    shield_days: list[dict]
    people: list[Person] = field(default_factory=list)


# Exercise the day before each check-in, in minutes: shown on the dashboard, never judged. Demo
# parameters: most days a full session, sometimes a short one, rarely none. Drawn from a stream of its
# own, so adding it changed no other value.
EXERCISE_NONE_P = 0.02
EXERCISE_SHORT_P = 0.08
EXERCISE_SHORT = [30, 45, 60, 75, 90]
EXERCISE_FULL = [120, 135, 150]
# Blood oxygen from the wrist wearable, %: shown, never judged. Demo parameters: a healthy person's own
# level plus day-to-day wobble. A stream of its own, like exercise.
SPO2_PERSON = (96, 99)
SPO2_SD = 0.8

SD = {"sleep_hours": 0.55, "sleep_quality": 0.9, "fatigue": 0.9, "irritability": 0.8, "stress": 0.9, "mood": 0.8, "reaction_ms": 11.0}
EVENT_KINDS = [("sleep_loss", 0.4), ("symptom_run", 0.3), ("stress", 0.3)]


def draw_person(rng: random.Random, crew_id: str) -> Person:
    return Person(
        crew_id=crew_id,
        sleep_hours=rng.uniform(6.9, 7.4),
        sleep_quality=rng.uniform(6.5, 7.5),
        fatigue=rng.uniform(2.5, 3.5),
        irritability=rng.uniform(1.5, 2.5),
        stress=rng.uniform(2.5, 3.5),
        mood=rng.uniform(6.5, 7.5),
        reaction_ms=rng.uniform(240, 290),
    )


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def headache_probability(co2_mmhg: float, p: SimParams) -> float:
    odds_ref = p.headache_p_ref / (1 - p.headache_p_ref)
    odds = odds_ref * p.headache_odds_per_mmhg ** ((co2_mmhg - p.headache_ref_mmhg) * p.co2_effect_scale)
    return odds / (1 + odds)


def simulate(
    seed: int,
    cabin_daily: list[dict],
    params: SimParams | None = None,
    scripted_events: list[Event] | None = None,
    random_events: bool = True,
    scripted_shields: list[dict] | None = None,
) -> SimResult:
    """Simulate four crew over the days in `cabin_daily` (rows with a `day` and a `co2Mean`)."""
    p = params or SimParams()
    rng = random.Random(seed)
    people = [draw_person(rng, cid) for cid in CREW_IDS]
    days = [row["day"] for row in cabin_daily]
    co2_by_day = {}
    last = p.headache_ref_mmhg
    for row in cabin_daily:
        if row["co2Mean"] is not None:
            last = row["co2Mean"]
        co2_by_day[row["day"]] = last  # the air the crew breathed; carried over sensor gaps

    events: list[Event] = list(scripted_events or [])
    shields: list[dict] = list(scripted_shields or [])
    check_ins: list[dict] = []
    # Scenario people are fixed by the seed and use no random draws, so every other stream is unchanged.
    special = CREW_IDS[seed % len(CREW_IDS)]
    decliner = special if p.slow_decline_rate > 0 else None
    decline_from = days[0] + p.slow_decline_from - 1
    if decliner:
        events.append(Event(decliner, "slow_decline", decline_from, days[-1]))
    silent = special if p.underreporter else None

    # Spacewalk days are drawn first so every person's stream stays independent of them.
    if scripted_shields is None:
        for day in days:
            if rng.random() < p.eva_rate:
                shields.append({"day": day, "kind": "eva", "crewIds": sorted(rng.sample(CREW_IDS, 2))})
    shield_lookup = {(s["day"], cid) for s in shields for cid in s["crewIds"]}

    for person in people:
        prng = random.Random(f"{seed}:{person.crew_id}")
        erng = random.Random(f"{seed}:{person.crew_id}:exercise")
        orng = random.Random(f"{seed}:{person.crew_id}:spo2")
        spo2_own = orng.uniform(*SPO2_PERSON)
        latent = 0.0
        active_until = -1
        for day in days:
            if random_events and person.crew_id != decliner and day > active_until and prng.random() < p.event_start_rate:
                r = prng.random()
                kind = EVENT_KINDS[-1][0]
                acc = 0.0
                for name, w in EVENT_KINDS:
                    acc += w
                    if r < acc:
                        kind = name
                        break
                length = prng.randint(4, 7)
                events.append(Event(person.crew_id, kind, day, day + length - 1))
                active_until = day + length - 1
            mine = [e for e in events if e.crewId == person.crew_id and e.startDay <= day <= e.endDay]
            kinds = {e.kind for e in mine}

            latent = 0.3 * latent + math.sqrt(1 - 0.09) * prng.gauss(0, 1)

            def noise() -> float:
                return (0.5 * latent + math.sqrt(0.75) * prng.gauss(0, 1)) * p.noise_scale

            co2 = co2_by_day[day]
            c = p.co2_shift_sd_per_mmhg * p.co2_effect_scale * (co2 - p.headache_ref_mmhg)

            z = {k: noise() for k in ("sleep_hours", "sleep_quality", "fatigue", "irritability", "stress", "mood", "reaction_ms")}
            z["sleep_quality"] -= c
            z["fatigue"] += c
            z["irritability"] += c
            z["sleep_hours"] -= 0.5 * c
            if "sleep_loss" in kinds:
                z["sleep_hours"] -= 3.0
                z["sleep_quality"] -= 2.2
                z["fatigue"] += 2.2
                z["mood"] -= 0.5
            if "stress" in kinds:
                z["stress"] += 3.0
                z["mood"] -= 2.2
                z["irritability"] += 1.0
                z["sleep_quality"] -= 0.5
            if "symptom_run" in kinds:
                z["fatigue"] += 0.6
            if person.crew_id == decliner and day >= decline_from:
                drop = p.slow_decline_rate * (day - decline_from)
                z["mood"] -= drop / SD["mood"]
                z["stress"] += drop / SD["stress"]

            sleep_hours = clamp(round((person.sleep_hours + SD["sleep_hours"] * z["sleep_hours"]) * 2) / 2, 3, 10)
            short = sleep_hours < 6
            if short:
                z["stress"] += 0.4
            reaction = (person.reaction_ms + SD["reaction_ms"] * z["reaction_ms"]) * (1 + (p.short_sleep_rt_penalty if short else 0))

            def slider(name: str) -> int:
                base = getattr(person, name)
                return int(clamp(round(base + SD[name] * z[name]), 0, 10))

            symptoms = []
            p_head = 0.75 if "symptom_run" in kinds else headache_probability(co2, p)
            if prng.random() < p_head:
                symptoms.append("headache")
            for name, rate in (("congestion", 0.004), ("eye_strain", 0.003), ("dizziness", 0.002), ("nausea", 0.001)):
                if prng.random() < rate:
                    symptoms.append(name)
            if person.crew_id == silent:
                symptoms = []  # the draws above still happen, so the stream does not shift

            r = erng.random()
            exercise = 0 if r < EXERCISE_NONE_P else erng.choice(EXERCISE_SHORT if r < EXERCISE_NONE_P + EXERCISE_SHORT_P else EXERCISE_FULL)
            spo2 = int(clamp(round(spo2_own + orng.gauss(0, SPO2_SD)), 94, 100))

            row = {
                "crewId": person.crew_id,
                "day": day,
                "sleepHours": sleep_hours,
                "sleepQuality": slider("sleep_quality"),
                "fatigue": slider("fatigue"),
                "irritability": slider("irritability"),
                "stress": slider("stress"),
                "mood": slider("mood"),
                "symptoms": symptoms,
                "reactionMs": round(reaction),
                "exerciseMin": exercise,
                "spo2": spo2,
                "simulated": True,
            }
            if person.crew_id == silent:
                # one point better than it is, in each slider's unwanted direction
                for k, better in (("sleepQuality", 1), ("fatigue", -1), ("irritability", -1), ("stress", -1), ("mood", 1)):
                    row[k] = int(clamp(row[k] + better, 0, 10))
            missed = prng.random() < p.miss_rate
            if missed or (day, person.crew_id) in shield_lookup:
                continue
            check_ins.append(row)

    check_ins.sort(key=lambda r: (r["day"], CREW_IDS.index(r["crewId"])))
    return SimResult(check_ins=check_ins, events=events, shield_days=shields, people=people)


def run_engine(traces: dict[str, list[dict]], runs: list[dict]) -> dict[str, list[dict]]:
    """Run the TypeScript rules engine (the same code the app ships) over simulated crews."""
    with tempfile.TemporaryDirectory() as tmp:
        inp = Path(tmp) / "in.json"
        out = Path(tmp) / "out.json"
        inp.write_text(json.dumps({"traces": traces, "runs": runs}))
        subprocess.run(
            ["npx", "--no-install", "tsx", "scripts/engine_cli.ts", str(inp), str(out)],
            cwd=ROOT,
            check=True,
        )
        result = json.loads(out.read_text())
    return {r["id"]: r["days"] for r in result["runs"]}


def params_dict(p: SimParams) -> dict:
    return asdict(p)
