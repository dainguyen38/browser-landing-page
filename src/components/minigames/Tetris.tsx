import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'

const COLS = 10
const ROWS = 20
const CELL = 24
const W = COLS * CELL
const H = ROWS * CELL
const NEXT_W = 5 * CELL
const NEXT_H = 5 * CELL

type Piece = number[][] // rows × cols, 1=filled
type TetType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

const SHAPES: Record<TetType, Piece> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

const COLORS: Record<TetType, string> = {
  I: '#22d3ee',
  O: '#fde047',
  T: '#a78bfa',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
}

const TYPES: TetType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

type Board = (TetType | null)[][]

type ActivePiece = {
  type: TetType
  shape: Piece
  x: number
  y: number
}

function rotateCW(shape: Piece): Piece {
  const n = shape.length
  const next: Piece = Array.from({ length: n }, () => Array(n).fill(0))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) next[x][n - 1 - y] = shape[y][x]
  return next
}

function randType(): TetType {
  return TYPES[Math.floor(Math.random() * TYPES.length)]
}

function newPiece(type: TetType): ActivePiece {
  const shape = SHAPES[type].map((r) => [...r])
  const x = Math.floor((COLS - shape[0].length) / 2)
  return { type, shape, x, y: type === 'I' ? -1 : 0 }
}

function makeBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<TetType | null>(COLS).fill(null))
}

function collides(board: Board, p: ActivePiece, dx = 0, dy = 0, shape = p.shape): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue
      const bx = p.x + x + dx
      const by = p.y + y + dy
      if (bx < 0 || bx >= COLS || by >= ROWS) return true
      if (by >= 0 && board[by][bx]) return true
    }
  }
  return false
}

function mergePiece(board: Board, p: ActivePiece): Board {
  const out = board.map((r) => [...r])
  for (let y = 0; y < p.shape.length; y++) {
    for (let x = 0; x < p.shape[y].length; x++) {
      if (p.shape[y][x]) {
        const by = p.y + y
        const bx = p.x + x
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) out[by][bx] = p.type
      }
    }
  }
  return out
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((c) => !c))
  const cleared = ROWS - remaining.length
  while (remaining.length < ROWS) remaining.unshift(Array<TetType | null>(COLS).fill(null))
  return { board: remaining, cleared }
}

const SCORE_TABLE = [0, 100, 300, 500, 800]

function tickInterval(level: number, elapsedSec: number): number {
  const base = Math.max(80, 800 - (level - 1) * 70)
  // every 20 seconds played, drop ~12% of the current interval; floor 40ms
  const timeFactor = Math.pow(0.88, elapsedSec / 20)
  return Math.max(40, base * timeFactor)
}

type GameState = {
  board: Board
  active: ActivePiece
  next: TetType
  score: number
  lines: number
  level: number
  lastDrop: number
  startTime: number
  elapsedMs: number
  over: boolean
  paused: boolean
}

function initialState(): GameState {
  const firstType = randType()
  return {
    board: makeBoard(),
    active: newPiece(firstType),
    next: randType(),
    score: 0,
    lines: 0,
    level: 1,
    lastDrop: 0,
    startTime: 0,
    elapsedMs: 0,
    over: false,
    paused: false,
  }
}

