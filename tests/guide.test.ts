import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENTRIES, ENTRY_FOR, listed, SOURCES, summary, visibleParts } from '../src/guide/entries.ts'
import { INDICATOR_KEYS, SYMPTOMS } from '../src/engine/deviation.ts'
import { searchGuide } from '../src/guide/search.ts'

const citations = readFileSync(new URL('../docs/CITATIONS.md', import.meta.url), 'utf-8')
const rows = citations.split('\n').filter((l) => l.startsWith('|'))

/** The last cell of a CITATIONS.md table row: whether a person opened the source. */
function checkedCell(row: string): string {
  const cells = row.split('|').map((c) => c.trim())
  return cells[cells.length - 2]
}

describe('Guide content', () => {
  it('every source points at exactly one row of CITATIONS.md', () => {
    for (const [key, src] of Object.entries(SOURCES)) {
      const found = rows.filter((r) => r.includes(src.row))
      expect(found.length, `${key}: "${src.row}"`).toBe(1)
    }
  })

  it('a sentence shows only when CITATIONS.md says a person opened its source', () => {
    for (const [key, src] of Object.entries(SOURCES)) {
      const row = rows.find((r) => r.includes(src.row))!
      expect(checkedCell(row).startsWith('Yes'), `${key} is checked: ${src.checked}, row says "${checkedCell(row)}"`).toBe(src.checked)
    }
  })

  it('every entry says what it is, and every reading says what the app does with it', () => {
    for (const e of ENTRIES) {
      expect(summary(e), e.id).not.toBe('')
      const parts = visibleParts(e).map((p) => p.key)
      if (e.section !== 'risks' && e.id !== 'vision') expect(parts, e.id).toContain('app')
    }
  })

  it('every check-in item has an entry to open from its "?"', () => {
    const ids = new Set(ENTRIES.map((e) => e.id))
    for (const k of [...INDICATOR_KEYS, ...SYMPTOMS.map((s) => s.key)]) expect(ids.has(ENTRY_FOR[k]), k).toBe(true)
  })

  it('a reading with nothing to say beyond its first line is left out until its sources are checked', () => {
    const vision = ENTRIES.find((e) => e.id === 'vision')!
    expect(visibleParts(vision).length).toBe(1)
    expect(listed(vision)).toBe(false)
    expect(listed(ENTRIES.find((e) => e.id === 'co2')!)).toBe(true)
    expect(ENTRIES.filter((e) => e.section === 'risks').every(listed)).toBe(true)
  })

  it('entry ids are unique', () => {
    const ids = ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Guide search', () => {
  const ids = (q: string) => searchGuide(q).map((e) => e.id)

  it('a symptom finds its own entry first, then what can cause it', () => {
    const found = ids('headache')
    expect(found[0]).toBe('headache')
    expect(found).toContain('co2')
  })

  it('everyday words find the entry through the synonym list', () => {
    expect(ids('head hurts')[0]).toBe('headache')
    expect(ids("can't sleep")[0]).toBe('sleep')
    expect(ids('breathless')[0]).toBe('spo2')
    expect(ids('feeling down')[0]).toBe('mood')
  })

  it('finds an entry while the word is still being typed', () => {
    expect(ids('head')[0]).toBe('headache')
    expect(ids('radi')[0]).toBe('radiation')
  })

  it('an empty query or an unknown word finds nothing', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
    expect(ids('xylophone')).toEqual([])
  })
})
