// Where the crew is. The setting changes two things the crew cannot control: how long a message
// takes to reach Earth, and how fast radiation dose builds up. It never changes the ship-or-me rule,
// and the cabin CO2 is the same real ISS telemetry in every setting.

export type MissionKey = 'iss' | 'moon' | 'mars' | 'antarctica'

export interface Source {
  label: string
  url: string
}

/** Radiation dose per day: a published average for the place, not this crew's dosimeters. */
export interface Radiation {
  doseMSvPerDay: number
  /** What the source measured. NASA's limit is effective dose; dose equivalent is close but not the same. */
  quantity: 'effective dose' | 'dose equivalent'
  note: string
  source: Source
}

export interface MissionSetting {
  key: MissionKey
  /** Short name for the header and the demo controls. */
  label: string
  place: string
  /** One-way signal delay to Earth, in seconds: the choices the demo offers, and the default. */
  delaysSec: number[]
  defaultDelaySec: number
  /** Null on Earth, where the atmosphere and the magnetic field shield the crew from space radiation. */
  radiation: Radiation | null
}

export const MISSIONS: Record<MissionKey, MissionSetting> = {
  iss: {
    key: 'iss',
    label: 'ISS',
    place: 'Low Earth orbit',
    // Relayed through satellites: well under a second each way.
    delaysSec: [0.5],
    defaultDelaySec: 0.5,
    // NASA gives 0.2 to 0.5 mSv a day of effective dose on the ISS; the dose budget uses the high end.
    radiation: {
      doseMSvPerDay: 0.5,
      quantity: 'effective dose',
      note: "high end of NASA's 0.2 to 0.5 range",
      source: { label: 'Simonsen, Zawaski and Weeks, NASA (2025)', url: 'https://ntrs.nasa.gov/citations/20250006168' },
    },
  },
  moon: {
    key: 'moon',
    label: 'Lunar surface',
    place: 'A base on the Moon',
    // About 384,400 km divided by the speed of light.
    delaysSec: [1.3],
    defaultDelaySec: 1.3,
    // 1,369 µSv a day, measured on the far side by the Chang'E-4 lander in 2019.
    radiation: {
      doseMSvPerDay: 1.37,
      quantity: 'dose equivalent',
      note: "measured on the surface by Chang'E-4",
      source: { label: 'Zhang et al. 2020, Science Advances', url: 'https://doi.org/10.1126/sciadv.aaz1334' },
    },
  },
  mars: {
    key: 'mars',
    label: 'Mars transit',
    place: 'Cruise between Earth and Mars',
    // One-way light time between Earth and Mars runs from about 3 to 22 minutes.
    delaysSec: [4 * 60, 12 * 60, 22 * 60],
    defaultDelaySec: 12 * 60,
    // About 1.8 mSv a day, measured inside Curiosity's cruise stage on the way to Mars (2011-2012).
    radiation: {
      doseMSvPerDay: 1.8,
      quantity: 'dose equivalent',
      note: "measured in cruise by Curiosity's RAD",
      source: { label: 'Zeitlin et al. 2013, Science', url: 'https://doi.org/10.1126/science.1235989' },
    },
  },
  antarctica: {
    key: 'antarctica',
    label: 'Antarctic station',
    place: 'A research station through the polar winter',
    // A satellite link: well under a second each way. What is far away is help: no flights in winter.
    delaysSec: [0.5],
    defaultDelaySec: 0.5,
    radiation: null,
  },
}

/** Career limit for spaceflight radiation, effective dose, mSv. NASA-STD-3001 Vol 1 Rev B [V1 4030]. */
export const CAREER_LIMIT_MSV = 600
export const RADIATION_LIMITS_SOURCE: Source = {
  label: 'NASA OCHMO-TB-020, Design for Ionizing Radiation Protection (Rev E, 2022)',
  url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
}

export interface DoseBudget {
  /** Dose by the morning of this mission day, at the published rate. This mission only; no solar storms. */
  missionMSv: number
  /** That dose as a share of the career limit. */
  careerShare: number
  /** First mission day on which the dose reaches the career limit at this rate. */
  limitDay: number
}

export function doseBudget(r: Radiation, day: number): DoseBudget {
  const missionMSv = r.doseMSvPerDay * day
  return { missionMSv, careerShare: missionMSv / CAREER_LIMIT_MSV, limitDay: Math.ceil(CAREER_LIMIT_MSV / r.doseMSvPerDay) }
}
