import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'
import { cn } from '@/lib/utils'

const SIZE = 4
type Board = number[][]
type Dir = 'up' | 'down' | 'left' | 'right'

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
}

function clone(b: Board): Board {
  return b.map((r) => [...r])
}

function emptyCells(b: Board): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (b[r][c] === 0) cells.push({ r, c })
  return cells
}

function spawn(b: Board): Board {
  const cells = emptyCells(b)
  if (cells.length === 0) return b
  const next = clone(b)
  const { r, c } = cells[Math.floor(Math.random() * cells.length)]
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function newGame(): Board {
  return spawn(spawn(emptyBoard()))
}

function slide(line: number[]): { line: number[]; gained: number } {
  const nz = line.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < nz.length; i++) {
    if (i + 1 < nz.length && nz[i] === nz[i + 1]) {
      const merged = nz[i] * 2
      out.push(merged)
      gained += merged
      i++
    } else {
      out.push(nz[i])
    }
  }
  while (out.length < SIZE) out.push(0)
  return { line: out, gained }
}

function move(board: Board, dir: Dir): { board: Board; gained: number; changed: boolean } {
  const b = clone(board)
  let gained = 0
  if (dir === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { line, gained: g } = slide(b[r])
      b[r] = line
      gained += g
    }
  } else if (dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { line, gained: g } = slide([...b[r]].reverse())
      b[r] = line.reverse()
      gained += g
    }
  } else if (dir === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = [b[0][c], b[1][c], b[2][c], b[3][c]]
      const { line, gained: g } = slide(col)
      for (let r = 0; r < SIZE; r++) b[r][c] = line[r]
      gained += g
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const col = [b[3][c], b[2][c], b[1][c], b[0][c]]
      const { line, gained: g } = slide(col)
      for (let r = 0; r < SIZE; r++) b[3 - r][c] = line[r]
      gained += g
    }
  }
  let changed = false
  for (let r = 0; r < SIZE && !changed; r++)
    for (let c = 0; c < SIZE; c++) if (b[r][c] !== board[r][c]) changed = true
  return { board: b, gained, changed }
}

function hasValue(b: Board, v: number): boolean {
  return b.some((row) => row.some((x) => x === v))
}

function isGameOver(b: Board): boolean {
  if (emptyCells(b).length > 0) return false
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c]
      if (c + 1 < SIZE && b[r][c + 1] === v) return false
      if (r + 1 < SIZE && b[r + 1][c] === v) return false
    }
  return true
}

const TILE_STYLES: Record<number, { bg: string; text: string }> = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
}

function tileStyle(v: number) {
  return TILE_STYLES[v] ?? { bg: '#3c3a32', text: '#f9f6f2' }
}

function tileFontSize(v: number, cell: number): number {
  const d = String(v).length
  if (d <= 2) return Math.round(cell * 0.44)
  if (d === 3) return Math.round(cell * 0.34)
  return Math.round(cell * 0.26)
}

const MIN_CELL = 44
const MAX_CELL = 100
const GAP = 8
const PAD = 8
const CELL_KEY = 'landing.2048.cell'

function loadCell(): number {
  const v = Number(localStorage.getItem(CELL_KEY))
  return Number.isFinite(v) && v >= MIN_CELL && v <= MAX_CELL ? v : 72
}

