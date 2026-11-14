# Shipshape

A crew check-in game for long missions. It rewards honest reporting and tells the crew whether a bad day is likely them or the ship.

Built for the NASA International Space Apps Challenge. This is the MVP of [plan v0.1](<Shipshape — overall plan v0.1 (for team input).md>).

- **Real:** ISS cabin CO₂, temperature and humidity from NASA's Open Science Data Repository (mission RR-7), and the thresholds.
- **Simulated:** the four-person crew, seeded and labeled as simulated on every screen.
- **Estimated:** radiation dose for the chosen setting (ISS, lunar surface or Mars transit), from published measurements, against NASA's 600 mSv career limit.
- **Not in it:** an AI model, a diagnosis, a leaderboard, a backend or a login.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the rules and the game
npm run build      # production build, installable and offline-capable
```

Open the app and use the **Golden path** control: day 212 (all OK), 213 (CO₂ rises, "Likely the ship, not you"), 221 (air back to normal, one person still off), 223 (day 3, summary to the flight surgeon). **Viewing as** switches between the four crew members, the crew medical officer and the flight surgeon. **Mission** switches between the ISS, the lunar surface and Mars transit; it changes the delay to Earth and the radiation card on the Ship screen, never the rules.

## Rebuild the data

Needs Python 3.10+ (standard library only) and network access for the first step.

```bash
npm run data:snapshot   # download ISS telemetry from NASA OSDR, write snapshots and checksums
npm run data:crew       # generate the seeded demo crew
npm run data:backtest   # 200 simulated crews through the app's own engine
python3 scripts/snapshot_eda.py --verify
```

## Layout

```
src/engine/   baseline.ts  deviation.ts  shipOrMe.ts  escalation.ts  privacy.ts  config.ts  mission.ts
src/game/     xp.ts  streak.ts  quests.ts
src/ui/       CrewBoard  CheckInScreen  MeView  ShipAlert  Radiation  LearnCards  Medical  RoleSwitcher
scripts/      snapshot_eda.py  simulate_crew.py  backtest.py  engine_cli.ts  snapshots/
public/data/  cabin.json  crew.json  backtest.json
tests/        engine.test.ts  game.test.ts  mission.test.ts
docs/         SPEC.md  CITATIONS.md  AI_USE_LOG.md
```

`docs/SPEC.md` has the JSON shapes, every rule, the readings of the plan that this build chose, and the open items.

## Team

- Filip Kolar

## License

To be decided.
