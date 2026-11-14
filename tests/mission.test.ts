import { describe, expect, it } from 'vitest'
import { CAREER_LIMIT_MSV, MISSIONS, doseBudget, type MissionKey, type Radiation } from '../src/engine/mission.ts'
import { delayText, mSv, percent } from '../src/ui/text.ts'

const settings = Object.values(MISSIONS)
const rad = (k: MissionKey) => MISSIONS[k].radiation as Radiation

describe('mission settings', () => {
  it('every space setting cites the source of its dose rate', () => {
    for (const k of ['iss', 'moon', 'mars'] as const) {
      expect(rad(k).doseMSvPerDay).toBeGreaterThan(0)
      expect(rad(k).source.url).toMatch(/^https:\/\//)
      expect(rad(k).source.label.length).toBeGreaterThan(0)
    }
  })
  it('on Earth there is no space-radiation budget', () => {
    expect(MISSIONS.antarctica.radiation).toBeNull()
  })
  it('the default delay is one of the choices offered', () => {
    for (const m of settings) expect(m.delaysSec).toContain(m.defaultDelaySec)
  })
  it('Earth is further away from Mars than from the Moon, and from the Moon than from the ISS', () => {
    expect(MISSIONS.iss.defaultDelaySec).toBeLessThan(MISSIONS.moon.defaultDelaySec)
    expect(Math.min(...MISSIONS.mars.delaysSec)).toBeGreaterThan(MISSIONS.moon.defaultDelaySec)
  })
})

describe('dose budget', () => {
  it('builds up at the published rate per mission day', () => {
    const b = doseBudget(rad('mars'), 212)
    expect(b.missionMSv).toBeCloseTo(1.8 * 212)
    expect(b.careerShare).toBeCloseTo((1.8 * 212) / CAREER_LIMIT_MSV)
  })
  it('names the first mission day on which the career limit is reached', () => {
    for (const k of ['iss', 'moon', 'mars'] as const) {
      const { limitDay } = doseBudget(rad(k), 1)
      expect(rad(k).doseMSvPerDay * limitDay).toBeGreaterThanOrEqual(CAREER_LIMIT_MSV)
      expect(rad(k).doseMSvPerDay * (limitDay - 1)).toBeLessThan(CAREER_LIMIT_MSV)
    }
  })
  it('a Mars transit uses up the career limit years before the ISS does', () => {
    expect(doseBudget(rad('mars'), 1).limitDay).toBe(334)
    expect(doseBudget(rad('moon'), 1).limitDay).toBe(438)
    expect(doseBudget(rad('iss'), 1).limitDay).toBe(1200)
  })
})

describe('wording', () => {
  it('delays read as words', () => {
    expect(delayText(MISSIONS.iss.defaultDelaySec)).toBe('less than a second')
    expect(delayText(MISSIONS.moon.defaultDelaySec)).toBe('1.3 seconds')
    expect(delayText(MISSIONS.mars.defaultDelaySec)).toBe('12 minutes')
    expect(delayText(60)).toBe('1 minute')
  })
  it('doses and shares read as rounded numbers', () => {
    expect(mSv(381.6)).toBe('382 mSv')
    expect(mSv(1.84)).toBe('1.8 mSv')
    expect(percent(0.636)).toBe('64%')
  })
})