export function Game2048() {
  const { t } = useT()
  const [board, setBoard] = useState<Board>(newGame)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [keepGoing, setKeepGoing] = useState(false)
  const high = useMinigameStore((s) => s.highScores.g2048)
  const record = useMinigameStore((s) => s.recordScore)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [cellSize, setCellSize] = useState<number>(loadCell)

  const setCell = (n: number) => {
    const v = Math.max(MIN_CELL, Math.min(MAX_CELL, n))
    setCellSize(v)
    try {
      localStorage.setItem(CELL_KEY, String(v))
    } catch {
      /* ignore */
    }
  }

  const boardSize = cellSize * SIZE + GAP * (SIZE - 1) + PAD * 2

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return
      const { board: nb, gained, changed } = move(board, dir)
      if (!changed) return
      const withTile = spawn(nb)
      const newScore = score + gained
      setBoard(withTile)
      setScore(newScore)
      if (!won && hasValue(withTile, 2048)) setWon(true)
      if (isGameOver(withTile)) {
        setOver(true)
        record('g2048', newScore)
      }
    },
    [board, score, over, won, record],
  )

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
      doMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  const restart = () => {
    setBoard(newGame())
    setScore(0)
    setOver(false)
    setWon(false)
    setKeepGoing(false)
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center gap-2">
        <ScoreBoard score={score} best={high} label={t('minigame.score')} className="flex-1" />
        <Button variant="secondary" onClick={restart} className="h-full px-3" aria-label={t('minigame.newGame')}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Cell size control */}
      <div className="flex items-center gap-2 text-xs text-white/75 shrink-0">
        <span className="shrink-0">{t('minigame.cellSize')}</span>
        <input
          type="range"
          min={MIN_CELL}
          max={MAX_CELL}
          value={cellSize}
          onChange={(e) => setCell(parseInt(e.target.value, 10))}
          className="flex-1 accent-orange-400"
        />
        <span className="w-14 text-right tabular-nums">
          {cellSize}×{cellSize}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center">
        <div className="relative" style={{ width: boardSize }}>
          <div
            className="rounded-xl select-none touch-none"
            style={{ background: '#bbada0', padding: PAD }}
            onTouchStart={(e) => {
              const tch = e.changedTouches[0]
              touchStart.current = { x: tch.clientX, y: tch.clientY }
            }}
            onTouchEnd={(e) => {
              if (!touchStart.current) return
              const tch = e.changedTouches[0]
              const dx = tch.clientX - touchStart.current.x
              const dy = tch.clientY - touchStart.current.y
              if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
              if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left')
              else doMove(dy > 0 ? 'down' : 'up')
              touchStart.current = null
            }}
          >
            <div
              className="grid"
              style={{
                gap: GAP,
                gridTemplateColumns: `repeat(${SIZE}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${SIZE}, ${cellSize}px)`,
              }}
            >
              {board.flatMap((row, r) =>
                row.map((v, c) => {
                  if (v === 0) {
                    return (
                      <div
                        key={`${r}-${c}-empty`}
                        className="rounded-md"
                        style={{ background: 'rgba(238,228,218,0.25)' }}
                      />
                    )
                  }
                  const st = tileStyle(v)
                  return (
                    <div
                      key={`${r}-${c}-${v}`}
                      className="rounded-md flex items-center justify-center font-bold tabular-nums animate-fade-in shadow-sm"
                      style={{
                        background: st.bg,
                        color: st.text,
                        fontSize: tileFontSize(v, cellSize),
                      }}
                    >
                      {v}
                    </div>
                  )
                }),
              )}
            </div>
          </div>

        {/* Win overlay (can keep going) */}
        {won && !keepGoing && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-400/85 rounded-xl gap-2">
            <Trophy className="h-9 w-9 text-amber-900" />
            <div className="text-2xl font-bold text-amber-950">2048! 🎉</div>
            <div className="flex gap-2 mt-1">
              <Button onClick={() => setKeepGoing(true)} variant="secondary">
                {t('minigame.keepGoing')}
              </Button>
              <Button onClick={restart}>
                <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
              </Button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm rounded-xl gap-2">
            <div className="text-2xl font-bold text-white drop-shadow">{t('minigame.gameOver')}</div>
            {score >= high && score > 0 && (
              <div className="text-amber-300 text-sm font-medium">★ {t('minigame.newBest')}</div>
            )}
            <Button onClick={restart} className="mt-2">
              <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
            </Button>
          </div>
        )}
        </div>
      </div>

      <div className={cn('text-center text-[11px] text-white/60')}>{t('minigame.g2048Hint')}</div>
    </div>
  )
}
