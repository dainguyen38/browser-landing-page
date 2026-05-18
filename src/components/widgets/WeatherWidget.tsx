import { useEffect, useMemo, useState } from 'react'
import { MapPin, RefreshCw, Search, Wind, Droplets, ThermometerSun, AlertCircle } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settings'
import { useWeatherStore } from '@/store/weather'
import {
  describeCode,
  fetchCurrentWeather,
  searchLocation,
  type GeocodeResult,
  type WeatherCurrent,
} from '@/lib/weather'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

function locationKey(lat: number, lon: number, unit: string) {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${unit}`
}

export function WeatherWidget() {
  const { t, locale } = useT()
  const location = useSettingsStore((s) => s.weatherLocation)
  const unit = useSettingsStore((s) => s.weatherUnit)
  const setLocation = useSettingsStore((s) => s.setWeatherLocation)
  const cache = useWeatherStore((s) => s.cache)
  const setCache = useWeatherStore((s) => s.setCache)

  const [data, setData] = useState<WeatherCurrent | null>(() => {
    const expectedKey = locationKey(location.latitude, location.longitude, unit)
    return cache?.key === expectedKey ? cache.data : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchCurrentWeather(location.latitude, location.longitude, unit)
      setData(next)
      setCache({ key: locationKey(location.latitude, location.longitude, unit), data: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 30 * 60 * 1000) // every 30 min
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.latitude, location.longitude, unit])

  const codeInfo = data ? describeCode(data.weatherCode, locale) : null
  const Icon = codeInfo?.icon
  const unitSign = unit === 'celsius' ? '°C' : '°F'
  const windSign = unit === 'celsius' ? 'km/h' : 'mph'
  const isStale = !!error && !!data

  return (
    <>
      <GlassCard className="flex flex-col min-h-0">
        <header className="flex items-center justify-between gap-1 pr-9 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ThermometerSun className="h-4 w-4 text-white/80 shrink-0" />
            <h2 className="text-xs font-semibold tracking-wide uppercase text-white/90 text-soft-shadow truncate">
              {t('weather.title')}
            </h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            aria-label={t('weather.refresh')}
            className="h-6 w-6 shrink-0"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </Button>
        </header>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white self-start"
        >
          <MapPin className="h-3 w-3" />
          <span className="truncate max-w-[14rem]">{location.name}</span>
        </button>

        <div className="flex-1 min-h-0 flex items-center justify-between gap-3 mt-2">
          {data && codeInfo && Icon ? (
            <>
              <div className="min-w-0">
                <div className="text-5xl md:text-6xl font-semibold leading-none tabular-nums text-soft-shadow">
                  {Math.round(data.temperature)}
                  <span className="text-2xl ml-1 text-white/70">{unitSign}</span>
                </div>
                <div className="mt-1 text-sm text-white/85 truncate">{codeInfo.label}</div>
                <div className="mt-0.5 text-xs text-white/60 tabular-nums">
                  {Math.round(data.low)}{unitSign} / {Math.round(data.high)}{unitSign}
                </div>
              </div>
              <Icon className="h-16 w-16 md:h-20 md:w-20 text-white/90 shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]" />
            </>
          ) : loading ? (
            <div className="text-sm text-white/70 self-center">{t('weather.loading')}</div>
          ) : (
            <div className="text-sm text-white/70 self-center">{error ?? t('weather.empty')}</div>
          )}
        </div>

        {data && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/80 shrink-0">
            <Stat icon={ThermometerSun} label={t('weather.feels')}>
              {Math.round(data.apparentTemperature)}{unitSign}
            </Stat>
            <Stat icon={Wind} label={t('weather.wind')}>
              {Math.round(data.windSpeed)} {windSign}
            </Stat>
            <Stat icon={Droplets} label={t('weather.humidity')}>
              {data.humidity}%
            </Stat>
          </div>
        )}

        {isStale && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-300/90">
            <AlertCircle className="h-3 w-3" />
            {t('weather.stale')}
          </div>
        )}
      </GlassCard>

      <LocationPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(loc) => {
          setLocation({
            name: [loc.name, loc.admin1, loc.country].filter(Boolean).join(', '),
            latitude: loc.latitude,
            longitude: loc.longitude,
            country: loc.country,
          })
          setPickerOpen(false)
        }}
      />
    </>
  )
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wind
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase tracking-wide truncate">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm tabular-nums truncate">{children}</div>
    </div>
  )
}

function LocationPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (result: GeocodeResult) => void
}) {
  const { t, locale } = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setErr(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchLocation(q, locale)
        if (!cancelled) setResults(res)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, open, locale])

  const subtitle = useMemo(
    () => (locale === 'vi' ? 'Tìm thành phố, ví dụ "Hà Nội", "Tokyo"' : 'Search city, e.g. "Hanoi", "Tokyo"'),
    [locale],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('weather.changeLocation')}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={subtitle}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="min-h-[8rem] max-h-72 overflow-y-auto pr-1">
          {loading && <div className="text-sm text-white/60 px-1 py-2">{t('weather.loading')}</div>}
          {err && <div className="text-sm text-rose-300 px-1 py-2">{err}</div>}
          {!loading && !err && results.length === 0 && query.trim().length >= 2 && (
            <div className="text-sm text-white/60 px-1 py-2">{t('weather.noResults')}</div>
          )}
          <ul className="space-y-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="w-full text-left rounded-md px-2 py-2 hover:bg-white/10 transition-colors"
                >
                  <div className="text-sm text-white">{r.name}</div>
                  <div className="text-xs text-white/60">
                    {[r.admin1, r.country].filter(Boolean).join(', ')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
