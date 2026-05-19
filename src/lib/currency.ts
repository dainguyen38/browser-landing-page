// Currency exchange — uses fawazahmed0/currency-api (free, no API key, 200+ currencies,
// updated daily). CDNs: jsdelivr (npm) primary, cloudflare pages fallback.
// Source: https://github.com/fawazahmed0/exchange-api

const PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'
const FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies'

export interface Rates {
  base: string
  date: string
  rates: Record<string, number>
}

interface CacheEntry {
  base: string
  date: string
  rates: Record<string, number>
  cachedAt: string
}

const CACHE_PREFIX = 'landing.fx.v1:'

function cacheKey(base: string) {
  return `${CACHE_PREFIX}${base.toLowerCase()}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function readCache(base: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(base))
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function writeCache(entry: CacheEntry) {
  try {
    localStorage.setItem(cacheKey(entry.base), JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

export async function fetchRates(base: string, force = false): Promise<Rates> {
  const lower = base.toLowerCase()
  if (!force) {
    const cached = readCache(lower)
    if (cached && cached.date === todayISO()) {
      return { base: lower, date: cached.date, rates: cached.rates }
    }
  }
  let lastErr: unknown
  for (const root of [PRIMARY, FALLBACK]) {
    try {
      const res = await fetch(`${root}/${lower}.json`)
      if (!res.ok) {
        lastErr = new Error(`fx: ${res.status}`)
        continue
      }
      const json = (await res.json()) as { date: string } & Record<string, Record<string, number> | string>
      const rates = json[lower] as Record<string, number>
      if (!rates) throw new Error('fx: invalid response shape')
      const entry: CacheEntry = {
        base: lower,
        date: json.date,
        rates,
        cachedAt: new Date().toISOString(),
      }
      writeCache(entry)
      return { base: lower, date: json.date, rates }
    } catch (e) {
      lastErr = e
    }
  }
  // network failed — fall back to stale cache if any
  const stale = readCache(lower)
  if (stale) return { base: lower, date: stale.date, rates: stale.rates }
  throw lastErr instanceof Error ? lastErr : new Error('All currency APIs failed')
}

export async function convert(
  amount: number,
  from: string,
  to: string,
): Promise<{ value: number; rate: number; date: string }> {
  if (from === to) {
    return { value: amount, rate: 1, date: todayISO() }
  }
  const { rates, date } = await fetchRates(from)
  const rate = rates[to.toLowerCase()]
  if (rate === undefined) throw new Error(`Unknown target currency: ${to}`)
  return { value: amount * rate, rate, date }
}

// === Curated currency list ===

export interface CurrencyInfo {
  code: string
  name: string
  flag: string
  symbol: string
  noFraction?: boolean
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'usd', name: 'US Dollar', flag: '🇺🇸', symbol: '$' },
  { code: 'eur', name: 'Euro', flag: '🇪🇺', symbol: '€' },
  { code: 'gbp', name: 'British Pound', flag: '🇬🇧', symbol: '£' },
  { code: 'jpy', name: 'Japanese Yen', flag: '🇯🇵', symbol: '¥', noFraction: true },
  { code: 'vnd', name: 'Vietnamese Đồng', flag: '🇻🇳', symbol: '₫', noFraction: true },
  { code: 'cny', name: 'Chinese Yuan', flag: '🇨🇳', symbol: '¥' },
  { code: 'krw', name: 'Korean Won', flag: '🇰🇷', symbol: '₩', noFraction: true },
  { code: 'sgd', name: 'Singapore Dollar', flag: '🇸🇬', symbol: 'S$' },
  { code: 'thb', name: 'Thai Baht', flag: '🇹🇭', symbol: '฿' },
  { code: 'aud', name: 'Australian Dollar', flag: '🇦🇺', symbol: 'A$' },
  { code: 'cad', name: 'Canadian Dollar', flag: '🇨🇦', symbol: 'C$' },
  { code: 'chf', name: 'Swiss Franc', flag: '🇨🇭', symbol: 'CHF' },
  { code: 'hkd', name: 'Hong Kong Dollar', flag: '🇭🇰', symbol: 'HK$' },
  { code: 'inr', name: 'Indian Rupee', flag: '🇮🇳', symbol: '₹' },
  { code: 'idr', name: 'Indonesian Rupiah', flag: '🇮🇩', symbol: 'Rp', noFraction: true },
  { code: 'myr', name: 'Malaysian Ringgit', flag: '🇲🇾', symbol: 'RM' },
  { code: 'php', name: 'Philippine Peso', flag: '🇵🇭', symbol: '₱' },
  { code: 'twd', name: 'Taiwan Dollar', flag: '🇹🇼', symbol: 'NT$' },
  { code: 'rub', name: 'Russian Ruble', flag: '🇷🇺', symbol: '₽' },
  { code: 'btc', name: 'Bitcoin', flag: '₿', symbol: '₿' },
  { code: 'eth', name: 'Ethereum', flag: 'Ξ', symbol: 'Ξ' },
]

export function getCurrency(code: string): CurrencyInfo {
  return (
    CURRENCIES.find((c) => c.code === code.toLowerCase()) ?? {
      code: code.toLowerCase(),
      name: code.toUpperCase(),
      flag: '',
      symbol: code.toUpperCase(),
    }
  )
}

export function formatCurrency(value: number, code: string): string {
  const info = getCurrency(code)
  const isCrypto = ['btc', 'eth'].includes(info.code)
  const fractionDigits = isCrypto
    ? Math.abs(value) < 1
      ? 6
      : 4
    : info.noFraction
    ? 0
    : 2
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  if (info.code === 'vnd') return `${formatted} ${info.symbol}`
  return `${info.symbol}${formatted}`
}
