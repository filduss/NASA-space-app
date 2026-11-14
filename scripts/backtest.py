#!/usr/bin/env python3
"""Seeded backtest of the ship-or-me rule.

    python3 scripts/backtest.py                  # writes public/data/backtest.json
    python3 scripts/backtest.py --seed-base 5000 --no-write   # a separate seed set, for tuning

What is real: the CO2 traces (ISS telemetry, NASA OSDR EDA snapshots in scripts/snapshots/).
What is simulated: every crew member and every check-in (scripts/shipshape_sim.py).
The rules are not re-implemented here: the script calls the app's TypeScript engine.

Deviation from the plan: the plan says 90 days per crew. The longest real trace is 73 days,
and we do not stitch or loop real data, so each crew runs over one whole real trace instead.
"""
from __future__ import annotations

import argparse
import statistics as st
import sys
from datetime import datetime, timezone

from shipshape_data import MISSIONS, PUBLIC_DATA, daily_from_hourly, load_snapshot, update_sums, write_json
from shipshape_sim import CREW_IDS, SimParams, params_dict, run_engine, simulate

N_CREWS = 200
BURN_IN_DAYS = 10  # the rules need history before they can judge; these days are not scored
SHIP_TRUTH_RISE_MMHG = 1.0  # a "ship event" day: mean CO2 at least this far above the trace's own median
GRACE_DAYS = 1  # an alert the day after an event ends still belongs to that event

SCENARIOS = [
    ("Base case", {}),
    ("CO₂ effect halved", {"co2_effect_scale": 0.5}),
    ("CO₂ effect doubled", {"co2_effect_scale": 2.0}),
    ("20% of check-ins missed", {"miss_rate": 0.20}),
    ("Noisier self-reports (×1.5)", {"noise_scale": 1.5}),
]


def load_traces() -> dict[str, list[dict]]:
    traces = {}
    for mission in MISSIONS:
        daily = daily_from_hourly(load_snapshot(mission)["hourly"])
        for i, row in enumerate(daily):
            row["day"] = i + 1
        traces[mission] = daily
    return traces


def ship_events(daily: list[dict]) -> tuple[set[int], list[dict]]:
    means = [r["co2Mean"] for r in daily if r["co2Mean"] is not None]
    ref = st.median(means)
    truth = {r["day"] for r in daily if r["co2Mean"] is not None and r["co2Mean"] - ref >= SHIP_TRUTH_RISE_MMHG}
    events = []
    for day in sorted(truth):
        if events and day == events[-1]["endDay"] + 1:
            events[-1]["endDay"] = day
        else:
            events.append({"startDay": day, "endDay": day})
    by_day = {r["day"]: r for r in daily}
    for e in events:
        e["peakRise"] = max(by_day[d]["co2Mean"] - ref for d in range(e["startDay"], e["endDay"] + 1))
    return truth, events


def quantile(xs: list[float], q: float):
    if not xs:
        return None
    s = sorted(xs)
    return s[min(len(s) - 1, int(q * len(s)))]


