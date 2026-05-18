import { useMemo } from 'react'
import { vi as viLocale, enUS as enLocale } from 'date-fns/locale'
import en, { type Dict } from './en'
import vi from './vi'
import { useSettingsStore } from '@/store/settings'

const dicts: Record<'en' | 'vi', Dict> = { en, vi }

export function useT() {
  const locale = useSettingsStore((s) => s.locale)
  return useMemo(() => {
    const dict = dicts[locale]
    return {
      t: (path: string): string => {
        const parts = path.split('.')
        let cursor: unknown = dict
        for (const p of parts) {
          if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
            cursor = (cursor as Record<string, unknown>)[p]
          } else {
            return path
          }
        }
        return typeof cursor === 'string' ? cursor : path
      },
      locale,
      dateLocale: locale === 'vi' ? viLocale : enLocale,
    }
  }, [locale])
}
