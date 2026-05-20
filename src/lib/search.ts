// Search engines + autocomplete suggestions.
// Suggest endpoints don't allow direct browser CORS, so we route through a free
// CORS proxy (corsproxy.io). If the proxy or the engine is unreachable we just
// don't show suggestions — the input still works as a normal address bar.

export interface SearchEngine {
  id: SearchEngineId
  name: string
  domain: string
  /** browser-style label (e.g. "Edge → Bing") */
  alias?: string
  /** brand color used for the small pill icon */
  color: string
  /** white-on-color initial */
  letter: string
  searchUrl: (q: string) => string
  /** optional suggest endpoint factory */
  suggestUrl?: (q: string) => string
  /** parse the proxy-fetched JSON into suggestion strings */
  parseSuggestions?: (data: unknown) => string[]
}

export type SearchEngineId =
  | 'google'
  | 'bing'
  | 'duckduckgo'
  | 'brave'
  | 'yahoo'
  | 'ecosia'
  | 'startpage'
  | 'yandex'

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export const ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    domain: 'google.com',
    color: '#4285f4',
    letter: 'G',
    searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    suggestUrl: (q) =>
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
    parseSuggestions: (data) => {
      // ["query", ["s1", "s2", ...]]
      const arr = asArray(data)
      const list = asArray(arr[1])
      return list.filter((x): x is string => typeof x === 'string')
    },
  },
  {
    id: 'bing',
    name: 'Bing',
    alias: 'Edge → Bing',
    domain: 'bing.com',
    color: '#0078d4',
    letter: 'B',
    searchUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    // Bing has an OpenSearch JSON suggestion endpoint that we can hit via proxy.
    suggestUrl: (q) =>
      `https://www.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    parseSuggestions: (data) => {
      const arr = asArray(data)
      const list = asArray(arr[1])
      return list.filter((x): x is string => typeof x === 'string')
    },
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    alias: 'Firefox → DDG',
    domain: 'duckduckgo.com',
    color: '#de5833',
    letter: 'D',
    searchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    suggestUrl: (q) =>
      `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    parseSuggestions: (data) => {
      // either ["query", ["s1", "s2"]] or [{phrase: "..."}]
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArray((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return asArray(data)
        .map((it) => {
          if (typeof it === 'string') return it
          if (it && typeof it === 'object' && 'phrase' in it) return String((it as { phrase: string }).phrase)
          return null
        })
        .filter((x): x is string => !!x)
    },
  },
  {
    id: 'brave',
    name: 'Brave Search',
    domain: 'search.brave.com',
    color: '#fb542b',
    letter: 'B',
    searchUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    suggestUrl: (q) =>
      `https://search.brave.com/api/suggest?q=${encodeURIComponent(q)}&source=web`,
    parseSuggestions: (data) => {
      // Returns [{ query, suggestions: ["s1", "s2"] }] OR ["query", ["s1", "s2"]]
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArray((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return []
    },
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    domain: 'yahoo.com',
    color: '#6001d2',
    letter: 'Y',
    searchUrl: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    domain: 'ecosia.org',
    color: '#3aab59',
    letter: 'E',
    searchUrl: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
    suggestUrl: (q) =>
      `https://ac.ecosia.org/autocomplete?q=${encodeURIComponent(q)}&type=list`,
    parseSuggestions: (data) => {
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArray((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return []
    },
  },
  {
    id: 'startpage',
    name: 'Startpage',
    domain: 'startpage.com',
    color: '#5d3eb1',
    letter: 'S',
    searchUrl: (q) => `https://www.startpage.com/do/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: 'yandex',
    name: 'Yandex',
    domain: 'yandex.com',
    color: '#ffcc00',
    letter: 'Y',
    searchUrl: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    suggestUrl: (q) =>
      `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(q)}`,
    parseSuggestions: (data) => {
      const arr = asArray(data)
      const list = asArray(arr[1])
      return list.filter((x): x is string => typeof x === 'string')
    },
  },
]

export const DEFAULT_ENGINE: SearchEngineId = 'google'

export function getEngine(id: string | undefined): SearchEngine {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0]
}

// Suggestions are fetched via our same-origin /api/suggest endpoint, which is
// served by a Cloudflare Worker in production and by a Vite middleware in dev.
// The server bypasses the upstream-CORS problem (and 3rd-party proxies that
// went flaky after deploy).

export async function fetchSuggestions(
  engineId: SearchEngineId,
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await fetch(
      `/api/suggest?engine=${encodeURIComponent(engineId)}&q=${encodeURIComponent(q)}`,
      { signal },
    )
    if (!res.ok) return []
    const data = (await res.json()) as unknown
    return Array.isArray(data)
      ? data.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : []
  } catch {
    return []
  }
}

// === URL vs query detection ===

export function looksLikeUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (/^https?:\/\//i.test(t)) return true
  if (/^localhost(:\d+)?(\/.*)?$/i.test(t)) return true
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(t)) return true
  return false
}

export function normalizeUrl(s: string): string {
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}
