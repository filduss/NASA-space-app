#!/usr/bin/env python3
"""Snapshot real ISS cabin telemetry from the NASA OSDR Environmental Data Application.

    python3 scripts/snapshot_eda.py            # build snapshots (downloads what is not cached)
    python3 scripts/snapshot_eda.py --refresh  # re-download everything
    python3 scripts/snapshot_eda.py --verify   # check every tracked file against SHA256SUMS

Outputs
  scripts/snapshots/<mission>_hourly.json  hourly means per mission (committed; the backtest reads these)
  public/data/cabin.json                   the demo cabin feed: mission RR-7 replayed on mission days
  scripts/snapshots/SHA256SUMS             checksums of all of the above
Raw API responses are cached in scripts/.cache/ (not committed; their SHA-256 is stored in each snapshot).
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date, timedelta

from shipshape_data import (
    CABIN_PRESSURE_MMHG,
    CACHE_DIR,
    CHECKIN_HOUR_UTC,
    EDA_API,
    EDA_APP,
    FLAT_RUN_HOURS,
    MIN_HOURS_PER_DAY,
    MIN_VALID_PPM,
    MISSIONS,
    PUBLIC_DATA,
    SNAPSHOT_DIR,
    daily_from_hourly,
    hourly_means,
    load_snapshot,
    ppm_to_mmhg,
    sha256_file,
    update_sums,
    utc_iso,
    valid_co2_samples,
    verify_sums,
    write_json,
)

# The demo replays one real mission as the cabin feed of the Mars vehicle.
DEMO_MISSION = "RR-7"
# Replay anchor: this real date is shown as this mission day. Nothing else is shifted.
ANCHOR_DATE = date(2018, 8, 21)
ANCHOR_MISSION_DAY = 213


def fetch_raw(mission: str, refresh: bool):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{mission}.json"
    if refresh or not path.exists():
        url = f"{EDA_API}/missions/{mission}/telemetry_data/?format=json"
        print(f"  downloading {url}")
        req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "shipshape-snapshot"})
        with urllib.request.urlopen(req, timeout=600) as resp:
            path.write_bytes(resp.read())
    return path


def mission_info(refresh: bool) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / "missions.json"
    if refresh or not path.exists():
        req = urllib.request.Request(f"{EDA_API}/missions/?format=json", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            path.write_bytes(resp.read())
    return {m["name"]: m for m in json.loads(path.read_text(encoding="utf-8"))}


def build_snapshot(mission: str, info: dict, refresh: bool):
    raw_path = fetch_raw(mission, refresh)
    rows = json.loads(raw_path.read_text(encoding="utf-8"))
    kept, counts = valid_co2_samples(rows)
    hourly = hourly_means(kept)
    m = info.get(mission, {})
    snap = {
        "meta": {
            "real": True,
            "source": "NASA Open Science Data Repository (OSDR), Environmental Data Application (EDA) API",
            "mission": mission,
            "missionTitle": m.get("title"),
            "osdrLink": m.get("link"),
            "apiUrl": f"{EDA_API}/missions/{mission}/telemetry_data/",
            "fetchedAt": utc_iso(raw_path.stat().st_mtime),
            "rawSha256": sha256_file(raw_path),
            "series": "co2_iss, temperature_iss, humidity_iss",
            "aggregation": "plain mean of the published samples in each UTC hour",
            "excluded": (
                f"samples below {MIN_VALID_PPM:.0f} ppm and runs of one identical value lasting "
                f">= {FLAT_RUN_HOURS:.0f} h (placeholders from before the hardware was on station); dropped, not repaired"
            ),
            "sampleCounts": counts,
            "columns": ["hourUtc", "co2Ppm", "tempC", "rhPct", "nSamples"],
        },
        "hourly": hourly,
    }
    out = SNAPSHOT_DIR / f"{mission}_hourly.json"
    write_json(out, snap, compact=True)
    print(f"  {mission}: {counts['total']} samples, kept {len(kept)}, {len(hourly)} hours -> {out.name}")
    return out


def build_cabin():
    snap = load_snapshot(DEMO_MISSION)
    daily = daily_from_hourly(snap["hourly"])

    def mission_day(d: date) -> int:
        return ANCHOR_MISSION_DAY + (d - ANCHOR_DATE).days

    for row in daily:
        row["day"] = mission_day(date.fromisoformat(row["date"]))
    hourly = []
    for hour, co2ppm, temp, rh, _n in snap["hourly"]:
        d = date.fromisoformat(hour[:10])
        # hours from the check-in hour onward belong to the next mission day's window
        if int(hour[11:13]) >= CHECKIN_HOUR_UTC:
            d = d + timedelta(days=1)
        hourly.append({"t": hour, "day": mission_day(d), "co2": round(ppm_to_mmhg(co2ppm), 3), "temp": temp, "rh": rh})
    meta = dict(snap["meta"])
    meta.pop("columns", None)
    meta.update(
        {
            "appUrl": EDA_APP,
            "units": {"co2": "mmHg", "temp": "degC", "rh": "%"},
            "conversion": (
                f"mmHg = ppm x {CABIN_PRESSURE_MMHG:.0f} / 1e6 (nominal ISS cabin pressure). "
                "A unit conversion; the values are not rescaled."
            ),
            "replay": {
                "anchorDate": ANCHOR_DATE.isoformat(),
                "anchorMissionDay": ANCHOR_MISSION_DAY,
                "note": "The real trace is replayed on the simulated mission's calendar. Only the day labels change.",
            },
            "dailyWindow": (
                f"Each mission day covers the 24 h before the {CHECKIN_HOUR_UTC:02d}:00 UTC check-in; "
                f"the mean needs at least {MIN_HOURS_PER_DAY} hours of data."
            ),
            "caveat": (
                "The series is the ISS-side environmental telemetry published for the Rodent Research 7 payload. "
                "It is real ISS data, but it comes from that payload's sensor location and may differ from a cabin-wide average."
            ),
            "limitMmHg": 3.0,
            "limitSource": "NASA-STD-3001 Vol 2 [V2 6004]: 1-hour average CO2 limited to 3 mmHg",
        }
    )
    out = PUBLIC_DATA / "cabin.json"
    write_json(out, {"meta": meta, "daily": daily, "hourly": hourly}, compact=True)
    days = [r["day"] for r in daily]
    print(f"  cabin.json: mission days {min(days)}..{max(days)} ({len(daily)} days, {len(hourly)} hours)")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-download the raw API responses")
    ap.add_argument("--verify", action="store_true", help="only verify checksums")
    args = ap.parse_args()

    if args.verify:
        problems = verify_sums()
        for p in problems:
            print("FAIL", p)
        if not problems:
            print("all tracked data files match scripts/snapshots/SHA256SUMS")
        return 1 if problems else 0

    info = mission_info(args.refresh)
    written = []
    print("Snapshots:")
    for mission in MISSIONS:
        written.append(build_snapshot(mission, info, args.refresh))
    print("Demo cabin feed:")
    written.append(build_cabin())
    update_sums(written)
    print(f"checksums -> {len(written)} files in scripts/snapshots/SHA256SUMS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
