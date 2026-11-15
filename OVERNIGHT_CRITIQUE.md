# Overnight critique: Shipshape

Written on 15 Nov 2026 from 04:30 CET, on branch `fable`, by an AI reviewer acting as judge, engineer, designer and NASA scientist. Status of each item is kept up to date below.

**Project as understood:** Shipshape is a crew check-in for long missions that says whether a bad day is "likely you" or "likely the ship". It targets the NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". It uses real ISS cabin CO₂, temperature and humidity from NASA's Open Science Data Repository (Environmental Data Application API, mission RR-7, plus nine more RR missions for the backtest), the NASA-STD-3001 limits, and a simulated crew. Static Vite + React + TypeScript, no backend.

**Baseline before any change:** `npm test` 120 of 120 pass, `npm run build` passes, the checksum verify passes, and the four tour stops open in about a second each.

## Decisions taken without asking

| Decision | Why |
| --- | --- |
| Worked on branch `fable`, not `overnight-improvements` | The instruction given with the brief said "write everything in branch fable"; it is newer than the brief's ground rule 1. `main` is untouched. |
| Did not rate repo visibility or the video | The team said these come last. |
| Made the check-in's privacy line match what the build does, instead of building the stricter privacy the team agreed | `CONTEXT.md` says check-in answers reach only the flight surgeon. The crew board and inbox still show sleep, fatigue and symptoms to the medical officer (an open item in `docs/SPEC.md`). Changing the board is an engine and privacy change too large to do unattended on deadline day; a sentence that contradicts tour stop 1 is worse than an accurate one. One commit, easy to revert. |
| Did not touch `RULES`, the engine or any data file | Any rule change moves the demo seed and the backtest numbers, and the golden path is what the video shows. |
| Did not add names to the Team list or choose a license | Those are the team's to decide; both are flagged under "Read this first". |

## What is strong

The idea is specific and different: most entries will give each astronaut a personal alert, and this one asks first whether the cabin is the cause. The NASA data is real, checksummed, unit-converted and nothing more, and its oddities are stated on screen. The evidence section reports its own blind spots (masking, under-reporting). The judge's tour gets a stranger to the point in one click. Tests pin the golden path. Do not spend today rebuilding any of this.

## Issues, ranked by gain per hour

Severity is how much it can cost with a judge. Status is one of Fixed (commit), Partly fixed, Not done.

| # | Severity | Issue | Status |
| --- | --- | --- | --- |
| 1 | Critical | Dashboard goes fully blank when WebGL is unavailable | Open |
| 2 | Critical | No error boundary anywhere: any render error is a blank page | Open |
| 3 | High | The challenge page claims things the app no longer does | Open |
| 4 | High | The check-in says answers go to the flight surgeon; the medical officer sees them | Open |
| 5 | High | Phone header overlaps for the medical officer (tour stop 1 on a phone) | Open |
| 6 | Medium | Inbox names a ship alert's reasons but its table hides them | Open |
| 7 | Medium | Stale "share" wording where no screen can share | Open |
| 8 | Medium | Data-load failure tells a judge to run `npm run data` | Open |
| 9 | Medium | Duplicate React key on the PIN keypad (console error on every login) | Open |
| 10 | Medium | Ship summaries on day 6 are labelled "Day-3 summary" | Open |
| 11 | Medium | Link previews: no Open Graph tags, no `<noscript>` | Open |
| 12 | Medium | README: stale layout, license "To be decided", team list | Open |
| 13 | Medium | The 90% accuracy is measured on a simulator built on the rule's own assumption | Open |
| 14 | Low | Low-contrast small text on the login | Open |
| 15 | Low | Body-zone chips truncate on desktop ("Head & s…") | Open |
| 16 | Low | 325 kB entry bundle; 728 kB dashboard chunk | Open |
| 17 | Low | Radiation card reads alarming (64% of career limit) for a side feature | Open |
| 18 | Low | Citations still marked unchecked | Open |

### 1. Dashboard goes blank without WebGL (Critical)

- **Evidence:** `src/dashboard/SkeletonView.tsx:90` calls `new THREE.WebGLRenderer(...)` inside an effect with no guard. Run Chrome with `--disable-3d-apis` and open `/dashboard?day=221` as Chen: `#root` is empty, console shows "Error creating WebGL context".
- **Why a judge cares:** tour stop 2 is the dashboard. Remote desktops, locked-down laptops, some virtual machines and browsers with hardware acceleration off have no WebGL. The judge sees a black page and moves on.
- **Fix:** catch the failure and show the zone list without the 3D figure; the chips under the stage already carry every fact.

### 2. No error boundary (Critical)

- **Evidence:** `grep -r ErrorBoundary src` finds nothing; `src/main.tsx` renders the tree bare. React unmounts everything on an uncaught render error.
- **Why a judge cares:** one unexpected value in `localStorage` from an older build, or one bug on an untested day, and the screen is black with no way back.
- **Fix:** a boundary at the root with a plain message, a reload button and a "clear my saved inputs" button.

### 3. The challenge page describes an older app (High)

- **Evidence:** `src/ui/Challenge.tsx:17` "sliders for sleep, fatigue…": sleep duration now comes from the wearable and the ratings are tap rows. Line 23 "Every check-in item says why it is asked": that text was removed on 15 Nov. Line 29 "each check-in can log yesterday's exercise": the wearable logs it.
- **Why a judge cares:** this page is the one that maps the app to the judging questions. A judge who clicks "Open the check-in" finds no "why" text and no sleep slider, and starts doubting the other claims.
- **Fix:** rewrite the three answers to match the build.

### 4. The check-in's privacy promise is contradicted two clicks away (High)

