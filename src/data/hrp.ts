// NASA's Human System Risks: the risks NASA's Human Research Program works to reduce, titled as on
// https://www.nasa.gov/hhp/human-system-risks/ (read 15 Nov 2026). Each check-in item, cabin factor and
// hazard in the app links to the risk it informs. Shown, never judged: no rule reads this file.

import type { IndicatorKey, SymptomKey } from '../engine/types.ts'

export type HrpRiskKey =
  | 'sleep'
  | 'behavioral'
  | 'team'
  | 'co2'
  | 'sensorimotor'
  | 'sans'
  | 'medical'
  | 'bone'
  | 'muscle'
  | 'aerobic'
  | 'radiation'
  | 'eihso'
  | 'cv'
  | 'hypoxia'

export interface HrpRisk {
  /** A short name for tight spaces. */
  short: string
  /** The title as NASA prints it. */
  title: string
  url: string
}

const PAGE = 'https://www.nasa.gov/directorates/esdmd/hhp'

export const HRP_RISKS: Record<HrpRiskKey, HrpRisk> = {
  sleep: {
    short: 'Sleep loss',
    title: 'Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload',
    url: `${PAGE}/risk-of-performance-decrements-and-adverse-health-outcomes-resulting-from-sleep-loss-circadian-desynchronization-and-work-overload/`,
  },
  behavioral: {
    short: 'Behavioral health',
    title:
      'Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-mission Health and Performance and Long-term Health Effects (Behavioral Health Risk)',
    url: `${PAGE}/behavioral-health-risk/`,
  },
  team: {
    short: 'Team',
    title:
      'Risk of In-Mission Performance and Behavioral Health Decrements Due to Inadequate Cooperation, Coordination, Communication, and Psychosocial Adaptation within a Team (Team Risk)',
    url: `${PAGE}/team-risk/`,
  },
  co2: {
    short: 'CO₂',
    title:
      'Risk of Nominal Acute and Chronic Ambient Carbon Dioxide Exposure in Crewed Vehicles Leading to In-Mission Health Effects or Performance Decrements (CO2 Risk)',
    url: `${PAGE}/carbon-dioxide-risk/`,
  },
  sensorimotor: {
    short: 'Sensorimotor',
    title: 'Risk of Altered Sensorimotor/Vestibular Function Impacting Critical Mission Tasks, Human Health, and Long-Term Health (Sensorimotor Risk)',
    url: `${PAGE}/sensorimotor-risk/`,
  },
  sans: {
    short: 'SANS',
    title: 'Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS Risk)',
    url: `${PAGE}/risk-of-spaceflight-associated-neuro-ocular-syndrome/`,
  },
  medical: {
    short: 'Inflight medical conditions',
    title: 'Risk of Adverse Health Outcomes and Decrements in Performance due to Inflight Medical Conditions',
    url: `${PAGE}/risk-of-adverse-health-outcomes-and-decrements-in-performance-due-to-inflight-medical-conditions/`,
  },
  bone: {
    short: 'Bone fracture',
    title: 'Risk of Bone Fracture due to Spaceflight-induced Changes to Bone',
    url: `${PAGE}/risk-of-bone-fracture-due-to-spaceflight-induced-changes-to-bone/`,
  },
  muscle: {
    short: 'Muscle',
    title: 'Risk of Reduced Physical Performance Capabilities Due to Reduced Muscle Size, Strength, and Endurance (Muscle Risk)',
    url: `${PAGE}/muscle-risk/`,
  },
  aerobic: {
    short: 'Aerobic',
    title: 'Risk of Reduced Physical Performance Capabilities Due to Reduced Aerobic Capacity (Aerobic Risk)',
    url: `${PAGE}/aerobic-risk/`,
  },
  radiation: {
    short: 'Radiation carcinogenesis',
    title: 'Risk of Radiation Carcinogenesis',
    url: `${PAGE}/risk-of-radiation-carcinogenesis/`,
  },
  eihso: {
    short: 'Earth-independent operations',
    title: 'Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations (EIHSO Risk)',
    url: `${PAGE}/eihso-risk/`,
  },
  cv: {
    short: 'Cardiovascular',
    title: 'Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes (CV Risk)',
    url: `${PAGE}/cv-risk/`,
  },
  hypoxia: {
    short: 'Hypoxia',
    title: 'Risk of Reduced Crew Health and Performance Due to Hypoxia',
    url: `${PAGE}/risk-of-reduced-crew-health-and-performance-due-to-hypoxia/`,
  },
}

/** The risk each check-in reading informs, first the main one. */
export const INDICATOR_RISKS: Record<IndicatorKey, HrpRiskKey[]> = {
  sleepHours: ['sleep'],
  sleepQuality: ['sleep'],
  fatigue: ['sleep', 'co2'],
  irritability: ['behavioral', 'team'],
  symptoms: ['co2', 'medical'],
  reaction: ['sleep'],
  stress: ['behavioral'],
  mood: ['behavioral'],
}

