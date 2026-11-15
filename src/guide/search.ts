// Search over the Guide: BM25 ranking, a hand-written synonym list and prefix matching, the way early
// web search engines worked. No model (docs/adr/0001-guide-search-without-a-model.md): every result is an
// entry a person wrote, and the same query always gives the same order.

import { ENTRIES, listed, PARTS, shown, type GuideEntry } from './entries.ts'

/** BM25's usual constants: how fast repeats stop counting, and how much long entries are discounted. */
const K1 = 1.2
const B = 0.75
/** A title word counts three times, a search word twice, a sentence word once. */
const WEIGHT = { title: 3, words: 2, text: 1 }
/** A word that only starts with what was typed, or a synonym, counts for less than the word itself. */
const PREFIX = 0.7
const SYNONYM = 0.8
const MIN_PREFIX = 3
/** Risk entries are short, so they would outrank the reading they belong to; crew look up readings first. */
const RISK_ENTRY = 0.6

const STOP = new Set(
  'a an and are am as at be been but by do does feel feeling felt for from get got has have i im ive in is it its me my of on or so the to too very was what when why with you your'.split(' '),
)

/** Everyday words and the words the Guide uses for them. Keys and values are already normalised. */
const SYNONYMS: Record<string, string[]> = {
  hurt: ['pain', 'headache'],
  ache: ['pain', 'headache'],
  sore: ['pain', 'eye'],
  sleepless: ['sleep', 'insomnia'],
  awake: ['sleep', 'insomnia'],
  breath: ['breathing', 'oxygen'],
  breathe: ['breathing', 'oxygen'],
  puke: ['vomit', 'nausea'],
  throw: ['vomit', 'nausea'],
  queasy: ['nausea'],
  vertigo: ['dizzy'],
  unhappy: ['mood', 'sad'],
  sad: ['mood'],
  nervous: ['anxious', 'stress'],
  panic: ['anxious', 'stress'],
  exhaustion: ['fatigue'],
  weak: ['fatigue', 'strength'],
  blur: ['blurry', 'vision'],
  temp: ['temperature'],
  humid: ['humidity'],
  carbon: ['co2'],
  storm: ['solar', 'radiation'],
  flare: ['solar', 'radiation'],
  heartbeat: ['heart', 'pulse'],
  gym: ['exercise'],
  run: ['exercise', 'treadmill'],
  lift: ['resistance', 'exercise'],
}

/** Lower case, CO₂ as co2, no apostrophes, words only, a plural "s" dropped. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/₂/g, '2')
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
}

interface Doc {
  entry: GuideEntry
  /** Weighted count of each word in the entry. */
  tf: Map<string, number>
  length: number
}

function docOf(entry: GuideEntry): Doc {
  const tf = new Map<string, number>()
  const add = (text: string, w: number) => {
    for (const t of tokens(text)) tf.set(t, (tf.get(t) ?? 0) + w)
  }
  add(entry.title, WEIGHT.title)
  for (const w of entry.words) add(w, WEIGHT.words)
  for (const p of PARTS) for (const line of entry.parts[p.key] ?? []) if (shown(line)) add(line.text, WEIGHT.text)
  return { entry, tf, length: [...tf.values()].reduce((a, b) => a + b, 0) }
}

const DOCS = ENTRIES.filter(listed).map(docOf)
const AVG_LENGTH = DOCS.reduce((a, d) => a + d.length, 0) / DOCS.length
const VOCAB = [...new Set(DOCS.flatMap((d) => [...d.tf.keys()]))]

/** Inverse document frequency: a word in few entries says more than one in many. */
const IDF = new Map(
  VOCAB.map((t) => {
    const n = DOCS.filter((d) => d.tf.has(t)).length
    return [t, Math.log(1 + (DOCS.length - n + 0.5) / (n + 0.5))]
  }),
)

function bm25(doc: Doc, term: string): number {
  const f = doc.tf.get(term)
  if (!f) return 0
  return IDF.get(term)! * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / AVG_LENGTH)))
}

/** The Guide's words a typed word stands for, each with how much it counts. */
function expand(q: string): Map<string, number> {
  const out = new Map<string, number>([[q, 1]])
  for (const s of SYNONYMS[q] ?? []) if (!out.has(s)) out.set(s, SYNONYM)
  if (q.length >= MIN_PREFIX) for (const t of VOCAB) if (t !== q && t.startsWith(q) && !out.has(t)) out.set(t, PREFIX)
  return out
}

/** Entries matching the query, best first. Each typed word counts once per entry, by its best match. */
export function searchGuide(query: string): GuideEntry[] {
  const words = tokens(query).map(expand)
  if (words.length === 0) return []
  return DOCS.map((doc) => ({
    entry: doc.entry,
    score:
      (doc.entry.section === 'risks' ? RISK_ENTRY : 1) *
      words.reduce((sum, terms) => sum + Math.max(0, ...[...terms].map(([t, w]) => w * bm25(doc, t))), 0),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry)
}
