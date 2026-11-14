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
    expect(line).toContain(`${Math.round((base.shipOrMeAccuracy as number) * 100)}% of alerts`)
    expect(line).toContain(`once every ${Math.round(1 / base.falseAlarms.shipPerCrewDay)} crew-days`)
  })
  it('says nothing without a backtest file', () => {
    expect(evidenceLine(null)).toBeNull()
  })
})
