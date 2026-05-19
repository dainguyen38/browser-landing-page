import { useMemo, useState } from 'react'
import {
  Clock,
  Pin,
  CheckSquare,
  ThermometerSun,
  Gamepad2,
  Calculator as CalcIcon,
  Coins,
  Moon,
  Palette,
  ArrowRightLeft,
  LayoutGrid,
  Search,
  Eye,
  EyeOff,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { useLayoutStore, type WidgetId } from '@/store/layout'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

const ICONS: Record<WidgetId, LucideIcon> = {
  clock: Clock,
  pinned: Pin,
  todo: CheckSquare,
  weather: ThermometerSun,
  minigame: Gamepad2,
  calculator: CalcIcon,
  gold: Coins,
  lunar: Moon,
  colorpicker: Palette,
  currency: ArrowRightLeft,
}

const ALL_WIDGETS: WidgetId[] = [
  'clock',
  'pinned',
  'todo',
  'weather',
  'minigame',
  'calculator',
  'gold',
  'lunar',
  'colorpicker',
  'currency',
]

export function WidgetVisibilityPopover() {
  const { t } = useT()
  const hidden = useLayoutStore((s) => s.hidden)
  const toggle = useLayoutStore((s) => s.toggleHidden)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ALL_WIDGETS.map((id) => ({
      id,
      label: t(`settings.${id}`),
      visible: !hidden.includes(id),
    }))
    const filtered = q
      ? list.filter((it) => it.label.toLowerCase().includes(q) || it.id.includes(q))
      : list
    // active (visible) first, then hidden
    return filtered.sort((a, b) => {
      if (a.visible === b.visible) return a.label.localeCompare(b.label)
      return a.visible ? -1 : 1
    })
  }, [hidden, query, t])

  const visibleCount = ALL_WIDGETS.length - hidden.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('widgets.toggleVisibility')}
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {visibleCount}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
            {t('widgets.title')}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('widgets.searchPh')}
              className="pl-7 h-8 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-xs text-white/50 text-center">
              {t('widgets.noMatch')}
            </div>
          ) : (
            items.map((it) => {
              const Icon = ICONS[it.id]
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', it.visible ? 'text-white/85' : 'text-white/40')} />
                  <span className={cn('flex-1 text-left', !it.visible && 'text-white/50')}>
                    {it.label}
                  </span>
                  {it.visible ? (
                    <Eye className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-white/40" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