- **Evidence:** `src/ui/CheckInScreen.tsx` intro: "Your answers go to your flight surgeon." Tour stop 1, as Dana: the crew board lists "Anna ▲ Headache, Ben ▲ Fatigue" and the inbox lists everyone's sleep and symptoms. `docs/SPEC.md` "Open items" admits it.
- **Why a judge cares:** privacy is half the pitch. A privacy claim the demo itself disproves reads as careless.
- **Fix (taken):** say what is true: sleep, fatigue, irritability and symptoms go to the medical officer and flight surgeon; mood and stress stay private. **Better fix (not done):** remove names from the board for the medical officer, as `CONTEXT.md` describes.

### 5. Phone header overlap (High)

- **Evidence:** 390 px wide, `/app` as Dana: the avatar sits on top of the word "Shipshape" (three account links do not fit beside the brand).
- **Why a judge cares:** phone is how many judges open a link, and this is the first thing on tour stop 1.
- **Fix:** let the header wrap; hide the brand tagline and name where needed.

### 6. Inbox table hides the reasons the alert names (Medium)

- **Evidence:** day 213 inbox: "Ship alert: 3 of 4 crew show CO₂-linked changes (symptoms and fatigue)", but the table has columns for sleep, sleep quality and symptoms only. Ben and Dana, both flagged for fatigue, look fine.
- **Fix:** add an "Off own usual" column from `boardPerson` (shared indicators only, the same path the board uses).

### 7. "Share" wording with no share control (Medium)

- **Evidence:** `src/ui/Medical.tsx:72` and `:117` say mood and stress appear "when the person shares them". The Me screen with the toggle was removed.
- **Fix:** say they are private; drop the promise.

### 8. Developer message on data failure (Medium)

- **Evidence:** block `data/crew.json`: the page says "Could not load the data files (TypeError: Failed to fetch). Run npm run data."
- **Fix:** plain message and a "Try again" button; keep the technical detail small.

### 9. Duplicate key on the keypad (Medium)

- **Evidence:** `src/auth/Login.tsx` keys the blank cell by index 9 and the "9" key by "9". React logs "Encountered two children with the same key" on every render of the PIN step.
- **Fix:** distinct key for the blank cell.

### 10. "Day-3 summary" on a day-6 ship alert (Medium)

- **Evidence:** Summaries on day 223: "Ship alert, day 6 of the alert" with the line "Day-3 summary, sent mission day 218".
- **Fix:** label by kind: "Ship summary (every 3 days)" and "Day-3 summary" or "Follow-up summary" for a person.

### 11. Link previews and no-script (Medium)

- **Evidence:** `index.html` has a description but no `og:` tags; with JavaScript off the page is empty.
- **Why a judge cares:** the project link gets pasted into chats and the submission form; a bare URL preview undersells it.
- **Fix:** add `og:title`, `og:description`, a `<noscript>` line. An `og:image` needs a hosted PNG and the final URL: left to the team.

### 12. README (Medium)

- **Evidence:** the Layout block lists `About` and `RoleSwitcher` in a way that no longer matches `src/ui/`; "License: To be decided"; Team lists two people while commits come from more.
- **Why a judge cares:** Space Apps asks for open-source work; a repository with no license is not open source.
- **Fix:** layout corrected here. **License and team are yours.**

### 13. The accuracy figure is partly circular (Medium)

- **Evidence:** `scripts/shipshape_sim.py` makes simulated crews feel CO₂ through the same indicators the rule reads, then the backtest scores the rule on those crews. The challenge page says "simulated crews" and lists limits, but the headline "named the right cause in 90% of alerts" has no such sentence next to it.
- **Why a judge cares:** a NASA scientist will ask this within a minute. Saying it first earns trust.
- **Fix:** one sentence beside the headline: the simulator assumes the CO₂ effect the rule looks for, so the figure shows the rule is consistent and robust to noise, not that it is validated.

### 14. Low-contrast small text (Low)

- **Evidence:** the pitch under the title on the login, the tour step bodies and the footer use the faintest ink on black.
- **Fix:** raise the pitch and step bodies one step.

### 15. Truncated zone chips (Low)

- **Evidence:** 1366 px desktop dashboard: "Head & s…", "Muscles …".
- **Fix:** allow two lines or smaller text.

### 16. Bundle size (Low)

- **Evidence:** build output: `index` 325 kB, `Dashboard` 728 kB (three.js), 2.2 MB precache.
- **Not worth touching today**: loads in about a second, and it is cached after the first visit.

### 17. Radiation card (Low)

- **Evidence:** Ship screen, Mars: "Career limit used 64%… reached day 334", from a dose-equivalent rate against an effective-dose limit. It is labelled an estimate and explained.
- **Risk:** a radiation specialist may object to mixing the two quantities. The caveat is already on the card; do not put the number in the video.

### 18. Citations (Low)

- **Evidence:** `docs/CITATIONS.md` still has "No" in the Checked column for five sources.
- **Fix:** a human opens them; an AI must not mark them.

## Demo risk

| Risk | State |
| --- | --- |
| Network or API down during the demo | None: no runtime API. Data is static JSON, precached by the service worker. |
| Missing keys or rate limits | None: there are no keys. |
| WebGL missing on the judge's machine | See 1. |
| Stale service worker shows yesterday's build | `autoUpdate` swaps on the next load. After the final deploy, open the live site twice before recording or submitting. |
| Old `localStorage` from testing changes the demo days | A live check-in saved in the browser replaces the simulated one for that day. Use a private window, or Demo controls → Reset my inputs, before recording. |
| Wrong-PIN lockout | Persists in `localStorage`; a private window clears it. |