export function Tetris() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nextRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(initialState())
  const elapsedRef = useRef(0)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [over, setOver] = useState(false)
  const [paused, setPaused] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const highScore = useMinigameStore((s) => s.highScores.tetris)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const start = useCallback(() => {
    stateRef.current = initialState()
    setScore(0)
    setLines(0)
    setLevel(1)
    setElapsed(0)
    setOver(false)
    setPaused(false)
    setRunning(true)
  }, [])

  const togglePause = useCallback(() => {
    if (!running) return
    stateRef.current.paused = !stateRef.current.paused
    setPaused(stateRef.current.paused)
  }, [running])

  const tryMove = useCallback((dx: number, dy: number) => {
    const st = stateRef.current
    if (st.over || st.paused) return false
    if (!collides(st.board, st.active, dx, dy)) {
      st.active = { ...st.active, x: st.active.x + dx, y: st.active.y + dy }
      return true
    }
    return false
  }, [])

  const rotate = useCallback(() => {
    const st = stateRef.current
    if (st.over || st.paused) return
    const next = rotateCW(st.active.shape)
    // wall kicks: try offsets 0, -1, 1, -2, 2
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(st.board, st.active, dx, 0, next)) {
        st.active = { ...st.active, shape: next, x: st.active.x + dx }
        return
      }
    }
  }, [])

  const lockPiece = useCallback(() => {
    const st = stateRef.current
    st.board = mergePiece(st.board, st.active)
    const { board: nb, cleared } = clearLines(st.board)
    st.board = nb
    if (cleared > 0) {
      st.score += SCORE_TABLE[cleared] * st.level
      st.lines += cleared
      st.level = Math.floor(st.lines / 10) + 1
      setScore(st.score)
      setLines(st.lines)
      setLevel(st.level)
    }
    // spawn next
    const nextActive = newPiece(st.next)
    st.next = randType()
    if (collides(st.board, nextActive)) {
      st.over = true
      setOver(true)
      setRunning(false)
      recordScore('tetris', st.score)
      return
    }
    st.active = nextActive
  }, [recordScore])

  const softDrop = useCallback(() => {
    if (!tryMove(0, 1)) lockPiece()
  }, [tryMove, lockPiece])

  const hardDrop = useCallback(() => {
    while (tryMove(0, 1)) {
      stateRef.current.score += 2
    }
    setScore(stateRef.current.score)
    lockPiece()
  }, [tryMove, lockPiece])

  // keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return
      if (!running) return
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          tryMove(-1, 0)
          e.preventDefault()
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          tryMove(1, 0)
          e.preventDefault()
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          softDrop()
          e.preventDefault()
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          rotate()
          e.preventDefault()
          break
        case ' ':
          hardDrop()
          e.preventDefault()
          break
        case 'p':
        case 'P':
          togglePause()
          e.preventDefault()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, tryMove, softDrop, hardDrop, rotate, togglePause])

  // game loop
  useEffect(() => {
    if (!running) return
    let raf = 0
    const drawCell = (ctx: CanvasRenderingContext2D, x: number, y: number, type: TetType, alpha = 1) => {
      const color = COLORS[type]
      const px = x * CELL
      const py = y * CELL
      ctx.globalAlpha = alpha
      // gradient block
      const grad = ctx.createLinearGradient(px, py, px + CELL, py + CELL)
      grad.addColorStop(0, lighten(color, 0.35))
      grad.addColorStop(1, darken(color, 0.25))
      ctx.fillStyle = grad
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
      // highlight top-left
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(px + 1, py + 1, CELL - 2, 3)
      ctx.fillRect(px + 1, py + 1, 3, CELL - 2)
      // shadow bottom-right
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(px + 1, py + CELL - 4, CELL - 2, 3)
      ctx.fillRect(px + CELL - 4, py + 1, 3, CELL - 2)
      ctx.globalAlpha = 1
    }
    const drawBoard = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current
      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0b1124')
      bg.addColorStop(1, '#020617')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath()
        ctx.moveTo(x * CELL, 0)
        ctx.lineTo(x * CELL, H)
        ctx.stroke()
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * CELL)
        ctx.lineTo(W, y * CELL)
        ctx.stroke()
      }
      // locked cells
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = st.board[y][x]
          if (c) drawCell(ctx, x, y, c)
        }
      }
      // ghost piece
      const ghost = { ...st.active }
      while (!collides(st.board, ghost, 0, 1)) ghost.y += 1
      for (let y = 0; y < ghost.shape.length; y++) {
        for (let x = 0; x < ghost.shape[y].length; x++) {
          if (ghost.shape[y][x]) {
            const px = (ghost.x + x) * CELL
            const py = (ghost.y + y) * CELL
            ctx.strokeStyle = COLORS[ghost.type] + '99'
            ctx.lineWidth = 2
            ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4)
          }
        }
      }
      // active piece
      for (let y = 0; y < st.active.shape.length; y++) {
        for (let x = 0; x < st.active.shape[y].length; x++) {
          if (st.active.shape[y][x]) {
            const bx = st.active.x + x
            const by = st.active.y + y
            if (by >= 0) drawCell(ctx, bx, by, st.active.type)
          }
        }
      }
      // next preview
      const nc = nextRef.current
      if (nc) {
        const nctx = nc.getContext('2d')!
        nctx.fillStyle = 'rgba(0,0,0,0.45)'
        nctx.fillRect(0, 0, NEXT_W, NEXT_H)
        const shape = SHAPES[st.next]
        const sw = shape[0].length
        const sh = shape.length
        const ox = Math.floor((NEXT_W - sw * CELL) / 2)
        const oy = Math.floor((NEXT_H - sh * CELL) / 2)
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (shape[y][x]) {
              const px = ox + x * CELL
              const py = oy + y * CELL
              const color = COLORS[st.next]
              const grad = nctx.createLinearGradient(px, py, px + CELL, py + CELL)
              grad.addColorStop(0, lighten(color, 0.35))
              grad.addColorStop(1, darken(color, 0.25))
              nctx.fillStyle = grad
              nctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
              nctx.fillStyle = 'rgba(255,255,255,0.3)'
              nctx.fillRect(px + 1, py + 1, CELL - 2, 2)
              nctx.fillRect(px + 1, py + 1, 2, CELL - 2)
            }
          }
        }
      }
    }
    const loop = (t: number) => {
      const st = stateRef.current
      if (!st.over && !st.paused) {
        if (!st.lastDrop) {
          st.lastDrop = t
          st.startTime = t
        }
        st.elapsedMs = t - st.startTime
        const interval = tickInterval(st.level, st.elapsedMs / 1000)
        if (t - st.lastDrop >= interval) {
          if (!tryMove(0, 1)) lockPiece()
          st.lastDrop = t
        }
      } else {
        // when resumed/unpaused: shift startTime so elapsed doesn't jump
        st.lastDrop = t
        if (st.startTime) st.startTime = t - st.elapsedMs
      }
      // sync elapsed seconds to UI ~ every 500ms
      const sec = Math.floor(st.elapsedMs / 1000)
      if (sec !== elapsedRef.current) {
        elapsedRef.current = sec
        setElapsed(sec)
      }
      drawBoard()
      if (!stateRef.current.over) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, tryMove, lockPiece])

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      <div className="flex gap-3 flex-1 min-h-0">
        <div
          className="relative mx-auto"
          style={{ aspectRatio: `${W} / ${H}`, height: 'min(calc(95vh - 240px), 560px)' }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none"
          />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm rounded-xl gap-2">
              {over ? (
                <>
                  <div className="text-2xl font-bold text-white drop-shadow">{t('minigame.gameOver')}</div>
                  {score >= highScore && score > 0 && (
                    <div className="text-amber-300 text-sm font-medium">★ {t('minigame.newBest')}</div>
                  )}
                  <Button onClick={start} className="mt-2">
                    <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={start} size="lg">
                    <Play className="h-5 w-5" /> {t('minigame.play')}
                  </Button>
                  <div className="text-[11px] text-white/70 mt-1 text-center max-w-[18rem]">
                    {t('minigame.tetrisHint')}
                  </div>
                </>
              )}
            </div>
          )}
          {paused && running && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm rounded-xl">
              <div className="text-xl font-bold text-white">{t('minigame.paused')}</div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 flex-shrink-0 w-32">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/55 mb-1">
              {t('minigame.next')}
            </div>
            <canvas
              ref={nextRef}
              width={NEXT_W}
              height={NEXT_H}
              className="w-full rounded-lg border border-white/15 bg-black/30"
            />
          </div>
          <Stat label={t('minigame.lines')} value={lines} />
          <Stat label={t('minigame.level')} value={level} />
          <Stat label={t('minigame.time')} value={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`} />
          <Stat
            label={t('minigame.speed')}
            value={`${Math.round((tickInterval(1, 0) / tickInterval(level, elapsed)) * 100)}%`}
          />
          {running && (
            <Button variant="secondary" size="sm" onClick={togglePause} className="mt-2">
              <Pause className="h-3.5 w-3.5" />
              {paused ? t('minigame.resume') : t('minigame.pause')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-widest text-white/55">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function lighten(hex: string, amt: number): string {
  return mix(hex, '#ffffff', amt)
}
function darken(hex: string, amt: number): string {
  return mix(hex, '#000000', amt)
}
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 0xff
  const ag = (pa >> 8) & 0xff
  const ab = pa & 0xff
  const br = (pb >> 16) & 0xff
  const bg = (pb >> 8) & 0xff
  const bb = pb & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bc = Math.round(ab + (bb - ab) * t)
  return `#${((r << 16) | (g << 8) | bc).toString(16).padStart(6, '0')}`
}
