import { useMemo, useState } from 'react'
import {
  Keyboard as KeyboardIcon,
  Trophy,
  Zap,
  Timer,
  Check,
  Flame,
  Sparkles,
  Hand,
  type LucideIcon,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { GlassCard } from '@/components/layout/GlassCard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { stagesByLang, type LessonStage } from '@/lib/typing/lessons'
import { useTypingStore, type TypingLang } from '@/store/typing'
import { TypingGame, type GameMode } from '@/components/typing/TypingGame'

type StageVisual = { icon: LucideIcon; gradient: string; color: string }

// Visual tone per lesson index so the tile grid feels varied like the
// minigame hub. Cycles through five colour gradients.
const STAGE_VISUALS: StageVisual[] = [
  { icon: Hand,       gradient: 'from-emerald-500/30 to-cyan-500/20',     color: 'text-emerald-200' },
  { icon: Hand,       gradient: 'from-amber-500/30 to-orange-500/20',     color: 'text-amber-200' },
  { icon: Hand,       gradient: 'from-violet-500/30 to-fuchsia-500/20',   color: 'text-violet-200' },
  { icon: Hand,       gradient: 'from-sky-500/30 to-indigo-500/20',       color: 'text-sky-200' },
  { icon: Sparkles,   gradient: 'from-rose-500/30 to-pink-500/20',        color: 'text-rose-200' },
]

function visualFor(index: number): StageVisual {
  return STAGE_VISUALS[index % STAGE_VISUALS.length]
}

interface Challenge {
  key: string
  icon: LucideIcon
  title: string
  blurb: string
  gradient: string
  color: string
  build: (lang: TypingLang) => GameMode
}

const CHALLENGES: Challenge[] = [
  {
    key: 'time30',
    icon: Timer,
    title: 'Time attack · 30s',
    blurb: 'Sprint — type as much as you can in 30 seconds',
    gradient: 'from-rose-500/35 to-orange-500/20',
    color: 'text-rose-200',
    build: (lang) => ({ kind: 'time', durationSec: 30, lang }),
  },
  {
    key: 'time60',
    icon: Timer,
    title: 'Time attack · 60s',
    blurb: 'Classic — the standard 60-second WPM test',
    gradient: 'from-amber-500/35 to-yellow-500/20',
    color: 'text-amber-200',
    build: (lang) => ({ kind: 'time', durationSec: 60, lang }),
  },
  {
    key: 'time120',
    icon: Timer,
    title: 'Time attack · 2 min',
    blurb: 'Endurance — 120 seconds of sustained typing',
    gradient: 'from-orange-500/35 to-rose-500/20',
    color: 'text-orange-200',
    build: (lang) => ({ kind: 'time', durationSec: 120, lang }),
  },
  {
    key: 'endless',
    icon: Flame,
    title: 'Endless',
    blurb: 'Random words until you lose 5 lives',
    gradient: 'from-fuchsia-500/35 to-violet-500/20',
    color: 'text-fuchsia-200',
    build: (lang) => ({ kind: 'endless', lang }),
  },
]

export function TypingWidget() {
  const { t, locale, dateLocale } = useT()
  const lang = useTypingStore((s) => s.lang)
  const setLang = useTypingStore((s) => s.setLang)
  const useTelex = useTypingStore((s) => s.useTelex)
  const setUseTelex = useTypingStore((s) => s.setUseTelex)
  const results = useTypingStore((s) => s.results)
  const endlessBest = useTypingStore((s) => s.endlessBest)
  const timeAttackHigh = useTypingStore((s) => s.timeAttackHigh)

  const [active, setActive] = useState<GameMode | null>(null)

  const stages = useMemo(() => stagesByLang(lang), [lang])
  const passedCount = stages.filter((s) => results[s.id]?.passedAt).length

  return (
    <>
      <GlassCard className="flex flex-col gap-3 min-h-0">
        <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <KeyboardIcon className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
              {t('typing.title')}
            </h2>
          </div>
          <Tabs value={lang} onValueChange={(v) => setLang(v as TypingLang)}>
            <TabsList className="h-7">
              <TabsTrigger value="en" className="text-[11px] px-2.5">
                EN
              </TabsTrigger>
              <TabsTrigger value="vi" className="text-[11px] px-2.5">
                VI
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <StatTile
            label={t('typing.lessonsPassed')}
            value={`${passedCount}/${stages.length}`}
            color="text-emerald-300"
          />
          <StatTile
            label={t('typing.bestWpm60')}
            value={String(timeAttackHigh['60']?.wpm ?? 0)}
            color="text-amber-300"
          />
          <StatTile
            label={t('typing.bestEndless')}
            value={String(endlessBest)}
            color="text-fuchsia-300"
          />
        </div>

        {lang === 'vi' && (
          <label className="flex items-center gap-2 shrink-0 text-[11px] text-white/70 border border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useTelex}
              onChange={(e) => setUseTelex(e.target.checked)}
              className="accent-primary"
            />
            <span>{t('typing.useTelex')}</span>
          </label>
        )}

        {/* Tabs: Daily vs Challenges */}
        <Tabs defaultValue="daily" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="daily" className="flex-1 text-xs">
              {t('typing.tabDaily')}
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex-1 text-xs">
              {t('typing.tabChallenges')}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="daily"
            className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2"
          >
            <div
              className="grid gap-2 content-start"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))' }}
            >
              {stages.map((s, i) => (
                <LessonTile
                  key={s.id}
                  stage={s}
                  index={i}
                  visual={visualFor(i)}
                  result={results[s.id]}
                  locale={locale}
                  dateLocale={dateLocale}
                  onPlay={() => setActive({ kind: 'lesson', stageId: s.id })}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent
            value="challenges"
            className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2"
          >
            <div
              className="grid gap-2 content-start"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
            >
              {CHALLENGES.map((c) => {
                const best =
                  c.key.startsWith('time') &&
                  timeAttackHigh[String((c.build(lang) as { durationSec: number }).durationSec)]
                const endlessBestVal = c.key === 'endless' ? endlessBest : undefined
                return (
                  <ChallengeTile
                    key={c.key}
                    challenge={c}
                    onPlay={() => setActive(c.build(lang))}
                    bestLabel={
                      best
                        ? `${best.wpm} WPM · ${best.accuracy}%`
                        : endlessBestVal && endlessBestVal > 0
                        ? `${endlessBestVal} ${locale === 'vi' ? 'chữ' : 'chars'}`
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </GlassCard>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent
          className="w-[min(96vw,1400px)] max-w-none h-[min(94dvh,820px)] p-0 gap-0 overflow-hidden flex flex-col"
          // Game handles Esc to pause; don't let Radix close the dialog on Esc.
          onEscapeKeyDown={(e) => e.preventDefault()}
          // Prevent click-on-overlay from closing accidentally during a run.
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t('typing.title')}</DialogTitle>
          </DialogHeader>
          {active && <TypingGame mode={active} onExit={() => setActive(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ===========================================================================

function StatTile({
  label,
  value,
  color = 'text-white',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider text-white/55 truncate">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums', color)}>{value}</div>
    </div>
  )
}

function LessonTile({
  stage,
  index,
  visual,
  result,
  locale,
  dateLocale,
  onPlay,
}: {
  stage: LessonStage
  index: number
  visual: StageVisual
  result?: {
    passedAt: string
    bestWpm: number
    bestAccuracy: number
    attempts: number
  }
  locale: 'en' | 'vi'
  dateLocale: ReturnType<typeof useT>['dateLocale']
  onPlay: () => void
}) {
  const passed = !!result?.passedAt
  const passedDate = useMemo(() => {
    if (!result?.passedAt) return null
    try {
      return format(parseISO(result.passedAt), 'd MMM', { locale: dateLocale })
    } catch {
      return null
    }
  }, [result?.passedAt, dateLocale])
  const Icon = visual.icon
  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        'group/tile relative rounded-xl border border-white/10 p-2.5 flex flex-col gap-1.5 text-left',
        'bg-gradient-to-br',
        visual.gradient,
        'hover:border-white/30 hover:brightness-110 active:scale-[0.98] transition-[border-color,filter,transform] duration-100',
      )}
      title={stage.blurb}
    >
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/55">
          {locale === 'vi' ? 'Bài' : 'Lesson'} {index + 1}
        </div>
        {passed && (
          <div className="shrink-0 h-5 w-5 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-200" />
          </div>
        )}
      </div>
      <Icon className={cn('h-5 w-5', visual.color)} />
      <div className="text-xs font-semibold text-white leading-tight line-clamp-2">{stage.title}</div>
      <div className="mt-auto flex items-center justify-between text-[9px] tabular-nums">
        {result ? (
          <>
            <span className="text-amber-200">{result.bestWpm}wpm</span>
            <span className="text-white/55">{result.bestAccuracy}%</span>
          </>
        ) : (
          <span className="text-white/40">
            ≥{stage.minAccuracy}%{stage.minWpm ? ` · ${stage.minWpm}wpm` : ''}
          </span>
        )}
      </div>
      {passedDate && (
        <div className="text-[9px] text-emerald-300/80 -mt-0.5">
          {locale === 'vi' ? 'Đạt' : 'Passed'} {passedDate}
        </div>
      )}
    </button>
  )
}

function ChallengeTile({
  challenge,
  onPlay,
  bestLabel,
}: {
  challenge: Challenge
  onPlay: () => void
  bestLabel?: string
}) {
  const Icon = challenge.icon
  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        'group/tile relative rounded-xl border border-white/10 p-3 flex flex-col gap-1.5 text-left',
        'bg-gradient-to-br',
        challenge.gradient,
        'hover:border-white/30 hover:brightness-110 active:scale-[0.98] transition-[border-color,filter,transform] duration-100',
      )}
      title={challenge.blurb}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn('h-5 w-5', challenge.color)} />
        {bestLabel && (
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-200">
            <Trophy className="h-2.5 w-2.5" />
            {bestLabel}
          </div>
        )}
      </div>
      <div className="text-xs font-semibold text-white leading-tight">{challenge.title}</div>
      <div className="text-[10px] text-white/60 line-clamp-2 leading-snug">{challenge.blurb}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-white/75">
        <Zap className="h-2.5 w-2.5" />
        {challenge.key === 'endless' ? 'No timer' : '5 lives'}
      </div>
    </button>
  )
}
