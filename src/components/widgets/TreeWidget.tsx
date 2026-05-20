import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sprout, Droplet, Leaf, Axe, Sun, Moon } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/useT'
import {
  useTreeStore,
  progressOf,
  woodReward,
  daysSincePlant,
  nextWaterMs,
  nextFertMs,
  MAX_WATER,
  MAX_FERT,
  CHOP_THRESHOLD,
  GROWTH_DAYS,
} from '@/store/tree'
import { Tree3DScene } from './tree/Tree3DScene'
import { cn } from '@/lib/utils'

type StageKey = 'seed' | 'sprout' | 'young' | 'sapling' | 'tree' | 'mature' | 'ancient'

function stageOf(p: number): StageKey {
  if (p >= 0.9) return 'ancient'
  if (p >= 0.65) return 'mature'
  if (p >= 0.35) return 'tree'
  if (p >= 0.15) return 'sapling'
  if (p >= 0.04) return 'young'
  if (p > 0) return 'sprout'
  return 'seed'
}

function formatCountdown(ms: number, locale: 'vi' | 'en'): string {
  if (ms <= 0) return locale === 'vi' ? 'Sẵn sàng' : 'Ready'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

function isDayNow(): boolean {
  const h = new Date().getHours()
  return h >= 6 && h < 18
}

export function TreeWidget() {
  const { t, locale } = useT()
  const state = useTreeStore()
  const [now, setNow] = useState(Date.now())
  const [choppingAt, setChoppingAt] = useState<number | null>(null)
  const [chopReward, setChopReward] = useState<number | null>(null)
  const [isDay, setIsDay] = useState(isDayNow)

  // 1Hz tick — refresh countdowns + run regen + update day/night
  useEffect(() => {
    state.tick()
    setIsDay(isDayNow())
    const id = window.setInterval(() => {
      setNow(Date.now())
      state.tick()
      setIsDay(isDayNow())
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progress = progressOf(state)
  const stage = stageOf(progress)
  const heightCm = useMemo(() => Math.round(3 + progress * 797), [progress])
  const days = daysSincePlant(state)
  const wNext = nextWaterMs(state)
  const fNext = nextFertMs(state)
  // re-render tick keeps these fresh
  void now

  const canChop = !!state.plantedAt && progress >= CHOP_THRESHOLD
  const projectedWood = canChop ? woodReward(progress) : 0

  const onWater = useCallback(() => {
    state.water()
  }, [state])
  const onFert = useCallback(() => {
    state.fertilize()
  }, [state])
  const onChop = useCallback(() => {
    if (!canChop) return
    const before = woodReward(progress)
    setChoppingAt(Date.now())
    setChopReward(before)
    window.setTimeout(() => {
      state.chop()
      setChoppingAt(null)
      window.setTimeout(() => setChopReward(null), 2200)
    }, 1100)
  }, [canChop, progress, state])

  // === Empty state ===
  if (!state.plantedAt) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-3 min-h-0 text-center">
        <Sprout className="h-10 w-10 text-emerald-300" />
        <div className="text-sm uppercase tracking-widest text-white/70">{t('tree.title')}</div>
        <p className="text-xs text-white/65 max-w-[22rem]">{t('tree.welcome')}</p>
        {state.totalWood > 0 && (
          <div className="text-xs text-amber-300 font-medium tabular-nums">
            🪵 {state.totalWood} {t('tree.wood')} · {state.treesChopped} {t('tree.trees')}
          </div>
        )}
        <Button onClick={() => state.plant()} size="lg" className="mt-1">
          <Sprout className="h-4 w-4" /> {t('tree.plant')}
        </Button>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="flex flex-col gap-2.5 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('tree.title')}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/65">
          {isDay ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-300" />
              <span>{t('tree.day')}</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-sky-200" />
              <span>{t('tree.night')}</span>
            </>
          )}
        </div>
      </header>

      {/* 3D scene */}
      <div className="relative flex-1 min-h-[180px] rounded-xl overflow-hidden border border-white/10">
        <Tree3DScene growth={progress} isDay={isDay} choppingAt={choppingAt} />
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-2 text-[10px] uppercase tracking-widest pointer-events-none">
          <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur text-white">
            {t(`tree.stage.${stage}`)}
          </span>
          <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur text-emerald-200 tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
        {chopReward !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="bg-amber-500/95 text-zinc-900 font-bold rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-2 text-lg">
              🪵 +{chopReward} {t('tree.wood')}
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <Stat label={t('tree.height')} value={fmtHeight(heightCm)} />
        <Stat
          label={t('tree.age')}
          value={`${days}/${GROWTH_DAYS}${locale === 'vi' ? '' : 'd'}`}
        />
        <Stat label={t('tree.wood')} value={`${state.totalWood}`} tone="amber" />
        <Stat label={t('tree.trees')} value={`${state.treesChopped}`} />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        <ActionButton
          icon={<Droplet className="h-3.5 w-3.5" />}
          label={t('tree.water')}
          inv={state.waterInventory}
          max={MAX_WATER}
          nextMs={wNext}
          onClick={onWater}
          color="sky"
          locale={locale}
        />
        <ActionButton
          icon={<Leaf className="h-3.5 w-3.5" />}
          label={t('tree.fertilize')}
          inv={state.fertInventory}
          max={MAX_FERT}
          nextMs={fNext}
          onClick={onFert}
          color="lime"
          locale={locale}
        />
        <button
          onClick={onChop}
          disabled={!canChop || choppingAt !== null}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
            canChop
              ? 'border-amber-400/55 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100'
              : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Axe className="h-3.5 w-3.5" />
            <span>{t('tree.chop')}</span>
          </div>
          <span className="text-[10px] tabular-nums">
            {canChop ? `+${projectedWood} 🪵` : t('tree.chopLocked')}
          </span>
        </button>
      </div>
    </GlassCard>
  )
}

function fmtHeight(cm: number): string {
  if (cm < 100) return `${cm} cm`
  const m = cm / 100
  return `${m.toFixed(2)} m`
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'amber'
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-widest text-white/55 truncate">{label}</div>
      <div
        className={cn(
          'text-sm font-semibold tabular-nums truncate',
          tone === 'amber' && 'text-amber-300',
        )}
      >
        {value}
      </div>
    </div>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  inv: number
  max: number
  nextMs: number
  onClick: () => void
  color: 'sky' | 'lime'
  locale: 'vi' | 'en'
}

function ActionButton({ icon, label, inv, max, nextMs, onClick, color, locale }: ActionButtonProps) {
  const canUse = inv > 0
  const ringColor =
    color === 'sky' ? 'border-sky-400/55 bg-sky-500/15 hover:bg-sky-500/25 text-sky-100' : 'border-lime-400/55 bg-lime-500/15 hover:bg-lime-500/25 text-lime-100'
  const dotActive = color === 'sky' ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]' : 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.7)]'

  return (
    <button
      onClick={onClick}
      disabled={!canUse}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
        canUse ? ringColor : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span>
          {label} {inv}/{max}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-3 rounded-full transition-colors',
              i < inv ? dotActive : 'bg-white/15',
            )}
          />
        ))}
      </div>
      <span className="text-[10px] text-white/65 tabular-nums">
        {nextMs > 0 ? `⏳ ${formatCountdown(nextMs, locale)}` : '✓'}
      </span>
    </button>
  )
}
