import { useEffect, useMemo, useState } from 'react'
import { Moon, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/useT'
import {
  convertSolar2Lunar,
  jdFromDate,
  canChiYear,
  canChiMonth,
  canChiDay,
  chiIndexOfDay,
  isHoangDao,
  gioHoangDao,
  animalOfYear,
  ANIMAL_EMOJI,
} from '@/lib/lunar'
import { cn } from '@/lib/utils'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function fmtSolar(d: Date, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return `${weekdays[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function LunarCalendarWidget() {
  const { t, locale } = useT()
  const [today, setToday] = useState(() => startOfDay(new Date()))
  const [date, setDate] = useState(() => startOfDay(new Date()))

  // refresh "today" once an hour in case the page is left open across midnight
  useEffect(() => {
    const id = window.setInterval(() => setToday(startOfDay(new Date())), 60 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  const lunar = useMemo(() => {
    return convertSolar2Lunar(date.getDate(), date.getMonth() + 1, date.getFullYear())
  }, [date])

  const jd = useMemo(() => jdFromDate(date.getDate(), date.getMonth() + 1, date.getFullYear()), [date])
  const dayChi = chiIndexOfDay(jd)
  const hd = isHoangDao(lunar.month, dayChi)
  const auspicious = useMemo(() => gioHoangDao(dayChi), [dayChi])
  const animal = animalOfYear(lunar.year)
  const isToday = date.getTime() === today.getTime()

  const shiftDay = (delta: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    setDate(startOfDay(next))
  }
  const goToday = () => setDate(today)
  const handleDateChange = (v: string) => {
    if (!v) return
    const [y, m, d] = v.split('-').map(Number)
    setDate(startOfDay(new Date(y, m - 1, d)))
  }

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('lunar.title')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => shiftDay(-1)} className="h-7 w-7" aria-label="prev">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => shiftDay(1)} className="h-7 w-7" aria-label="next">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {!isToday && (
            <Button size="icon" variant="ghost" onClick={goToday} className="h-7 w-7" aria-label={t('lunar.today')}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* Big lunar day display */}
      <div className="rounded-xl border border-white/15 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/55">
              {t('lunar.lunarDate')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-white drop-shadow-[0_2px_6px_rgba(99,102,241,0.5)]">
                {lunar.day}
              </span>
              <span className="text-sm text-white/80">
                {locale === 'vi' ? 'tháng' : 'month'} {lunar.month}
                {lunar.leap ? ` (${t('lunar.leap')})` : ''}
              </span>
            </div>
            <div className="text-xs text-white/70 truncate">
              {locale === 'vi' ? 'Năm' : 'Year'} {canChiYear(lunar.year)} · {animal}
            </div>
          </div>
          <div className="text-5xl shrink-0" aria-hidden>
            {ANIMAL_EMOJI[animal]}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-white/55">
          {fmtSolar(date, locale)}
        </div>
      </div>

      {/* Can chi grid */}
      <div className="grid grid-cols-3 gap-2 text-xs shrink-0">
        <CanChiCell label={t('lunar.day')} value={canChiDay(jd)} />
        <CanChiCell label={t('lunar.month')} value={canChiMonth(lunar.month, lunar.year)} />
        <CanChiCell label={t('lunar.year')} value={canChiYear(lunar.year)} />
      </div>

      {/* Hoàng đạo + giờ */}
      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
        <div
          className={cn(
            'rounded-lg border px-3 py-2 flex items-center gap-2',
            hd
              ? 'border-emerald-400/35 bg-emerald-500/15'
              : 'border-zinc-400/35 bg-zinc-500/15',
          )}
        >
          <Sparkles className={cn('h-4 w-4 shrink-0', hd ? 'text-emerald-300' : 'text-zinc-300')} />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/55">
              {t('lunar.dayType')}
            </div>
            <div className={cn('text-sm font-semibold', hd ? 'text-emerald-200' : 'text-zinc-200')}>
              {hd ? t('lunar.hoangDao') : t('lunar.hacDao')}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/55 mb-1.5">
            {t('lunar.auspiciousHours')}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {auspicious.map((h) => (
              <div
                key={h.chi}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] flex items-center justify-between"
              >
                <span className="font-semibold text-white">{h.chi}</span>
                <span className="text-white/65 tabular-nums">{h.range}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/55 mb-1.5">
            {t('lunar.pickDate')}
          </div>
          <input
            type="date"
            value={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white [color-scheme:dark]"
          />
        </div>
      </div>
    </GlassCard>
  )
}

function CanChiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-white/55">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
    </div>
  )
}
