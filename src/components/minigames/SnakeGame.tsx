import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'
import {
  BOARD_SIZES, DEFAULT_OPTIONS, FRUITS, OPPOSITE, initial, step,
  advanceTime, stepInterval, type Options, type Dir, type GameState,
} from '@/lib/snake/game'
import { SNAKE_STYLES, drawSnake, drawFruit, type SnakeStyle } from '@/lib/snake/render'

const CELL = 22
const FRUIT_ICONS = { apple: '🍎', coconut: '🥥', mango: '🥭', durian: '✹' }
const CHOICE_CLASS = 'min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 aria-pressed:border-emerald-300 aria-pressed:bg-emerald-300/15 aria-pressed:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'

function SnakePreview({ style }: { style: SnakeStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 96, 32)
    drawSnake(ctx, Array.from({ length: 6 }, (_, i) => ({ x: 6 - i, y: 0.8 })), 'right', style, 12)
  }, [style])
  return <canvas ref={ref} width={96} height={32} className="h-[22px] w-16" aria-hidden="true" />
}

export function SnakeGame() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS)
  const [snakeStyle, setSnakeStyle] = useState<SnakeStyle>('emerald')
  const { cols, rows } = BOARD_SIZES[options.size]
  const W = cols * CELL
  const H = rows * CELL
  const stateRef = useRef<GameState | null>(null)
  if (!stateRef.current) stateRef.current = initial()
  const customImgRef = useRef<HTMLImageElement | null>(null)
  const customUrlRef = useRef<string | null>(null)
  const uploadVersion = useRef(0)
  const [hasCustom, setHasCustom] = useState(false)
  const [headRevision, setHeadRevision] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.snake)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const handleDir = useCallback((d: Dir) => {
    const st = stateRef.current!
    if (d !== OPPOSITE[st.dir]) st.pendingDir = d
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement
      if (!running || (active instanceof HTMLElement && active.closest('input, textarea, select, [role=combobox], [contenteditable=true]'))) return
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
  }, [handleDir, running])

  const start = useCallback(() => {
    stateRef.current = initial(options)
    setScore(0)
    setOver(false)
    setRunning(true)
  }, [options])

  useEffect(() => () => {
    uploadVersion.current++
    if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
  }, [])

  const uploadHead = async (file: File) => {
    const version = ++uploadVersion.current
    setImageError(false)
    setImageLoading(false)
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setImageError(true)
      return
    }
    setImageLoading(true)
    const url = URL.createObjectURL(file)
    const img = new Image()
    try {
      img.src = url
      await img.decode()
      if (version !== uploadVersion.current) {
        URL.revokeObjectURL(url)
        return
      }
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
      customUrlRef.current = url
      customImgRef.current = img
      setHeadRevision((value) => value + 1)
      setHasCustom(true)
    } catch {
      URL.revokeObjectURL(url)
      if (version === uploadVersion.current) setImageError(true)
    } finally {
      if (version === uploadVersion.current) setImageLoading(false)
    }
  }

  useEffect(() => {
    let raf = 0

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current!

      // background — checkered grass
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#062c1f')
      bg.addColorStop(1, '#022016')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      for (let y = 0; y < st.rows; y++) {
        for (let x = 0; x < st.cols; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.025)'
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
          }
        }
      }

      // Obstacles and lethal arena boundaries use the same cells as collision checks.
      for (const p of st.obstacles) {
        ctx.fillStyle = '#64748b'
        ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2)
        ctx.fillStyle = '#94a3b8'
        ctx.fillRect(p.x * CELL + 3, p.y * CELL + 3, CELL - 6, 3)
      }
      if (st.options.arena !== 'basic') {
        ctx.strokeStyle = '#fb923c'
        ctx.lineWidth = 5
        ctx.strokeRect(2, 2, W - 4, H - 4)
      }
      for (const [index, rival] of st.rivals.entries()) {
        drawSnake(ctx, rival.snake, rival.dir, index === 0 ? 'gold' : 'candy', CELL)
      }
      if (st.food) drawFruit(ctx, st.food, CELL, st.elapsed)
      st.bonuses.forEach((fruit) => drawFruit(ctx, fruit, CELL, st.elapsed))
      drawSnake(ctx, st.snake, st.dir, snakeStyle, CELL, customImgRef.current)
    }

    let lastFrame = performance.now()
    let accumulated = 0
    const loop = (now: number) => {
      const st = stateRef.current!
      const delta = document.hidden ? 0 : Math.min(100, now - lastFrame)
      lastFrame = now
      advanceTime(st, delta)
      accumulated += delta
      const previousScore = st.score
      while (accumulated >= stepInterval(st) && !st.over) {
        const interval = stepInterval(st)
        step(st)
        accumulated -= interval
      }
      if (st.score !== previousScore) setScore(st.score)
      draw()
      if (st.over) {
        setOver(true)
        setRunning(false)
        recordScore('snake', st.score)
      } else raf = requestAnimationFrame(loop)
    }
    draw()
    if (running) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, recordScore, headRevision, snakeStyle, options, W, H])

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const chooseOptions = (next: Options) => {
    setOptions(next)
    stateRef.current = initial(next)
    setScore(0)
    setOver(false)
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      {!running && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4">
          {([
            ['difficulty', ['easy', 'medium', 'hard']],
            ['speedMode', ['constant', 'capped', 'endless']],
            ['arena', ['basic', 'walls', 'obstacles']],
            ['size', Object.keys(BOARD_SIZES)],
          ] as const).map(([key, values]) => (
            <div key={key} className="grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 sm:gap-3">
              <span id={`snake-${key}`} className="text-sm font-semibold text-white/90">{t(`minigame.snakeOptions.${key}`)}</span>
              <div role="group" aria-labelledby={`snake-${key}`} className="flex gap-2 overflow-x-auto pb-1">
                {values.map((value) => <button key={value} type="button" aria-pressed={options[key] === value}
                  className={`${CHOICE_CLASS} flex-1 px-3 sm:px-4`} onClick={() => chooseOptions({ ...options, [key]: value })}>
                  {key === 'size' ? value.replace('x', '×') : t(`minigame.snakeOptions.${value}`)}
                </button>)}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            <span id="snake-style" className="text-sm font-semibold text-white/90">{t('minigame.snakeOptions.style')}</span>
            <div role="group" aria-labelledby="snake-style" className="flex gap-2 overflow-x-auto pb-1">
              {SNAKE_STYLES.map((style) => <button key={style} type="button" aria-pressed={snakeStyle === style}
                className={`${CHOICE_CLASS} flex flex-1 flex-col items-center gap-1 px-2 py-2`} onClick={() => setSnakeStyle(style)}>
                <SnakePreview style={style} />{t(`minigame.snakeOptions.${style}`)}
              </button>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-sm">
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-5 w-5 accent-emerald-400" checked={options.rivals} onChange={(e) => chooseOptions({ ...options, rivals: e.target.checked })} />
              {t('minigame.snakeOptions.rivals')}
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 cursor-pointer focus-within:ring-2 focus-within:ring-white/60">
              <Upload className="h-3.5 w-3.5" /> {t('minigame.snakeOptions.customHead')}
              <input type="file" accept="image/*" className="sr-only" disabled={imageLoading} onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadHead(file)
                e.target.value = ''
              }} />
            </label>
            {hasCustom && <Button variant="ghost" size="sm" className="h-11 text-sm" onClick={() => {
              uploadVersion.current++
              customImgRef.current = null
              if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
              customUrlRef.current = null
              setHasCustom(false)
              setHeadRevision((value) => value + 1)
              setImageError(false)
              setImageLoading(false)
            }}><X className="h-3.5 w-3.5" />{t('minigame.snakeOptions.resetHead')}</Button>}
            {hasCustom && customUrlRef.current && <img src={customUrlRef.current} alt={t('minigame.snakeOptions.customHead')} className="h-10 w-10 rounded-full object-cover" />}
          </div>
          {imageError && <p role="alert" className="text-sm text-rose-300">{t('minigame.snakeOptions.imageError')}</p>}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2 text-sm text-white/80">
        {(Object.keys(FRUITS) as (keyof typeof FRUITS)[]).map((kind) => (
          <span key={kind} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">{FRUIT_ICONS[kind]} {t(`minigame.snakeOptions.${kind}`)} +{FRUITS[kind].points}
          </span>
        ))}
      </div>
      <div className="relative mx-auto w-full shrink-0" style={{ aspectRatio: `${cols} / ${rows}`, maxWidth: `min(100%, calc((95dvh - 180px) * ${cols} / ${rows}))` }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          role="img"
          aria-label={t('minigame.games.snake')}
          className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none touch-none"
          onTouchStart={(e) => {
            const tch = e.changedTouches[0]
            touchStart.current = { x: tch.clientX, y: tch.clientY }
          }}
          onTouchEnd={(e) => {
            if (!touchStart.current || !running) return
            const tch = e.changedTouches[0]
            const dx = tch.clientX - touchStart.current.x
            const dy = tch.clientY - touchStart.current.y
            touchStart.current = null
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
            if (Math.abs(dx) > Math.abs(dy)) handleDir(dx > 0 ? 'right' : 'left')
            else handleDir(dy > 0 ? 'down' : 'up')
          }}
        />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 rounded-xl gap-3 p-3 text-center">
            {over && <>
              <div className="text-2xl font-bold text-white drop-shadow">{t(stateRef.current.won ? 'minigame.snakeOptions.won' : 'minigame.gameOver')}</div>
              {score >= highScore && score > 0 && <div className="text-amber-300 text-sm font-medium">★ {t('minigame.newBest')}</div>}
            </>}
            <Button onClick={start} size="lg" className="min-h-12 px-8 text-base" disabled={imageLoading}>
              {over ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {t(over ? 'minigame.playAgain' : 'minigame.play')}
            </Button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-white/60">{t('minigame.snakeHint')}</p>
      {!running && <p className="text-center text-xs leading-relaxed text-white/55">{t('minigame.snakeOptions.rules')}</p>}
    </div>
  )
}
