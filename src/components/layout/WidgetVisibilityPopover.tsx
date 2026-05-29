import { useMemo, useState } from 'react'
import {
  Clock,
  Pin,
  PinOff,
  CheckSquare,
  ThermometerSun,
  Gamepad2,
  Calculator as CalcIcon,
  Coins,
  Moon,
  Palette,
  ArrowRightLeft,
  StickyNote,
  Brush,
  Sprout,
  GraduationCap,
  Trophy,
  LayoutGrid,
  Search,
  Eye,
  EyeOff,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useLayoutStore, type WidgetId } from '@/store/layout'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { clearWidgetData, HAS_PERSISTED_DATA } from '@/lib/widgetData'

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
  notes: StickyNote,
  drawing: Brush,
  tree: Sprout,
  english: GraduationCap,
  football: Trophy,
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
  'notes',
  'drawing',
  'tree',
  'english',
  'football',
]

export function WidgetVisibilityPopover() {
  const { t } = useT()
  const hidden = useLayoutStore((s) => s.hidden)
  const pinned = useLayoutStore((s) => s.pinned)
  const toggle = useLayoutStore((s) => s.toggleHidden)
  const togglePin = useLayoutStore((s) => s.togglePin)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState<WidgetId | null>(null)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ALL_WIDGETS.map((id) => ({
      id,
      label: t(`settings.${id}`),
      visible: !hidden.includes(id),
      pinned: pinned.includes(id),
    }))
    const filtered = q
      ? list.filter((it) => it.label.toLowerCase().includes(q) || it.id.includes(q))
      : list
    // Pinned in their pin order first, then unpinned alphabetical.
    const byId = new Map(filtered.map((it) => [it.id, it]))
    const pinnedItems = pinned
      .map((id) => byId.get(id))
      .filter((x): x is (typeof filtered)[number] => !!x)
    const others = filtered
      .filter((it) => !it.pinned)
      .sort((a, b) => a.label.localeCompare(b.label))
    return { pinned: pinnedItems, others }
  }, [hidden, pinned, query, t])

  const visibleCount = ALL_WIDGETS.length - hidden.length

  const confirmLabel = confirmClear ? t(`settings.${confirmClear}`) : ''

  return (
    <>
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
        <PopoverContent align="end" className="w-80 p-0">
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
          <div className="max-h-[26rem] overflow-y-auto py-1">
            {items.pinned.length === 0 && items.others.length === 0 ? (
              <div className="px-3 py-6 text-xs text-white/50 text-center">
                {t('widgets.noMatch')}
              </div>
            ) : (
              <>
                {items.pinned.length > 0 && (
                  <>
                    <Section label={t('widgets.pinnedSection')} />
                    {items.pinned.map((it) => (
                      <Row
                        key={it.id}
                        id={it.id}
                        label={it.label}
                        visible={it.visible}
                        pinned={true}
                        onToggle={() => toggle(it.id)}
                        onTogglePin={() => togglePin(it.id)}
                        onClear={() => setConfirmClear(it.id)}
                      />
                    ))}
                    {items.others.length > 0 && <div className="my-1 h-px bg-white/10" />}
                  </>
                )}
                {items.others.map((it) => (
                  <Row
                    key={it.id}
                    id={it.id}
                    label={it.label}
                    visible={it.visible}
                    pinned={false}
                    onToggle={() => toggle(it.id)}
                    onTogglePin={() => togglePin(it.id)}
                    onClear={() => setConfirmClear(it.id)}
                  />
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={!!confirmClear}
        title={t('widgets.clearTitle')}
        description={t('widgets.clearDesc').replace('{name}', confirmLabel)}
        confirmText={t('widgets.clearConfirm')}
        cancelText={t('common.cancel')}
        destructive
        onOpenChange={(o) => !o && setConfirmClear(null)}
        onConfirm={async () => {
          if (!confirmClear) return
          await clearWidgetData(confirmClear)
          // Reload so all zustand stores rehydrate from clean storage.
          window.location.reload()
        }}
      />
    </>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-widest text-white/45">
      {label}
    </div>
  )
}

interface RowProps {
  id: WidgetId
  label: string
  visible: boolean
  pinned: boolean
  onToggle: () => void
  onTogglePin: () => void
  onClear: () => void
}

function Row({ id, label, visible, pinned, onToggle, onTogglePin, onClear }: RowProps) {
  const Icon = ICONS[id]
  const canClear = HAS_PERSISTED_DATA[id]
  return (
    <div
      className={cn(
        'group/row flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/5',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', visible ? 'text-white/85' : 'text-white/35')} />
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex-1 text-left text-sm truncate transition-colors',
          visible ? 'text-white/95' : 'text-white/45',
        )}
      >
        {label}
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        <IconBtn
          onClick={onTogglePin}
          title={pinned ? 'Unpin' : 'Pin'}
          active={pinned}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn onClick={onToggle} title={visible ? 'Hide' : 'Show'}>
          {visible ? (
            <Eye className="h-3.5 w-3.5 text-emerald-300" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-white/40" />
          )}
        </IconBtn>
        <IconBtn
          onClick={onClear}
          title="Clear data"
          disabled={!canClear}
          danger
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  active,
  danger,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
        disabled
          ? 'text-white/15 cursor-not-allowed'
          : danger
          ? 'text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/15'
          : active
          ? 'text-amber-300 bg-amber-500/15'
          : 'text-white/55 hover:text-white hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}
