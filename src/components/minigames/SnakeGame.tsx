import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'

type Difficulty = 'easy' | 'medium' | 'hard'

const DIFF: Record<Difficulty, { base: number; accel: number; min: number }> = {
  easy: { base: 180, accel: 1.5, min: 110 },
  medium: { base: 130, accel: 2, min: 65 },
  hard: { base: 95, accel: 3, min: 45 },
}

const COLS = 20
const ROWS = 20
const CELL = 22
const W = COLS * CELL
const H = ROWS * CELL

type Pt = { x: number; y: number }
type Dir = 'up' | 'down' | 'left' | 'right'

type GameState = {
  snake: Pt[]
  dir: Dir
  pendingDir: Dir
  food: Pt
  score: number
  over: boolean
  lastStep: number
  stepInterval: number
  difficulty: Difficulty
}

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

function spawnFood(snake: Pt[]): Pt {
  while (true) {
    const f = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    }
    if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f
  }
}

function initial(diff: Difficulty = 'medium'): GameState {
  const snake: Pt[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ]
  return {
    snake,
    dir: 'right',
    pendingDir: 'right',
    food: spawnFood(snake),
    score: 0,
    over: false,
    lastStep: 0,
    stepInterval: DIFF[diff].base,
    difficulty: diff,
  }
}