def score(traces: dict[str, list[dict]], seed_base: int, overrides: dict) -> dict:
    params = SimParams(**overrides)
    runs, sims = [], {}
    for i in range(N_CREWS):
        mission = MISSIONS[i % len(MISSIONS)]
        daily = traces[mission]
        sim = simulate(seed_base + i, daily, params)
        rid = f"crew{i}"
        sims[rid] = (mission, sim)
        runs.append(
            {"id": rid, "crewIds": CREW_IDS, "checkIns": sim.check_ins, "trace": mission, "fromDay": daily[0]["day"], "toDay": daily[-1]["day"]}
        )
    results = run_engine(traces, runs)

    c = dict(crew_days=0, person_days=0, correct=0, wrong=0, mixed=0, ship_fa=0, personal_fa=0, tier3_fa=0, shared_fa=0)
    ship_delays, me_delays = [], []
    ship_total = ship_missed = big_total = big_missed = 0
    me_total = me_missed = 0

    for rid, days in results.items():
        mission, sim = sims[rid]
        first = traces[mission][0]["day"] + BURN_IN_DAYS
        truth, s_events = ship_events(traces[mission])
        truth_grace = truth | {d + g for d in truth for g in range(1, GRACE_DAYS + 1)}
        by_day = {d["day"]: d for d in days}
        last = days[-1]["day"]

        def personal_active(crew_id: str, day: int, grace: int = 0) -> bool:
            return any(e.crewId == crew_id and e.startDay <= day <= e.endDay + grace for e in sim.events)

        for d in days:
            day = d["day"]
            if day < first:
                continue
            c["crew_days"] += 1
            if d["outcome"] == "ship" and day not in truth_grace:
                c["ship_fa"] += 1
            any_active = any(personal_active(cid, day, GRACE_DAYS) for cid in CREW_IDS)
            if d["outcome"] == "shared" and day not in truth_grace and not any_active:
                c["shared_fa"] += 1
            for cid, p in d["people"].items():
                if not p["in"]:
                    continue
                c["person_days"] += 1
                if p["a"] == "none":
                    continue
                mine = personal_active(cid, day)
                in_ship = day in truth
                # which cause did the rule name, and was it right?
                if mine and in_ship:
                    c["mixed"] += 1
                elif mine:
                    c["correct" if p["a"] != "ship" else "wrong"] += 1
                elif in_ship:
                    c["correct" if p["a"] == "ship" else "wrong"] += 1
                # alerts with nothing behind them
                if not personal_active(cid, day, GRACE_DAYS) and day not in truth_grace:
                    c["personal_fa"] += 1
                    if p["t"] == 3:
                        c["tier3_fa"] += 1

        for e in s_events:
            if e["startDay"] < first:
                continue
            ship_total += 1
            big = e["peakRise"] >= 2.0
            big_total += big
            hit = next((d for d in range(e["startDay"], min(e["endDay"] + GRACE_DAYS, last) + 1) if by_day[d]["outcome"] == "ship"), None)
            if hit is None:
                ship_missed += 1
                big_missed += big
            else:
                ship_delays.append(hit - e["startDay"])
        for e in sim.events:
            if e.startDay < first or e.startDay > last:
                continue
            me_total += 1
            hit = next(
                (d for d in range(e.startDay, min(e.endDay + GRACE_DAYS, last) + 1) if by_day[d]["people"][e.crewId]["a"] != "none"),
                None,
            )
            if hit is None:
                me_missed += 1
            else:
                me_delays.append(hit - e.startDay)

    judged = c["correct"] + c["wrong"]

    def r(x, nd=3):
        return None if x is None else round(x, nd)

    return {
        "params": params_dict(params),
        "crewDays": c["crew_days"],
        "personDays": c["person_days"],
        "shipOrMeAccuracy": r(c["correct"] / judged) if judged else None,
        "accuracyJudgedAlerts": judged,
        "accuracyMixedExcluded": c["mixed"],
        "ship": {
            "events": ship_total,
            "missedShare": r(ship_missed / ship_total) if ship_total else None,
            "eventsRise2Plus": big_total,
            "missedShareRise2Plus": r(big_missed / big_total) if big_total else None,
            "delayDaysMedian": r(st.median(ship_delays), 1) if ship_delays else None,
            "delayDaysP90": quantile(ship_delays, 0.9),
        },
        "individual": {
            "events": me_total,
            "missedShare": r(me_missed / me_total) if me_total else None,
            "delayDaysMedian": r(st.median(me_delays), 1) if me_delays else None,
            "delayDaysP90": quantile(me_delays, 0.9),
        },
        "falseAlarms": {
            "shipPerCrewDay": r(c["ship_fa"] / c["crew_days"], 4),
            "sharedPatternPerCrewDay": r(c["shared_fa"] / c["crew_days"], 4),
            "privateCardPerPersonDay": r(c["personal_fa"] / c["person_days"], 4),
            "surgeonSummaryPerCrewDay": r(c["tier3_fa"] / c["crew_days"], 4),
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed-base", type=int, default=1000)
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--only-base", action="store_true")
    args = ap.parse_args()

    traces = load_traces()
    scenarios = []
    for name, overrides in SCENARIOS[: 1 if args.only_base else None]:
        m = score(traces, args.seed_base, overrides)
        scenarios.append({"name": name, **m})
        print(
            f"{name:30s} acc={m['shipOrMeAccuracy']} (n={m['accuracyJudgedAlerts']}) "
            f"ship: n={m['ship']['events']} missed={m['ship']['missedShare']} (rise>=2: {m['ship']['missedShareRise2Plus']}, n={m['ship']['eventsRise2Plus']}) "
            f"delay={m['ship']['delayDaysMedian']} | me: n={m['individual']['events']} missed={m['individual']['missedShare']} delay={m['individual']['delayDaysMedian']} | "
            f"FA ship/crew-day={m['falseAlarms']['shipPerCrewDay']} shared={m['falseAlarms']['sharedPatternPerCrewDay']} "
            f"card/person-day={m['falseAlarms']['privateCardPerPersonDay']} surgeon/crew-day={m['falseAlarms']['surgeonSummaryPerCrewDay']}"
        )
    if args.no_write:
        return 0

    out = {
        "meta": {
            "simulated": True,
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "generator": "scripts/backtest.py",
            "engine": "src/engine (the app's own rules, run through scripts/engine_cli.ts)",
            "crews": N_CREWS,
            "crewSize": len(CREW_IDS),
            "seeds": f"{args.seed_base}..{args.seed_base + N_CREWS - 1}",
            "tuning": "Rule thresholds were set on a separate seed set (5000..5199), not on the seeds reported here.",
            "traces": {m: {"days": len(traces[m]), "source": "NASA OSDR EDA, ISS telemetry (real)"} for m in MISSIONS},
            "burnInDays": BURN_IN_DAYS,
        },
        "definitions": {
            "shipEvent": f"A run of days whose mean CO₂ is at least {SHIP_TRUTH_RISE_MMHG} mmHg above that trace's own median (the rule never sees this median).",
            "individualEvent": "An injected 4-7 day event for one person: sleep loss, a run of headaches, or a stress dip.",
            "shipOrMeAccuracy": "Of the alerts raised during a true event, the share that named the right cause (ship vs. not the ship). Person-days with both kinds of event at once are excluded.",
            "detectionDelay": "Days from an event's first day to its first alert (0 = same day).",
            "falseAlarms": "Alerts on days with no event behind them, allowing one day of grace after an event ends.",
            "missedEvents": "Events that never raised an alert.",
            "deviationFromPlan": "Crews run over one whole real trace each (27-73 days) instead of 90 days: real data is never stitched or looped.",
        },
        "scenarios": scenarios,
        "limits": [
            "The crew is simulated; only the CO₂ traces are real.",
            "Headache risk follows the published odds (doubling per 1 mmHg); other CO₂ effect sizes are demo parameters.",
            "The rule is not validated on real crews.",
            "Browser reaction times are estimates.",
        ],
    }
    path = PUBLIC_DATA / "backtest.json"
    write_json(path, out)
    update_sums([path])
    print(f"-> {path.relative_to(path.parents[2])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
