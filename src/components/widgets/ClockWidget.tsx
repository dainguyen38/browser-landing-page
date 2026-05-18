import { format } from 'date-fns'
import { useNow } from '@/hooks/useNow'
import { useSettingsStore } from '@/store/settings'
import { useT } from '@/i18n/useT'
import { GlassCard } from '@/components/layout/GlassCard'

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}

export function ClockWidget() {
  const now = useNow(1000)
  const hour24 = useSettingsStore((s) => s.hour24)
  const greetingName = useSettingsStore((s) => s.greetingName)
  const { t, locale, dateLocale } = useT()

  const timeFmt = hour24 ? 'HH:mm' : 'h:mm a'
  const timeStr = format(now, timeFmt, { locale: dateLocale })
  const seconds = format(now, 'ss', { locale: dateLocale })
  const dateStr =
    locale === 'vi'
      ? format(now, "EEEE, 'ngày' d 'tháng' M 'năm' yyyy", { locale: dateLocale })
      : format(now, 'EEEE, MMMM do, yyyy', { locale: dateLocale })

  const gk = greetingKey(now.getHours())
  const name = greetingName?.trim() || t('greeting.anon')

  return (
    <GlassCard
      variant="sheer"
      className="flex flex-col items-center justify-center text-center py-6 px-6 select-none"
    >
      <div className="text-soft-shadow text-sm uppercase tracking-[0.3em] text-white/80">
        {t(`greeting.${gk}`)}, <span className="text-white">{name}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2 font-semibold tabular-nums text-soft-shadow">
        <span className="text-7xl md:text-8xl leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
          {timeStr}
        </span>
        <span className="text-2xl md:text-3xl text-white/80">{seconds}</span>
      </div>
      <div className="mt-2 text-white/90 text-soft-shadow capitalize">{dateStr}</div>
    </GlassCard>
  )
}