export function SnakeGame() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const stateRef = useRef<GameState>(initial('medium'))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.snake)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const handleDir = useCallback((d: Dir) => {
    const { dir } = stateRef.current
    if (d !== OPPOSITE[dir]) stateRef.current.pendingDir = d
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
        W: 'up',
        S: 'down',
        A: 'left',
        D: 'right',
      }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      handleDir(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleDir])

  const start = useCallback(() => {
    stateRef.current = initial(difficulty)
    setScore(0)
    setOver(false)
    setRunning(true)
  }, [difficulty])

  useEffect(() => {
    if (!running) return
    let raf = 0

    const dirVec = (d: Dir): Pt => ({
      x: d === 'right' ? 1 : d === 'left' ? -1 : 0,
      y: d === 'down' ? 1 : d === 'up' ? -1 : 0,
    })

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current

      // background — checkered grass
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#062c1f')
      bg.addColorStop(1, '#022016')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.025)'
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
          }
        }
      }

      // food — apple
      const fx = st.food.x * CELL + CELL / 2
      const fy = st.food.y * CELL + CELL / 2
      const fr = CELL * 0.36
      // glow
      ctx.shadowBlur = 14
      ctx.shadowColor = 'rgba(244, 63, 94, 0.7)'
      // body
      const apple = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 2, fx, fy, fr)
      apple.addColorStop(0, '#fb7185')
      apple.addColorStop(1, '#be123c')
      ctx.fillStyle = apple
      ctx.beginPath()
      ctx.arc(fx, fy, fr, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.ellipse(fx - fr * 0.32, fy - fr * 0.38, fr * 0.18, fr * 0.32, -0.6, 0, Math.PI * 2)
      ctx.fill()
      // stem
      ctx.strokeStyle = '#5d3a1f'
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(fx, fy - fr + 1)
      ctx.lineTo(fx + 2, fy - fr - 4)
      ctx.stroke()
      // leaf
      ctx.fillStyle = '#16a34a'
      ctx.beginPath()
      ctx.ellipse(fx + 6, fy - fr - 2, 4, 2.2, 0.6, 0, Math.PI * 2)
      ctx.fill()

      // snake body
      const total = st.snake.length
      st.snake.forEach((seg, i) => {
        const isHead = i === 0
        const isTail = i === total - 1
        const cx = seg.x * CELL + CELL / 2
        const cy = seg.y * CELL + CELL / 2
        // taper: full radius for head, slightly smaller for body, smallest for tail
        const t = isTail ? 0.32 : isHead ? 0.46 : 0.44 - (i / total) * 0.08
        const r = CELL * t

        // glow on head
        if (isHead) {
          ctx.shadowBlur = 16
          ctx.shadowColor = 'rgba(34, 211, 238, 0.55)'
        }
        // body gradient — emerald / cyan
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r + 2)
        if (isHead) {
          grad.addColorStop(0, '#67e8f9')
          grad.addColorStop(1, '#0891b2')
        } else {
          grad.addColorStop(0, '#34d399')
          grad.addColorStop(1, '#047857')
        }
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // belly highlight
        if (!isTail) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          ctx.beginPath()
          ctx.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.45, r * 0.25, -0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // head decoration — eyes + tongue
      if (st.snake.length > 0) {
        const head = st.snake[0]
        const hx = head.x * CELL + CELL / 2
        const hy = head.y * CELL + CELL / 2
        const v = dirVec(st.dir)
        // eye positions: perpendicular to direction
        const px = -v.y
        const py = v.x
        const eyeDist = CELL * 0.22
        const eyeForward = CELL * 0.12
        const eyeR = CELL * 0.13
        const pupilR = CELL * 0.07
        for (const sign of [1, -1]) {
          const ex = hx + v.x * eyeForward + px * eyeDist * sign
          const ey = hy + v.y * eyeForward + py * eyeDist * sign
          // sclera
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(ex, ey, eyeR, 0, Math.PI * 2)
          ctx.fill()
          // pupil — looking forward
          const pxx = ex + v.x * eyeR * 0.35
          const pyy = ey + v.y * eyeR * 0.35
          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.arc(pxx, pyy, pupilR, 0, Math.PI * 2)
          ctx.fill()
          // pupil shine
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.beginPath()
          ctx.arc(pxx - pupilR * 0.3, pyy - pupilR * 0.3, pupilR * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
        // tongue — flicker every other step
        const flick = Math.floor(performance.now() / 220) % 2 === 0
        if (flick && !st.over) {
          const tipX = hx + v.x * CELL * 0.55
          const tipY = hy + v.y * CELL * 0.55
          const baseX = hx + v.x * CELL * 0.4
          const baseY = hy + v.y * CELL * 0.4
          ctx.strokeStyle = '#fb7185'
          ctx.lineWidth = 1.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(baseX, baseY)
          ctx.lineTo(tipX, tipY)
          ctx.stroke()
          // forked tip
          const fl = CELL * 0.12
          ctx.beginPath()
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(tipX + (v.y + v.x * 0.3) * fl, tipY + (-v.x + v.y * 0.3) * fl)
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(tipX + (-v.y + v.x * 0.3) * fl, tipY + (v.x + v.y * 0.3) * fl)
          ctx.stroke()
        }
      }
    }

    const step = () => {
      const st = stateRef.current
      if (st.over) return
      st.dir = st.pendingDir
      const head = st.snake[0]
      const next: Pt = {
        x: head.x + (st.dir === 'right' ? 1 : st.dir === 'left' ? -1 : 0),
        y: head.y + (st.dir === 'down' ? 1 : st.dir === 'up' ? -1 : 0),
      }
      if (
        next.x < 0 ||
        next.x >= COLS ||
        next.y < 0 ||
        next.y >= ROWS ||
        st.snake.some((s) => s.x === next.x && s.y === next.y)
      ) {
        st.over = true
        setOver(true)
        setRunning(false)
        recordScore('snake', st.score)
        return
      }
      st.snake.unshift(next)
      if (next.x === st.food.x && next.y === st.food.y) {
        st.score += 1
        setScore(st.score)
        const cfg = DIFF[st.difficulty]
        st.stepInterval = Math.max(cfg.min, cfg.base - st.score * cfg.accel)
        st.food = spawnFood(st.snake)
      } else {
        st.snake.pop()
      }
    }

    const loop = (t: number) => {
      const st = stateRef.current
      if (!st.lastStep) {
        st.lastStep = t
        draw()
        if (!st.over) raf = requestAnimationFrame(loop)
        return
      }
      while (t - st.lastStep >= st.stepInterval && !st.over) {
        step()
        st.lastStep += st.stepInterval
      }
      draw()
      if (!stateRef.current.over) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, recordScore])

  // idle background draw
  useEffect(() => {
    if (running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#062c1f')
    bg.addColorStop(1, '#022016')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
  }, [running])

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      <div
        className="relative flex-1 min-h-0 mx-auto w-full"
        style={{ aspectRatio: '1 / 1', maxHeight: 'calc(95vh - 220px)' }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none touch-none"
          onTouchStart={(e) => {
            const tch = e.changedTouches[0]
            touchStart.current = { x: tch.clientX, y: tch.clientY }
          }}
          onTouchEnd={(e) => {
            if (!touchStart.current) return
            const tch = e.changedTouches[0]
            const dx = tch.clientX - touchStart.current.x
            const dy = tch.clientY - touchStart.current.y
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
            if (Math.abs(dx) > Math.abs(dy)) handleDir(dx > 0 ? 'right' : 'left')
            else handleDir(dy > 0 ? 'down' : 'up')
            touchStart.current = null
          }}
        />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm rounded-xl gap-2">
            {over ? (
              <>
                <div className="text-2xl font-bold text-white drop-shadow">{t('minigame.gameOver')}</div>
                {score >= highScore && score > 0 && (
                  <div className="text-amber-300 text-sm font-medium">
                    ★ {t('minigame.newBest')}
                  </div>
                )}
                <Button onClick={start} className="mt-2">
                  <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <span>{t('minigame.difficulty')}:</span>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">{t('minigame.diffEasy')}</SelectItem>
                      <SelectItem value="medium">{t('minigame.diffMedium')}</SelectItem>
                      <SelectItem value="hard">{t('minigame.diffHard')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={start} size="lg" className="mt-1">
                  <Play className="h-5 w-5" /> {t('minigame.play')}
                </Button>
                <div className="text-[11px] text-white/70 mt-1">{t('minigame.snakeHint')}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
