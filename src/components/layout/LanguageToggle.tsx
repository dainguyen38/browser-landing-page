import { Languages } from 'lucide-react'
import { useSettingsStore } from '@/store/settings'
import { useT } from '@/i18n/useT'

const LOCALES = [
  { code: 'vi' as const, label: 'Tiếng Việt', short: 'VI', flag: '🇻🇳' },
  { code: 'en' as const, label: 'English', short: 'EN', flag: '🇺🇸' },
]

export function LanguageToggle() {
  const { t } = useT()
  const locale = useSettingsStore((s) => s.locale)
  const setLocale = useSettingsStore((s) => s.setLocale)

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]
  const next = LOCALES.find((l) => l.code !== locale) ?? LOCALES[1]

  return (
    <button
      type="button"
      onClick={() => setLocale(next.code)}
      aria-label={t('language.switch')}
      title={`${current.label} → ${next.label}`}
      className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white text-xs font-semibold transition-colors"
    >
      <Languages className="h-4 w-4 text-white/85" />
      <span className="tabular-nums">{current.short}</span>
      <span aria-hidden className="text-sm leading-none">
        {current.flag}
      </span>
    </button>
  )
}
