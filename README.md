# Shipshape

A crew check-in game for long missions. It rewards honest reporting and tells the crew whether a bad day is likely them or the ship.

Built for the NASA International Space Apps Challenge. This is the MVP of [plan v0.1](<Shipshape — overall plan v0.1 (for team input).md>).

- **Real:** ISS cabin CO₂, temperature and humidity from NASA's Open Science Data Repository (mission RR-7), and the thresholds.
- **Simulated:** the four-person crew, seeded and labeled as simulated on every screen.
- **Not in it:** an AI model, a diagnosis, a leaderboard or a backend. The PIN login runs in the browser only (see below).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (login; then /dashboard and /app)
npm test           # unit tests for the rules and the game
npm run build      # production build, installable and offline-capable
```

### Log in

The start page is a login: pick a crew member and type their PIN. These are demo PINs:

| Crew member | Role | PIN |
| --- | --- | --- |
| Anna | Astronaut | 1111 |
| Ben | Astronaut | 2222 |
| Chen | Astronaut | 3333 |
| Dana | Medical officer | 4444 |

Everyone gets their own dashboard and nobody else's. Only the medical officer can open the crew app at /app; that is the one thing the role adds. An astronaut who opens /app is sent to their own dashboard.

The login is a privacy gate for a demo, not security: there is no server, so anyone can read `public/data/accounts.json` and try all 10 000 PINs offline. It stores a salted PBKDF2 hash per person, never the PIN. A session lasts until the tab closes (at most 8 hours); five wrong PINs lock that person out for 30 s, doubling each time.

### Pages

- **/dashboard**: the logged-in person's dashboard on a 3D skeleton. Zones turn orange when something drifts from their own normal and red when it lasts to day 3 or cabin CO₂ is over the limit. Its demo days are 212 (nominal), 219 (cabin CO₂) and 223 (day 3); `?day=223` opens a specific day. Chen (PIN 3333) is the one to follow.
- **/app** (medical officer only): the seven-screen crew app. Use the **Golden path** control: day 212 (all OK), 213 (CO₂ rises, "Likely the ship, not you"), 221 (air back to normal, one person still off), 223 (day 3, summary to the flight surgeon). **Viewing as** switches between the four crew members, the crew medical officer and the flight surgeon.

## Rebuild the data

Needs Python 3.10+ (standard library only) and network access for the first step.

```bash
npm run data:snapshot   # download ISS telemetry from NASA OSDR, write snapshots and checksums
npm run data:crew       # generate the seeded demo crew
npm run data:backtest   # 200 simulated crews through the app's own engine
npm run data:accounts   # demo login accounts (new random salts each run)
python3 scripts/snapshot_eda.py --verify
```

## Layout

```
src/engine/   baseline.ts  deviation.ts  shipOrMe.ts  escalation.ts  privacy.ts  config.ts
src/game/     xp.ts  streak.ts  quests.ts
src/ui/       CrewBoard  CheckInScreen  MeView  ShipAlert  LearnCards  Medical  RoleSwitcher
src/auth/     Login  RequireUser  pin.ts  session.ts  paths.ts
src/dashboard/ Dashboard  SkeletonView  model.ts
scripts/      snapshot_eda.py  simulate_crew.py  backtest.py  make_accounts.py  engine_cli.ts  snapshots/
public/data/  cabin.json  crew.json  backtest.json  accounts.json
tests/        engine.test.ts  game.test.ts  auth.test.ts
docs/         SPEC.md  CITATIONS.md  AI_USE_LOG.md
```

`docs/SPEC.md` has the JSON shapes, every rule, the readings of the plan that this build chose, and the open items.

## Team

- Filip Kolar

## License

To be decided.
