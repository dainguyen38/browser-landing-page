// Dictionary + translation helpers. All endpoints support CORS directly so no
// proxy is needed.
//   • Datamuse:  topic word lists  (no key)
//   • Free Dictionary API: per-word phonetics/definitions/audio (no key)
//   • MyMemory: translations EN→target (no key, daily quota)

const DATAMUSE = 'https://api.datamuse.com/words'
const DICT = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const MYMEMORY = 'https://api.mymemory.translated.net/get'

export interface TopicWord {
  word: string
  score: number
}

export async function fetchTopicWords(topic: string, max = 100): Promise<TopicWord[]> {
  const q = topic.trim().toLowerCase()
  if (!q) return []
  // Datamuse's `topics=` parameter went unreliable for multi-word queries, so
  // we use `rel_trg=` (statistically-triggered words) on each seed and merge.
  const seeds = q.split(/[\s,]+/).filter(Boolean).slice(0, 5)
  if (seeds.length === 0) return []

  const perSeed = Math.max(20, Math.ceil(max / seeds.length) + 10)
  const merged = new Map<string, number>()

  const queries = seeds.flatMap((seed) => [
    new URLSearchParams({ rel_trg: seed, max: String(perSeed), md: 'p' }),
    new URLSearchParams({ ml: seed, max: String(perSeed), md: 'p' }),
  ])

  await Promise.all(
    queries.map(async (params) => {
      try {
        const res = await fetch(`${DATAMUSE}?${params.toString()}`)
        if (!res.ok) return
        const data = (await res.json()) as Array<{
          word: string
          score?: number
          tags?: string[]
        }>
        for (const d of data) {
          if (!/^[a-z][a-z'-]*( [a-z'-]+)?$/i.test(d.word)) continue
          if (d.word.length < 3) continue
          const prev = merged.get(d.word) ?? 0
          merged.set(d.word, Math.max(prev, d.score ?? 1))
        }
      } catch {
        /* ignore individual failures */
      }
    }),
  )

  return Array.from(merged.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word, score]) => ({ word, score }))
}

export interface DictPhonetic {
  text?: string
  audio?: string
}
export interface DictMeaning {
  partOfSpeech: string
  definitions: { definition: string; example?: string; synonyms?: string[]; antonyms?: string[] }[]
  synonyms?: string[]
  antonyms?: string[]
}
export interface DictEntry {
  word: string
  phonetic?: string
  phonetics: DictPhonetic[]
  meanings: DictMeaning[]
  audio?: string
}

export async function fetchDictionary(word: string): Promise<DictEntry | null> {
  try {
    const res = await fetch(`${DICT}/${encodeURIComponent(word)}`)
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      word: string
      phonetic?: string
      phonetics?: DictPhonetic[]
      meanings?: DictMeaning[]
    }>
    if (!Array.isArray(data) || data.length === 0) return null
    // Merge multiple entries
    const merged: DictEntry = {
      word: data[0].word,
      phonetic: data.find((d) => d.phonetic)?.phonetic,
      phonetics: data.flatMap((d) => d.phonetics ?? []).filter((p) => p.text || p.audio),
      meanings: data.flatMap((d) => d.meanings ?? []),
    }
    merged.audio = merged.phonetics.find((p) => p.audio)?.audio?.replace(/^http:\/\//, 'https://')
    return merged
  } catch {
    return null
  }
}

export interface TranslationResult {
  text: string
  detected?: string
}

export async function translate(
  text: string,
  target: string,
  source = 'en',
): Promise<TranslationResult | null> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${source}|${target}`,
  })
  try {
    const res = await fetch(`${MYMEMORY}?${params.toString()}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      responseData?: { translatedText?: string }
      responseStatus?: number
    }
    const t = data?.responseData?.translatedText
    if (!t) return null
    return { text: t }
  } catch {
    return null
  }
}

// === Misc ===

export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  const groups = w.match(/[aeiouy]+/g) ?? []
  let count = groups.length
  if (w.endsWith('e')) count = Math.max(1, count - 1)
  return Math.max(1, count)
}

export function cefrLevel(word: string): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' {
  const s = estimateSyllables(word)
  const len = word.length
  const score = s * 1.5 + len * 0.3
  if (score < 3) return 'A1'
  if (score < 4.5) return 'A2'
  if (score < 6) return 'B1'
  if (score < 8) return 'B2'
  return 'C1'
}

// SpeechSynthesis fallback
export function speak(text: string, lang = 'en-US') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.9
  u.pitch = 1
  window.speechSynthesis.speak(u)
}
