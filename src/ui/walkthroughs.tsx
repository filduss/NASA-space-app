import type { WalkStep } from './Walkthrough.tsx'

// The walkthrough's steps for each page. Each `target` is a `data-tour` attribute on the page; the
// demo dock's own step comes last on every page (dockStep). Plain descriptions of what is on screen:
// no sourced claims, "likely" and never a diagnosis.

export type WalkPage = 'dashboard' | 'checkin' | 'app'

export const walkKey = (page: WalkPage) => `shipshape.walk.${page}`

const DASHBOARD: WalkStep[] = [
  {
    target: 'answer',
    title: 'Is it me, or the ship?',
    body: (
      <>
        <p>Before you blame yourself, check the air. That’s what this card does.</p>
        <p>On the ISS, every small rise in CO₂ doubled the odds of a headache.</p>
      </>
    ),
  },
  {
    target: 'checkin',
    title: 'The daily check-in',
    body: <p>This is how the app gets its input from the astronaut: a short check-in each morning.</p>,
  },
  {
    target: 'body',
    title: 'Your body at a glance',
    body: (
      <p>
        A zone turns orange (watch) or red (alert) when something there is off your own usual. Tap a zone to zoom in and see what is off. Colour is never the only sign,
        each level has its own shape so colour-blind crew can read it too.
      </p>
    ),
  },
  {
    target: 'vitals',
    title: 'Against your own normal',
    body: <p>Each reading is compared with your own usual over the last 14 days. Tap a tile for a larger chart.</p>,
  },
  {
    target: 'wearable',
    title: 'From your wearable',
    body: <p>Automatically syncs daily health metrics from your wearable.</p>,
  },
]

const CHECKIN: WalkStep[] = [
  {
    target: 'ratings',
    title: 'Five quick ratings',
    body: <p>Tap 0 to 10 for sleep, tiredness, irritability, stress and mood. Nothing is filled in for you: every answer is your own choice.</p>,
  },
  {
    target: 'symptoms',
    title: 'Symptoms',
    body: (
      <p>
        Tick any you have had since yesterday, or <strong>None today</strong>.
      </p>
    ),
  },
  {
    target: 'conference',
    title: 'Talk to your flight surgeon',
    body: <p>A private medical conference can be asked for at any time, without finishing the check-in.</p>,
  },
  {
    target: 'send',
    title: 'Send',
    body: <p>Grey until every answer is in, then blue.</p>,
  },
]

function crewApp(surgeon: boolean): WalkStep[] {
  return [
    {
      target: 'screens',
      title: 'The medical console',
      body: (
        <p>
          Crew board, Inbox and Ship{surgeon ? ', plus Summaries sent to Earth' : ''}. A mark on <strong>Ship</strong> means a ship alert is on.
        </p>
      ),
    },
    {
      target: 'ship-answer',
      title: 'Likely the ship, or not',
      body: <p>When several crew drift at once while the cabin air is off, the app says likely the ship before blaming anyone. The button shows why.</p>,
    },
    {
      target: 'timeline',
      title: 'The last 14 days',
      body: <p>Cabin CO₂ on top, how many crew drift under it, then a row per person. Tap a day to read it.</p>,
    },
    {
      target: 'private',
      title: 'Mood and stress stay private',
      body: <p>On the crew board they are only a count, never names.</p>,
    },
  ]
}

/** The demo dock's step, the last on every page. */
export function dockStep(hasSettings: boolean): WalkStep {
  return {
    target: 'demo',
    title: 'This bar runs the demo',
    body: (
      <>
        <p>It is not part of Ship Or Me? It moves the mission calendar so you can watch the app react.</p>
        <ul className="tip-list">
          <li>
            <strong>‹ Day ›</strong> steps one mission day.
          </li>
          <li>
            <strong>1–4</strong> jump to the four moments of the demo: the cabin CO₂ climbs, the cabin is high, likely not the ship, day 3.
          </li>
          {hasSettings && (
            <li>
              <strong>Settings</strong> change the mission and the delay to Earth.
            </li>
          )}
          <li>
            <strong>ⓘ</strong> says where the data comes from.
          </li>
          <li>
            <strong>?</strong> shows this walkthrough again.
          </li>
        </ul>
      </>
    ),
  }
}

/** The page's steps, without the dock's. */
export function walkSteps(page: WalkPage, surgeon = false): WalkStep[] {
  return page === 'dashboard' ? DASHBOARD : page === 'checkin' ? CHECKIN : crewApp(surgeon)
}