export const SYMPTOM_RISKS: Record<SymptomKey, HrpRiskKey[]> = {
  headache: ['co2', 'medical'],
  dizziness: ['sensorimotor'],
  nausea: ['sensorimotor'],
  congestion: ['medical'],
  eye_strain: ['medical'],
}

/** One row of the map on the challenge page: what the app measures, the risk it informs, and NASA's own words. */
export interface HrpRow {
  item: string
  kind: 'Check-in' | 'Cabin, real ISS data' | 'Hazard' | 'Watch, shown only'
  risks: HrpRiskKey[]
  nasa: string
}

export const HRP_MAP: HrpRow[] = [
  {
    item: 'Sleep duration and quality',
    kind: 'Check-in',
    risks: ['sleep'],
    nasa: 'On six-month ISS missions astronauts slept about 6.5 h; nights under 6 h went with slower responses, more stress and higher workload (Jones et al. 2022).',
  },
  {
    item: 'Fatigue',
    kind: 'Check-in',
    risks: ['sleep', 'co2'],
    nasa: 'Sleep loss and circadian disturbances "lead to fatigue and errors" (NASA sleep risk). NASA’s CO₂ brief reports fatigue alongside headaches at higher CO₂.',
  },
  {
    item: 'Alertness: the 30-second reaction test',
    kind: 'Check-in',
    risks: ['sleep'],
    nasa: 'A short version of the PVT-B flown as the ISS Reaction Self-Test, which counts a lapse at 355 ms.',
  },
  {
    item: 'Mood and stress (private)',
    kind: 'Check-in',
    risks: ['behavioral'],
    nasa: '"Exposure to the isolation and confinement of spaceflight can result in decrements in cognitive and behavioral functioning" (NASA behavioral health risk).',
  },
  {
    item: 'Irritability',
    kind: 'Check-in',
    risks: ['behavioral', 'team'],
    nasa: 'The rule links it to cabin CO₂; NASA’s CO₂ symptom list does not name it.',
  },
  {
    item: 'Headache',
    kind: 'Check-in',
    risks: ['co2', 'medical'],
    nasa: '19 of 49 ISS astronauts reported headaches, and the odds doubled for each 1 mmHg of CO₂. Fluid shift in microgravity causes similar headaches (NASA OCHMO-TB-004).',
  },
  {
    item: 'Congestion, dry or sore eyes',
    kind: 'Check-in',
    risks: ['medical'],
    nasa: 'Outside its humidity range, NASA’s cabin standard expects "dry, stuffy and/or irritated mucous membranes" (NASA-STD-3001 [V2 6012]).',
  },
  {
    item: 'Dizziness, nausea',
    kind: 'Check-in',
    risks: ['sensorimotor'],
    nasa: 'Not linked to the cabin by the rule: they open a private card only.',
  },
  {
    item: 'Exercise the day before',
    kind: 'Check-in',
    risks: ['bone', 'muscle', 'aerobic'],
    nasa: 'Weight-bearing bones lose 1 to 1.5% of mineral density a month in spaceflight; ISS crews exercise about two hours a day (NASA).',
  },
  {
    item: 'Cabin CO₂',
    kind: 'Cabin, real ISS data',
    risks: ['co2'],
    nasa: 'NASA-STD-3001 [V2 6004]: 1-hour average no more than 3 mmHg, "to keep incidence of headaches below 1.4%" (NASA OCHMO-TB-004).',
  },
  {
    item: 'Cabin temperature',
    kind: 'Cabin, real ISS data',
    risks: ['sleep'],
    nasa: 'Temperature is among the "environmental factors" that "inhibit sleep and impact well-being in space" (NASA sleep risk). Comfort range 20–25 °C ([V2 6013]); health limits 18–27 °C ([V2 6012]).',
  },
  {
    item: 'Cabin humidity',
    kind: 'Cabin, real ISS data',
    risks: ['medical'],
    nasa: 'Comfort range 30–60% ([V2 6013]); health limits 25–75% ([V2 6012]). No risk of its own on NASA’s list.',
  },
  {
    item: 'Radiation dose (estimate)',
    kind: 'Hazard',
    risks: ['radiation'],
    nasa: 'Career effective dose under 600 mSv (NASA-STD-3001 Vol 1 [V1 4030]).',
  },
  {
    item: 'Distance from Earth: the message delay',
    kind: 'Hazard',
    risks: ['eihso'],
    nasa: '"As the distance from Earth increases, crew will need to be more independent" (NASA EIHSO risk).',
  },
  {
    item: 'Heart rate, HRV',
    kind: 'Watch, shown only',
    risks: ['cv'],
    nasa: 'Wearable readings; no rule uses them.',
  },
  {
    item: 'Blood oxygen',
    kind: 'Watch, shown only',
    risks: ['hypoxia'],
    nasa: 'Wearable readings; no rule uses them.',
  },
]
