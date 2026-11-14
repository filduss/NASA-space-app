#!/usr/bin/env python3
"""Generate the demo crew: four SIMULATED people on the real RR-7 cabin trace.

    python3 scripts/simulate_crew.py     # writes public/data/crew.json

The demo follows one scripted path (docs/SPEC.md, "Golden path"). Two things are scripted
and labeled as such in the output:
  * individual events: Ben has a stress dip on days 188-192, Chen loses sleep on days 219-226
  * the seed: we try seeds in order and keep the first one whose crew shows the scripted
    path on the days the real CO2 rises. How many seeds were tried is recorded in the file.
The backtest (scripts/backtest.py) uses 200 other seeds and no scripting.
"""
from __future__ import annotations

import json
import sys

from shipshape_data import PUBLIC_DATA, update_sums, write_json
from shipshape_sim import CREW, CREW_IDS, Event, SimParams, params_dict, run_engine, simulate

FIRST_SEED = 1
MAX_SEEDS = 4000
BATCH = 250

SCRIPTED_EVENTS = [
    Event("ben", "stress", 188, 192, scripted=True),
    Event("chen", "sleep_loss", 219, 226, scripted=True),
]
SCRIPTED_SHIELDS = [
    {"day": 200, "kind": "eva", "crewIds": ["anna", "dana"], "label": "Spacewalk"},
    {"day": 206, "kind": "comm_blackout", "crewIds": ["anna", "ben", "chen", "dana"], "label": "Comm blackout"},
    {"day": 209, "kind": "heavy_workload", "crewIds": ["ben"], "label": "Heavy workload"},
]

CRITERIA = [
    "days 210-212: nobody drifts",
    "day 213 (first day the real CO2 is above baseline): outcome is ship, 3 of 4 crew affected, at least one of them reports a headache",
    "days 221-223: only Chen drifts (cabin back to normal), so day 223 is day 3 for Chen",
    "days 196-209: no ship outcome and nobody reaches tier 3",
]


def fits(days: list[dict], check_ins: list[dict]) -> bool:
    by = {d["day"]: d for d in days}
    ppl = lambda day: by[day]["people"]
    for day in (210, 211, 212):
        if by[day]["outcome"] != "none":
            return False
    d = by[213]
    affected = [cid for cid, p in d["people"].items() if p["a"] == "ship"]
    if d["outcome"] != "ship" or len(affected) != 3:
        return False
    headaches = [c for c in check_ins if c["day"] == 213 and "headache" in c["symptoms"] and c["crewId"] in affected]
    if len(headaches) < 1:
        return False
    for day in (221, 222, 223):
        if by[day]["outcome"] != "me" or ppl(day)["chen"]["a"] != "me":
            return False
    if ppl(223)["chen"]["t"] != 3:
        return False
    for day in range(196, 210):
        if by[day]["outcome"] == "ship" or any(p["t"] >= 3 for p in ppl(day).values()):
            return False
    return True


def main() -> int:
    cabin = json.loads((PUBLIC_DATA / "cabin.json").read_text(encoding="utf-8"))
    daily = [r for r in cabin["daily"] if r["day"] <= 235]
    params = SimParams()
    traces = {"demo": daily}

    chosen = None
    seed = FIRST_SEED
    while chosen is None and seed < FIRST_SEED + MAX_SEEDS:
        sims = {}
        runs = []
        for s in range(seed, seed + BATCH):
            sim = simulate(s, daily, params, scripted_events=SCRIPTED_EVENTS, random_events=False, scripted_shields=SCRIPTED_SHIELDS)
            sims[str(s)] = sim
            runs.append({"id": str(s), "crewIds": CREW_IDS, "checkIns": sim.check_ins, "trace": "demo", "fromDay": daily[0]["day"], "toDay": daily[-1]["day"]})
        results = run_engine(traces, runs)
        for s in range(seed, seed + BATCH):
            if fits(results[str(s)], sims[str(s)].check_ins):
                chosen = s
                break
        seed += BATCH
    if chosen is None:
        print(f"no seed in {FIRST_SEED}..{FIRST_SEED + MAX_SEEDS - 1} fits the scripted path", file=sys.stderr)
        return 1

    sim = sims[str(chosen)]
    out = {
        "meta": {
            "simulated": True,
            "generator": "scripts/simulate_crew.py",
            "label": "Simulated crew. No real person's data.",
            "seed": chosen,
            "seedSearch": {
                "firstSeedTried": FIRST_SEED,
                "seedsTried": chosen - FIRST_SEED + 1,
                "note": "The first seed whose crew shows the scripted demo path. The backtest uses other seeds with no scripting.",
                "criteria": CRITERIA,
            },
            "params": params_dict(params),
            "cabinTrace": cabin["meta"]["mission"],
            "days": [daily[0]["day"], daily[-1]["day"]],
            "demoDay": 212,
        },
        "crew": [{"id": cid, "name": name} for cid, name in CREW],
        "shieldDays": SCRIPTED_SHIELDS,
        "scriptedEvents": [e.__dict__ for e in SCRIPTED_EVENTS],
        "checkIns": sim.check_ins,
    }
    path = PUBLIC_DATA / "crew.json"
    write_json(path, out, compact=True)
    update_sums([path])
    print(f"seed {chosen} (tried {chosen - FIRST_SEED + 1}); {len(sim.check_ins)} check-ins -> public/data/crew.json")

    days = results[str(chosen)]
    for d in days:
        if 208 <= d["day"] <= 226:
            ppl = " ".join(f"{cid[:1].upper()}:{p['a'][:2] if p['in'] else '--'}{p['t']}" for cid, p in d["people"].items())
            print(f"  day {d['day']} outcome={d['outcome']:6s} cabinElevated={d['cabinElevated']!s:5s} {ppl}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
