// Suggestion endpoint config — shared between the Cloudflare Worker (prod) and
// the Vite dev-server middleware (dev). The client only sends an engine id +
// query; this module knows the upstream URL and how to parse each response.

interface EngineCfg {
  url: (q: string) => string
  parse: (data: unknown) => string[]
}

const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const ENGINES: Record<string, EngineCfg> = {
  google: {
    url: (q) =>
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
    parse: (data) => {
      // ["query", ["s1", "s2", ...]]
      const arr = asArr(data)
      return asArr(arr[1]).filter((x): x is string => typeof x === 'string')
    },
  },
  bing: {
    url: (q) => `https://www.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    parse: (data) => {
      const arr = asArr(data)
      return asArr(arr[1]).filter((x): x is string => typeof x === 'string')
    },
  },
  duckduckgo: {
    url: (q) => `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    parse: (data) => {
      // Either ["query", ["s1", ...]] or [{phrase: "..."}]
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArr((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return asArr(data)
        .map((it) => {
          if (typeof it === 'string') return it
          if (it && typeof it === 'object' && 'phrase' in it) {
            return String((it as { phrase: string }).phrase)
          }
          return null
        })
        .filter((x): x is string => !!x)
    },
  },
  brave: {
    url: (q) =>
      `https://search.brave.com/api/suggest?q=${encodeURIComponent(q)}&source=web`,
    parse: (data) => {
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArr((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return []
    },
  },
  ecosia: {
    url: (q) =>
      `https://ac.ecosia.org/autocomplete?q=${encodeURIComponent(q)}&type=list`,
    parse: (data) => {
      if (Array.isArray(data) && Array.isArray((data as unknown[])[1])) {
        return asArr((data as unknown[])[1]).filter((x): x is string => typeof x === 'string')
      }
      return []
    },
  },
  yandex: {
    url: (q) =>
      `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(q)}`,
    parse: (data) => {
      const arr = asArr(data)
      return asArr(arr[1]).filter((x): x is string => typeof x === 'string')
    },
  },
}

export async function fetchSuggestions(engine: string, q: string): Promise<string[]> {
  const cfg = ENGINES[engine]
  if (!cfg || !q.trim()) return []
  try {
    const res = await fetch(cfg.url(q), {
      headers: {
        Accept: 'application/json, text/javascript, */*;q=0.5',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      },
    })
    if (!res.ok) return []
    const ct = res.headers.get('content-type') ?? ''
    let data: unknown
    if (ct.includes('json')) {
      data = await res.json()
    } else {
      // Some engines return JS or wrap JSON — try to parse text as JSON
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        return []
      }
    }
    return cfg.parse(data).slice(0, 8)
  } catch {
    return []
  }
}
