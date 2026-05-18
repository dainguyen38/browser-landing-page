import { Trophy } from 'lucide-react'

interface Props {
  score: number
  best: number
  label?: string
  className?: string
}

export function ScoreBoard({ score, best, label = 'Score', className }: Props) {
  return (
    <div
      className={`flex items-stretch justify-between gap-4 px-5 py-3 rounded-2xl bg-gradient-to-br from-black/55 to-black/35 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${className ?? ''}`}
    >
      <div className="flex-1 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-medium">
          {label}
        </div>
        <div className="text-3xl font-extrabold tabular-nums text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] leading-tight">
          {score}
        </div>
      </div>
      <div className="w-px bg-white/15" />
      <div className="flex-1 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-medium flex items-center justify-center gap-1">
          <Trophy className="h-3 w-3 text-amber-300" />
          Best
        </div>
        <div className="text-3xl font-extrabold tabular-nums text-amber-300 drop-shadow-[0_2px_6px_rgba(217,119,6,0.5)] leading-tight">
          {best}
        </div>
      </div>
    </div>
  )
}
