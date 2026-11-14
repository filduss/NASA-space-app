"""Shared helpers for the Shipshape data scripts (stdlib only).

Real data: ISS telemetry from the NASA OSDR Environmental Data Application (EDA) API.
Rules for real data in this project:
  * never rescale it; the only arithmetic is a unit conversion (ppm -> mmHg) and averaging
  * placeholder samples are dropped, never repaired (see `valid_co2_samples`)
  * every derived file carries a SHA-256 checksum (scripts/snapshots/SHA256SUMS)
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "scripts" / ".cache"
SNAPSHOT_DIR = ROOT / "scripts" / "snapshots"
PUBLIC_DATA = ROOT / "public" / "data"
SUMS_FILE = SNAPSHOT_DIR / "SHA256SUMS"

EDA_API = "https://visualization.osdr.nasa.gov/eda/api"
EDA_APP = "https://visualization.osdr.nasa.gov/eda"

# Missions on EDA that publish an ISS CO2 series (checked 2026-11-14).
MISSIONS = ["RR-1", "RR-3", "RR-5", "RR-6", "RR-7", "RR-9", "RR-10", "RR-12", "RR-19", "RR-23"]

# Unit conversion only: partial pressure = mole fraction x total pressure.
# The ISS cabin is held near sea-level pressure; 760 mmHg is the nominal value.
CABIN_PRESSURE_MMHG = 760.0

# Validity filter (drop, never repair):
MIN_VALID_PPM = 400.0  # below outdoor air on Earth: not a crewed-cabin reading
FLAT_RUN_HOURS = 6.0  # identical value for >= 6 h: a placeholder held before hardware was on station

CHECKIN_HOUR_UTC = 8  # the morning check-in closes each mission day's 24 h cabin window
MIN_HOURS_PER_DAY = 12  # a cabin day needs at least this many hours of data to get a mean


def ppm_to_mmhg(ppm: float) -> float:
    return ppm * CABIN_PRESSURE_MMHG / 1_000_000.0


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_json(path: Path, obj, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    else:
        text = json.dumps(obj, indent=1, ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8")


def parse_time(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def valid_co2_samples(rows: list[dict]) -> tuple[list[dict], dict]:
    """Drop placeholder CO2 samples. Returns (kept rows, counts of what was dropped)."""
    rows = [r for r in rows if r.get("co2_iss") is not None]
    rows.sort(key=lambda r: r["time"])
    keep = [True] * len(rows)
    dropped_low = 0
    for i, r in enumerate(rows):
        if r["co2_iss"] < MIN_VALID_PPM:
            keep[i] = False
            dropped_low += 1
    dropped_flat = 0
    i = 0
    while i < len(rows):
        j = i
        while j + 1 < len(rows) and rows[j + 1]["co2_iss"] == rows[i]["co2_iss"]:
            j += 1
        if j > i:
            span = (parse_time(rows[j]["time"]) - parse_time(rows[i]["time"])).total_seconds() / 3600.0
            if span >= FLAT_RUN_HOURS:
                for k in range(i, j + 1):
                    if keep[k]:
                        keep[k] = False
                        dropped_flat += 1
        i = j + 1
    kept = [r for r, k in zip(rows, keep) if k]
    return kept, {"total": len(rows), "droppedBelow400ppm": dropped_low, "droppedFlatRun": dropped_flat}


def hourly_means(rows: list[dict]) -> list[list]:
    """[[iso hour, co2 ppm, temp C, RH %, n samples], ...] - plain means of the samples in each UTC hour."""
    buckets: dict[str, dict[str, list[float]]] = {}
    for r in rows:
        b = buckets.setdefault(r["time"][:13], {"co2": [], "temp": [], "rh": []})
        b["co2"].append(r["co2_iss"])
        if r.get("temperature_iss") is not None:
            b["temp"].append(r["temperature_iss"])
        if r.get("humidity_iss") is not None:
            b["rh"].append(r["humidity_iss"])

    def mean(xs: list[float], nd: int):
        return round(sum(xs) / len(xs), nd) if xs else None

    out = []
    for hour in sorted(buckets):
        b = buckets[hour]
        out.append([hour + ":00:00Z", mean(b["co2"], 1), mean(b["temp"], 2), mean(b["rh"], 1), len(b["co2"])])
    return out


def daily_from_hourly(hourly: list[list]) -> list[dict]:
    """One row per date. The window for date D is the 24 h that end at the morning check-in:
    [D-1 08:00, D 08:00) UTC. co2Mean is None when fewer than MIN_HOURS_PER_DAY hours have data."""
    by_hour = {h[0]: h for h in hourly}
    if not hourly:
        return []
    first = parse_time(hourly[0][0]).date() + timedelta(days=1)
    last = parse_time(hourly[-1][0]).date()
    out = []
    d = first
    while d <= last:
        end = datetime(d.year, d.month, d.day, CHECKIN_HOUR_UTC, tzinfo=timezone.utc)
        co2, temp, rh = [], [], []
        for k in range(24):
            key = (end - timedelta(hours=24 - k)).strftime("%Y-%m-%dT%H:00:00Z")
            h = by_hour.get(key)
            if h is None:
                continue
            co2.append(ppm_to_mmhg(h[1]))
            if h[2] is not None:
                temp.append(h[2])
            if h[3] is not None:
                rh.append(h[3])
        enough = len(co2) >= MIN_HOURS_PER_DAY
        out.append(
            {
                "date": d.isoformat(),
                "hours": len(co2),
                "co2Mean": round(sum(co2) / len(co2), 3) if enough else None,
                "co2Max1h": round(max(co2), 3) if co2 else None,
                "temp": round(sum(temp) / len(temp), 2) if temp else None,
                "rh": round(sum(rh) / len(rh), 1) if rh else None,
            }
        )
        d += timedelta(days=1)
    return out


def load_snapshot(mission: str) -> dict:
    return json.loads((SNAPSHOT_DIR / f"{mission}_hourly.json").read_text(encoding="utf-8"))


def read_sums() -> dict[str, str]:
    sums = {}
    if SUMS_FILE.exists():
        for line in SUMS_FILE.read_text().splitlines():
            if line.strip():
                digest, name = line.split(None, 1)
                sums[name.strip()] = digest
    return sums


def update_sums(paths: list[Path]) -> None:
    sums = read_sums()
    for p in paths:
        sums[p.relative_to(ROOT).as_posix()] = sha256_file(p)
    SUMS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUMS_FILE.write_text("".join(f"{v}  {k}\n" for k, v in sorted(sums.items())))


def verify_sums() -> list[str]:
    """Returns a list of problems; empty means every tracked file matches its checksum."""
    problems = []
    sums = read_sums()
    if not sums:
        problems.append("no checksums recorded")
    for name, digest in sorted(sums.items()):
        p = ROOT / name
        if not p.exists():
            problems.append(f"missing: {name}")
        elif sha256_file(p) != digest:
            problems.append(f"checksum mismatch: {name}")
    return problems


def utc_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
