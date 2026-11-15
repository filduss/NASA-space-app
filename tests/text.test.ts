import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BacktestFile } from '../src/data/types.ts'
import { evidenceLine } from '../src/ui/text.ts'

const backtest = JSON.parse(readFileSync('public/data/backtest.json', 'utf8')) as BacktestFile

describe('evidence on the Ship screen', () => {
  it('quotes the base case of the committed backtest, so the screen and the data never disagree', () => {
    const base = backtest.scenarios[0]
    const line = evidenceLine(backtest) as string
    expect(base.name).toBe('Base case')
    expect(line).toContain(`${backtest.meta.crews} simulated crews`)
    // The accuracy is split by the kind of day, never only the pooled figure.
    const split = base.accuracyByClass!
    expect(line).toContain(`"the ship" in ${Math.round((split.shipDays.accuracy as number) * 100)}% of alerts on days with a CO₂ rise`)
    expect(line).toContain(`"not the ship" in ${Math.round((split.personalDays.accuracy as number) * 100)}%`)
    expect(line).toContain(`once every ${Math.round(1 / base.falseAlarms.shipPerCrewDay)} crew-days`)
  })
  it('falls back to the pooled accuracy for a backtest file without the split', () => {
    const older = { ...backtest, scenarios: [{ ...backtest.scenarios[0], accuracyByClass: undefined }] }
    expect(evidenceLine(older)).toContain(`${Math.round((backtest.scenarios[0].shipOrMeAccuracy as number) * 100)}% of alerts`)
  })
  it('says nothing without a backtest file', () => {
    expect(evidenceLine(null)).toBeNull()
  })
})
