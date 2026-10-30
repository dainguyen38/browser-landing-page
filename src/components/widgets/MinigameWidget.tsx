import { useLayoutEffect, useRef, useState } from 'react'
import { Gamepad2, Worm, Bird, Boxes, Grid3x3, Pickaxe, Grid2x2, Play, X, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GameSessionContext, GameErrorBoundary, createGameSession, type GameSession } from '@/components/minigames/GameSession'
import { newSnapshot, validSnapshot } from '@/lib/minigame/snapshot'
import { gameKeyAction } from '@/lib/minigame/keyboard'
import { GlassCard } from '@/components/layout/GlassCard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SnakeGame } from '@/components/minigames/SnakeGame'
import { FlappyBird } from '@/components/minigames/FlappyBird'
import { Tetris } from '@/components/minigames/Tetris'
import { Sudoku } from '@/components/minigames/Sudoku'
import { GoldMiner } from '@/components/minigames/GoldMiner'
import { DinoGame } from '@/components/minigames/DinoGame'
import { Game2048 } from '@/components/minigames/Game2048'
import { type GameKey } from '@/store/minigame'
import { useT } from '@/i18n/useT'

// pixel-style T-Rex icon
const DinoIcon: LucideIcon = (({ className, ...props }: React.SVGAttributes<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
    <path d="M14 3h4v2h2v2h1v3h-1v2h-2v3h-2v3h-2v-3H10v-1H8v-2H6v-1h2v-1H7v-2h1V8h2V6h4V3zm1 4h1v1h-1V7z" />
  </svg>
)) as unknown as LucideIcon

type GameDef = {
  key: GameKey
  icon: LucideIcon
  /** gradient tile background */
  gradient: string
  /** icon color */
  color: string
  Component: () => JSX.Element
}

const GAMES: GameDef[] = [
  {
    key: 'snake',
    icon: Worm,
    gradient: 'from-emerald-500/30 to-cyan-500/20',
    color: 'text-emerald-200',
    Component: SnakeGame,
  },
  {
    key: 'flappy',
    icon: Bird,
    gradient: 'from-amber-500/30 to-orange-500/20',
    color: 'text-amber-200',
    Component: FlappyBird,
  },
  {
    key: 'tetris',
    icon: Boxes,
    gradient: 'from-violet-500/30 to-fuchsia-500/20',
    color: 'text-violet-200',
    Component: Tetris,
  },
  {
    key: 'sudoku',
    icon: Grid3x3,
    gradient: 'from-sky-500/30 to-indigo-500/20',
    color: 'text-sky-200',
    Component: Sudoku,
  },
  {
    key: 'goldminer',
    icon: Pickaxe,
    gradient: 'from-yellow-500/30 to-amber-700/20',
    color: 'text-yellow-200',
    Component: GoldMiner,
  },
  {
    key: 'dino',
    icon: DinoIcon,
    gradient: 'from-slate-500/30 to-zinc-700/20',
    color: 'text-slate-200',
    Component: DinoGame,
  },
  {
    key: 'g2048',
    icon: Grid2x2,
    gradient: 'from-orange-500/30 to-yellow-600/20',
    color: 'text-orange-200',
    Component: Game2048,
  },
]

