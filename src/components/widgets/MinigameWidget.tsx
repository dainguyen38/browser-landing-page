import { useState } from 'react'
import { Gamepad2, Worm, Bird, Boxes, Grid3x3, Pickaxe, Grid2x2, type LucideIcon } from 'lucide-react'
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

  const activeGame = active ? GAMES.find((g) => g.key === active) : null
  const ActiveComp = activeGame?.Component

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
            <GameTile key={g.key} def={g} onPlay={() => setActive(g.key)} />
          ))}
        </div>
      </GlassCard>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl w-[min(95vw,720px)] max-h-[95vh] overflow-hidden p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeGame && <activeGame.icon className={`h-5 w-5 ${activeGame.color}`} />}
              {activeGame && t(`minigame.games.${activeGame.key}`)}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex flex-col">{ActiveComp && <ActiveComp />}</div>
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
