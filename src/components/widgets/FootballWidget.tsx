import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy, RefreshCw, AlertCircle, CalendarClock } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import {
  FOOTBALL_LEAGUES,
  type LeagueId,
  type FootballMatch,
  fetchPastEvents,
  fetchNextEvents,
  isUpcoming,
} from '@/lib/football'

const STORAGE_KEY = 'landing.football.v1'

type Tab = 'results' | 'upcoming'

interface CacheEntry {
  leagueId: LeagueId
  tab: Tab
  matches: FootballMatch[]
  fetchedAt: string
}

function cacheKey(leagueId: LeagueId, tab: Tab): string {
  return `${STORAGE_KEY}:${leagueId}:${tab}`
}

function loadCache(leagueId: LeagueId, tab: Tab): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(leagueId, tab))
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function saveCache(entry: CacheEntry) {
  try {
    localStorage.setItem(cacheKey(entry.leagueId, entry.tab), JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

export function FootballWidget() {
  const { t, locale } = useT()
  const [leagueId, setLeagueId] = useState<LeagueId>('4328')
  const [tab, setTab] = useState<Tab>('results')
  const [matches, setMatches] = useState<FootballMatch[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cache when the league or tab changes
  useEffect(() => {
    const cached = loadCache(leagueId, tab)
    if (cached) {
      setMatches(cached.matches)
      setFetchedAt(cached.fetchedAt)
    } else {
      setMatches([])
      setFetchedAt(null)
    }
  }, [leagueId, tab])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data =
        tab === 'results' ? await fetchPastEvents(leagueId) : await fetchNextEvents(leagueId)
      const now = new Date().toISOString()
      setMatches(data)
      setFetchedAt(now)
      saveCache({ leagueId, tab, matches: data, fetchedAt: now })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [leagueId, tab])

  // Auto-fetch on mount / league / tab change. Refresh every 5 minutes.
  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [refresh])

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
  }, [fetchedAt, locale])

  const isStale = !!error && matches.length > 0

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('football.title')}
          </h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          aria-label={t('football.refresh')}
          className="h-7 w-7"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </header>

      <div className="flex items-center gap-2 shrink-0">
        <Select value={leagueId} onValueChange={(v) => setLeagueId(v as LeagueId)}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOOTBALL_LEAGUES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-8">
            <TabsTrigger value="results" className="text-xs px-2.5">
              {t('football.tabResults')}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs px-2.5">
              {t('football.tabUpcoming')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
        {matches.length === 0 ? (
          loading ? (
            <div className="text-sm text-white/70 p-3">{t('football.loading')}</div>
          ) : error ? (
            <div className="text-sm text-rose-300 p-3">{error}</div>
          ) : (
            <div className="text-sm text-white/55 p-3">
              {tab === 'upcoming' ? t('football.emptyUpcoming') : t('football.empty')}
            </div>
          )
        ) : (
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} locale={locale} t={t} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0">
        {fetchedAtLabel ? (
          <div className="text-[10px] text-white/45">
            {t('football.updated')} {fetchedAtLabel}
          </div>
        ) : (
          <span />
        )}
        {isStale && (
          <div className="flex items-center gap-1 text-[10px] text-amber-300/80">
            <AlertCircle className="h-3 w-3" />
            {t('football.stale')}
          </div>
        )}
      </div>
    </GlassCard>
  )
}

interface MatchRowProps {
  match: FootballMatch
  locale: string
  t: (k: string) => string
}

function MatchRow({ match: m, locale, t }: MatchRowProps) {
  const upcoming = isUpcoming(m)
  const dateLabel = useMemo(() => {
    if (!m.timestamp) return ''
    try {
      const d = new Date(m.timestamp)
      const tag = locale === 'vi' ? 'vi-VN' : 'en-US'
      if (upcoming) {
        return d.toLocaleString(tag, {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      return d.toLocaleDateString(tag, { day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }, [m.timestamp, locale, upcoming])

  return (
    <li className="rounded-lg bg-white/5 hover:bg-white/10 transition-colors px-2.5 py-2 flex items-center gap-2.5">
      <Team name={m.home} badge={m.homeBadge} align="left" />
      <div className="shrink-0 flex flex-col items-center min-w-[58px] px-1">
        {upcoming ? (
          <>
            <CalendarClock className="h-3.5 w-3.5 text-white/55 mb-0.5" />
            <span className="text-[10px] text-white/65 text-center leading-tight">
              {dateLabel || t('football.tbd')}
            </span>
          </>
        ) : (
          <>
            <div className="text-lg font-bold tabular-nums text-white text-soft-shadow leading-none">
              {m.homeScore ?? '-'}
              <span className="text-white/40 mx-1">:</span>
              {m.awayScore ?? '-'}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/45">
              {(m.status || 'FT').toUpperCase()}
              {dateLabel && <span className="mx-1">·</span>}
              {dateLabel}
            </div>
          </>
        )}
      </div>
      <Team name={m.away} badge={m.awayBadge} align="right" />
    </li>
  )
}

function Team({
  name,
  badge,
  align,
}: {
  name: string
  badge: string | undefined
  align: 'left' | 'right'
}) {
  const Logo = badge ? (
    <img
      src={badge}
      alt=""
      loading="lazy"
      className="h-6 w-6 object-contain shrink-0"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
      }}
    />
  ) : (
    <div className="h-6 w-6 rounded-full bg-white/10 shrink-0" />
  )
  return (
    <div
      className={cn(
        'flex-1 min-w-0 flex items-center gap-1.5',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {Logo}
      <span
        className={cn(
          'text-xs sm:text-[13px] text-white/90 truncate',
          align === 'right' && 'text-right',
        )}
        title={name}
      >
        {name}
      </span>
    </div>
  )
}