export function MinigameWidget() {
  const { t } = useT()
  const [active, setActive] = useState<GameKey | null>(null)
  const [paused, setPaused] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const sessions = useRef(new Map<GameKey, GameSession>())
  const [fault, setFault] = useState(false)
  const [generation, setGeneration] = useState(0)

  const openGame = (game: GameKey) => {
    const cached = sessions.current.get(game)
    if (!cached || !cached.snapshot || typeof cached.fail !== 'function' || typeof cached.guard !== 'function' || !(cached.assets instanceof Map)) {
      const control = createGameSession(game, (current) => {
        setPaused(current.paused)
        setFault(current.error)
      })
      if (cached) { control.error = true; control.paused = true }
      sessions.current.set(game, control)
    } else {
      const control = sessions.current.get(game)!
      if (!validSnapshot(game, control.snapshot)) control.fail(new Error('Invalid game snapshot'))
    }
    const session = sessions.current.get(game)!
    session.visible = true
    setPaused(session.paused)
    setFault(session.error)
    setActive(game)
  }

  const closeGame = () => {
    if (active) {
      const session = sessions.current.get(active)!
      session.setPaused(true)
      session.visible = false
      if (validSnapshot(active, session.snapshot)) {
        session.snapshot = JSON.parse(JSON.stringify(session.snapshot))
      } else session.fail(new Error('Invalid game snapshot'))
    }
    setActive(null)
  }

  const resumeGame = () => {
    if (!active) return
    const session = sessions.current.get(active)!
    if (!validSnapshot(active, session.snapshot)) {
      session.fail(new Error('Invalid game snapshot'))
      return
    }
    session.setPaused(false)
    requestAnimationFrame(() => hostRef.current?.querySelector<HTMLCanvasElement>('canvas[tabindex]')?.focus())
  }

  const restartGame = () => {
    if (!active) return
    const session = sessions.current.get(active)!
    session.snapshot = newSnapshot(active)
    session.error = false
    session.setPaused(false)
    setFault(false)
    setGeneration((value) => value + 1)
  }

  useLayoutEffect(() => {
    if (hostRef.current) hostRef.current.inert = paused
    if (paused) resumeRef.current?.focus()
  }, [active, paused])

  const activeGame = active ? GAMES.find((g) => g.key === active) : null

  return (
    <>
      <GlassCard className="flex flex-col gap-3 min-h-0">
        <header className="flex items-center gap-2 pr-10 shrink-0">
          <Gamepad2 className="h-4 w-4 text-white/80" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('minigame.title')}
          </h2>
        </header>

        <div
          className="grid gap-3 flex-1 min-h-0 overflow-y-auto pr-1 content-start justify-center"
          style={{ gridTemplateColumns: 'repeat(auto-fit, 96px)' }}
        >
          {GAMES.map((g) => (
            <GameTile key={g.key} def={g} onPlay={() => openGame(g.key)} />
          ))}
        </div>
      </GlassCard>
      <Dialog open={!!active} onOpenChange={(open) => !open && closeGame()}>
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (event.repeat) { event.preventDefault(); return }
            if (active && gameKeyAction(active, sessions.current.get(active)!.paused, event.key) === 'pause') {
              event.preventDefault()
              sessions.current.get(active)!.setPaused(true)
            }
          }}
          onKeyDownCapture={(event) => {
            if (active !== 'snake' || event.key !== ' ' || fault) return
            const target = event.target as HTMLElement
            if (target.closest('[role="dialog"]') !== event.currentTarget || target.closest('input, textarea, select, [role=combobox], [contenteditable=true]')) return
            event.preventDefault()
            event.stopPropagation()
            if (event.repeat) return
            const session = sessions.current.get(active)!
            if (gameKeyAction(active, session.paused, event.key) === 'resume') resumeGame()
            else session.setPaused(true)
          }}
          className={`flex h-[94dvh] max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden rounded-2xl border-white/15 ${active === 'flappy' || active === 'snake' ? 'p-0 gap-0' : 'p-3 sm:p-5'} [&>button:last-child]:z-30 [&>button:last-child]:rounded-full [&>button:last-child]:bg-slate-950/50 [&>button:last-child]:p-2 [&>button:last-child]:text-white`}
          onOpenAutoFocus={(event) => {
            if (paused) {
              event.preventDefault()
              resumeRef.current?.focus()
            } else if (active === 'flappy') {
              event.preventDefault()
              document.getElementById('flappy-canvas')?.focus({ preventScroll: true })
            }
          }}
        >
          <DialogHeader className={active === 'flappy' || active === 'snake' ? 'sr-only' : 'shrink-0 pr-12'}>
            <DialogTitle className="flex items-center gap-2">
              {activeGame && <activeGame.icon className={`h-5 w-5 ${activeGame.color}`} />}
              {activeGame && t(`minigame.games.${activeGame.key}`)}
            </DialogTitle>
          </DialogHeader>
          <div ref={hostRef} className={`min-h-0 min-w-0 flex flex-1 flex-col ${active === 'flappy' || active === 'snake' ? 'w-full overflow-hidden' : 'overflow-auto'}`}>
            {activeGame && active && !fault && <GameSessionContext.Provider value={sessions.current.get(active)!}>
              <GameErrorBoundary key={`${active}:${generation}`} session={sessions.current.get(active)!}>
                <activeGame.Component />
              </GameErrorBoundary>
            </GameSessionContext.Provider>}
          </div>
          {(paused || fault) && <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto rounded-2xl bg-slate-950/80 p-4 backdrop-blur-md">
            <div className="m-auto flex max-w-sm flex-col items-center gap-4 text-center">
              <div role={fault ? 'alert' : 'status'} className="text-2xl font-bold text-white">{t(fault ? 'minigame.resumeFailed' : 'minigame.paused')}</div>
              {fault && <p className="text-sm leading-relaxed text-white/70">{t('minigame.resumeFailedHint')}</p>}
              {!fault && <Button ref={resumeRef} className="h-12 rounded-xl px-8" onClick={resumeGame}><Play className="h-5 w-5" />{t('minigame.resume')}</Button>}
              <Button ref={fault ? resumeRef : undefined} variant={fault ? 'default' : 'secondary'} className="h-11 rounded-xl px-6" onClick={restartGame}><RotateCcw className="h-4 w-4" />{t('minigame.newGame')}</Button>
              <Button variant="ghost" className="h-11 rounded-xl" onClick={closeGame}><X className="h-4 w-4" />{t('minigame.closeGame')}</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  )
}

function GameTile({ def, onPlay }: { def: GameDef; onPlay: () => void }) {
  const { t } = useT()
  const Icon = def.icon
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`w-24 h-24 rounded-xl border border-white/10 bg-gradient-to-br ${def.gradient} hover:border-white/30 hover:scale-[1.04] transition-all shadow-inner flex flex-col items-center justify-center gap-1.5 group/game`}
      title={t(`minigame.games.${def.key}`)}
    >
      <Icon
        className={`h-9 w-9 ${def.color} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] group-hover/game:scale-110 transition-transform`}
      />
      <span className="text-[10px] font-medium text-white/90 text-soft-shadow line-clamp-1 px-1">
        {t(`minigame.games.${def.key}`)}
      </span>
    </button>
  )
}
