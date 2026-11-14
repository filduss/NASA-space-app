"""Writes public/data/accounts.json: who can log in, their role, and a salted PIN hash.

    python3 scripts/make_accounts.py

The PINs below are demo PINs for a hackathon judge to type; they are printed in the README.
The file stores only a random salt and a PBKDF2-SHA256 hash per person, never the PIN.
A new run draws new salts, so the file (and its checksum) changes every time.

Limit: the app has no server, so anyone can download this file. Four digits are 10 000
possibilities, which an offline guess tries in seconds whatever the hash. The login keeps
crewmates out of each other's dashboards in normal use; it is not a security boundary.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import sys

from shipshape_data import PUBLIC_DATA, update_sums, write_json

# Same parameters as src/auth/pin.ts. OWASP's 2023 figure for PBKDF2-HMAC-SHA256.
ITERATIONS = 600_000
SALT_BYTES = 16
KEY_BYTES = 32

# crewId -> (role, demo PIN). Dana is the crew medical officer of the demo crew.
DEMO_ACCOUNTS = {
    "anna": ("astronaut", "1111"),
    "ben": ("astronaut", "2222"),
    "chen": ("astronaut", "3333"),
    "dana": ("medical", "4444"),
}

# People on Earth who log in but are not crew: id -> (name, role, demo PIN). They never have a
# dashboard; the flight surgeon sees the crew app filled only with what was sent to Earth.
EARTH_ACCOUNTS = {
    "mira": ("Mira", "surgeon", "5555"),
}


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def main() -> int:
    crew = json.loads((PUBLIC_DATA / "crew.json").read_text(encoding="utf-8"))["crew"]
    crew_ids = [c["id"] for c in crew]
    if sorted(crew_ids) != sorted(DEMO_ACCOUNTS):
        print(f"crew.json has {crew_ids}; DEMO_ACCOUNTS has {list(DEMO_ACCOUNTS)}. Update the script.")
        return 1
    if set(EARTH_ACCOUNTS) & set(crew_ids):
        print(f"EARTH_ACCOUNTS {list(EARTH_ACCOUNTS)} must not reuse a crew id from crew.json.")
        return 1

    def account(account_id: str, role: str, pin: str, name: str | None = None) -> dict:
        assert len(pin) == 4 and pin.isdigit()
        assert role in ("astronaut", "medical", "surgeon")
        salt = secrets.token_bytes(SALT_BYTES)
        key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, ITERATIONS, KEY_BYTES)
        out = {"crewId": account_id, "role": role}
        if name is not None:
            out["name"] = name
        return {**out, "salt": b64(salt), "hash": b64(key)}

    accounts = [account(crew_id, *DEMO_ACCOUNTS[crew_id]) for crew_id in crew_ids]
    for account_id, (name, role, pin) in EARTH_ACCOUNTS.items():
        accounts.append(account(account_id, role, pin, name))

    out = PUBLIC_DATA / "accounts.json"
    write_json(
        out,
        {
            "meta": {
                "generator": "scripts/make_accounts.py",
                "label": "Demo accounts. PINs are listed in the README; only salted hashes are stored here.",
                "kdf": {"name": "PBKDF2", "hash": "SHA-256", "iterations": ITERATIONS, "keyBytes": KEY_BYTES},
            },
            "accounts": accounts,
        },
    )
    update_sums([out])
    roles = ", ".join(f"{a['crewId']}={a['role']}" for a in accounts)
    print(f"accounts.json: {len(accounts)} accounts ({roles})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
