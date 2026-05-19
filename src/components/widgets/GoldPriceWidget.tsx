import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { CURRENCIES, fetchRates, formatCurrency, getCurrency } from '@/lib/currency'

const STORAGE_KEY = 'landing.gold.v1'

// gold-api.com — free, no API key, CORS-friendly
// Endpoints: /price/XAU (gold), /price/XAG (silver), /price/XPT (platinum), /price/XPD (palladium)
const METALS = [
  { code: 'XAU', emoji: '🥇' },
  { code: 'XAG', emoji: '🥈' },
  { code: 'XPT', emoji: '⚪' },
  { code: 'XPD', emoji: '⚫' },
] as const

type MetalCode = (typeof METALS)[number]['code']
type Unit = 'oz' | 'gram' | 'kg' | 'tael' // 1 oz = 31.1035g, 1 lượng (tael VN) = 37.5g
const UNIT_FACTOR: Record<Unit, number> = {
  oz: 1,
  gram: 1 / 31.1034768,
  kg: 1000 / 31.1034768,
  tael: 37.5 / 31.1034768,
}

interface ApiResponse {
  name: string
  price: number
  symbol: string
  updatedAt?: string
  updatedAtReadable?: string
  prev_close_price?: number
}

interface CacheEntry {
  symbol: MetalCode
  data: ApiResponse
  fetchedAt: string
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function saveCache(entry: CacheEntry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // ignore
  }
}

export function GoldPriceWidget() {
  const { t, locale, dateLocale } = useT()
  const [metal, setMetal] = useState<MetalCode>('XAU')
  const [unit, setUnit] = useState<Unit>('oz')
  const [currency, setCurrency] = useState<string>('usd')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fxRate, setFxRate] = useState(1)

  // Load cache on mount or metal change
  useEffect(() => {
    const cached = loadCache()
    if (cached && cached.symbol === metal) {
      setData(cached.data)
      setFetchedAt(cached.fetchedAt)
    } else {
      setData(null)
      setFetchedAt(null)
    }
  }, [metal])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`https://api.gold-api.com/price/${metal}`)
      if (!res.ok) throw new Error(`gold-api: ${res.status}`)
      const json = (await res.json()) as ApiResponse
      const now = new Date().toISOString()
      setData(json)
      setFetchedAt(now)
      saveCache({ symbol: metal, data: json, fetchedAt: now })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [metal])

  // Auto-fetch on metal change + every 15 min while mounted
  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 15 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [refresh])

  // FX rate: USD → selected currency
  useEffect(() => {
    let cancelled = false
    if (currency === 'usd') {
      setFxRate(1)
      return
    }
    fetchRates('usd')
      .then((r) => {
        if (cancelled) return
        const rate = r.rates[currency]
        if (typeof rate === 'number') setFxRate(rate)
      })
      .catch(() => {
        if (!cancelled) setFxRate(1)
      })
    return () => {
      cancelled = true
    }
  }, [currency])

  const priceConverted = useMemo(() => {
    if (!data) return null
    return data.price * UNIT_FACTOR[unit] * fxRate
  }, [data, unit, fxRate])

  const change = useMemo(() => {
    if (!data || data.prev_close_price === undefined) return null
    const diff = data.price - data.prev_close_price
    const pct = (diff / data.prev_close_price) * 100
    return { diff: diff * UNIT_FACTOR[unit] * fxRate, pct }
  }, [data, unit, fxRate])

  const currencyInfo = getCurrency(currency)

  const isStale = !!error && !!data

  const metalLabel = useMemo(() => {
    const map: Record<MetalCode, string> = {
      XAU: t('gold.metalGold'),
      XAG: t('gold.metalSilver'),
      XPT: t('gold.metalPlatinum'),
      XPD: t('gold.metalPalladium'),
    }
    return map[metal]
  }, [metal, t])

  const fetchedAtLabel = useMemo(() => {
    if (!fetchedAt) return null
    try {
      const d = new Date(fetchedAt)
      return d.toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedAt, locale, dateLocale])

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Coins className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('gold.title')}
          </h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          aria-label={t('gold.refresh')}
          className="h-7 w-7"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 shrink-0">
        <Select value={metal} onValueChange={(v) => setMetal(v as MetalCode)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METALS.map((m) => (
              <SelectItem key={m.code} value={m.code}>
                <span className="mr-1.5">{m.emoji}</span>
                {t(`gold.metal${m.code === 'XAU' ? 'Gold' : m.code === 'XAG' ? 'Silver' : m.code === 'XPT' ? 'Platinum' : 'Palladium'}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oz">{t('gold.unitOz')}</SelectItem>
            <SelectItem value="gram">{t('gold.unitGram')}</SelectItem>
            <SelectItem value="kg">{t('gold.unitKg')}</SelectItem>
            <SelectItem value="tael">{t('gold.unitTael')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.filter((c) => !['btc', 'eth'].includes(c.code)).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="mr-1.5">{c.flag}</span>
                {c.code.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center items-start">
        {priceConverted === null ? (
          loading ? (
            <div className="text-sm text-white/70">{t('gold.loading')}</div>
          ) : (
            <div className="text-sm text-rose-300">{error ?? t('gold.empty')}</div>
          )
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-widest text-white/55">
              {metalLabel} · {currencyInfo.code.toUpperCase()}
            </div>
            <div className="flex items-baseline gap-2 font-bold tabular-nums text-soft-shadow flex-wrap">
              <span className="text-amber-300 text-3xl md:text-4xl drop-shadow-[0_2px_8px_rgba(217,119,6,0.45)]">
                {formatCurrency(priceConverted, currency)}
              </span>
              <span className="text-sm text-white/65">/ {t(`gold.unit${unit[0].toUpperCase()}${unit.slice(1)}`)}</span>
            </div>
            {change && (
              <div
                className={cn(
                  'mt-1 flex items-center gap-1 text-xs font-medium',
                  change.diff > 0
                    ? 'text-emerald-300'
                    : change.diff < 0
                    ? 'text-rose-300'
                    : 'text-white/55',
                )}
              >
                {change.diff > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : change.diff < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span className="tabular-nums">
                  {change.diff > 0 ? '+' : ''}
                  {formatCurrency(Math.abs(change.diff), currency)} ({change.pct.toFixed(2)}%)
                </span>
              </div>
            )}
            {fetchedAtLabel && (
              <div className="mt-1 text-[10px] text-white/45">
                {t('gold.updated')} {fetchedAtLabel}
                {currency !== 'usd' && fxRate !== 1 && (
                  <span> · 1 USD ≈ {fxRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency.toUpperCase()}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {isStale && (
        <div className="flex items-center gap-1 text-[10px] text-amber-300/80 shrink-0">
          <AlertCircle className="h-3 w-3" />
          {t('gold.stale')}
        </div>
      )}
    </GlassCard>
  )
}
