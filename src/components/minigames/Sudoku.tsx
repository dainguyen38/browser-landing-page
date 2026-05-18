import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, CheckCircle2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'

type Difficulty = 'easy' | 'medium' | 'hard'

type Cell = {
  value: number // 0 = empty
  fixed: boolean
}

const N = 9

function emptyBoard(): number[][] {
  return Array.from({ length: N }, () => Array<number>(N).fill(0))
}

function clone<T>(grid: T[][]): T[][] {
  return grid.map((r) => [...r])
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  for (let i = 0; i < N; i++) {
    if (grid[row][i] === num || grid[i][col] === num) return false
  }
  const br = Math.floor(row / 3) * 3
  const bc = Math.floor(col / 3) * 3
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) if (grid[r][c] === num) return false
  return true
}

function solve(grid: number[][]): boolean {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
        for (const num of nums) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num
            if (solve(grid)) return true
            grid[r][c] = 0
          }
        }
        return false
      }
    }
  }
  return true
}

function generate(difficulty: Difficulty): { puzzle: Cell[][]; solution: number[][] } {
  const solution = emptyBoard()
  solve(solution)
  // remove cells
  const blanks: Record<Difficulty, number> = { easy: 35, medium: 45, hard: 54 }
  const target = blanks[difficulty]
  const puzzleGrid = clone(solution)
  const cells = shuffle(
    Array.from({ length: N * N }, (_, i) => i).map((i) => ({ r: Math.floor(i / N), c: i % N })),
  )
  let removed = 0
  for (const { r, c } of cells) {
    if (removed >= target) break
    puzzleGrid[r][c] = 0
    removed++
  }
  const puzzle: Cell[][] = puzzleGrid.map((row) =>
    row.map((v) => ({ value: v, fixed: v !== 0 })),
  )
  return { puzzle, solution }
}

function countErrors(board: Cell[][], solution: number[][]): number {
  let errors = 0
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = board[r][c].value
      if (v && !board[r][c].fixed && v !== solution[r][c]) errors++
    }
  }
  return errors
}

function isSolved(board: Cell[][], solution: number[][]): boolean {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c].value !== solution[r][c]) return false
    }
  }
  return true
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const DIFFICULTY_BONUS: Record<Difficulty, number> = { easy: 100, medium: 250, hard: 500 }

export function Sudoku() {
  const { t } = useT()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const initialPuzzle = useMemo(() => generate('easy'), [])
  const [board, setBoard] = useState<Cell[][]>(initialPuzzle.puzzle)
  const [solution, setSolution] = useState<number[][]>(initialPuzzle.solution)
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(true)
  const [solved, setSolved] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.sudoku)
  const recordScore = useMinigameStore((s) => s.recordScore)
  const claimedRef = useRef(false)

  const errors = useMemo(() => countErrors(board, solution), [board, solution])

  const newGame = useCallback(
    (diff: Difficulty) => {
      const { puzzle, solution } = generate(diff)
      setBoard(puzzle)
      setSolution(solution)
      setSelected(null)
      setSeconds(0)
      setRunning(true)
      setSolved(false)
      claimedRef.current = false
      setDifficulty(diff)
    },
    [],
  )

  // timer
  useEffect(() => {
    if (!running || solved) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [running, solved])

  // check solved
  useEffect(() => {
    if (solved || claimedRef.current) return
    if (isSolved(board, solution)) {
      setSolved(true)
      setRunning(false)
      const timeBonus = Math.max(0, 600 - seconds)
      const score = DIFFICULTY_BONUS[difficulty] + timeBonus - errors * 10
      recordScore('sudoku', Math.max(0, score))
      claimedRef.current = true
    }
  }, [board, solution, solved, seconds, errors, difficulty, recordScore])

  const setValue = useCallback(
    (r: number, c: number, v: number) => {
      setBoard((prev) => {
        if (prev[r][c].fixed) return prev
        const next = prev.map((row) => row.map((cell) => ({ ...cell })))
        next[r][c].value = v
        return next
      })
    },
    [],
  )

  // keyboard input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return
      if (!selected) return
      const { r, c } = selected
      if (e.key >= '1' && e.key <= '9') {
        setValue(r, c, parseInt(e.key, 10))
        e.preventDefault()
      } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        setValue(r, c, 0)
        e.preventDefault()
      } else if (e.key === 'ArrowUp') {
        setSelected({ r: Math.max(0, r - 1), c })
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        setSelected({ r: Math.min(8, r + 1), c })
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        setSelected({ r, c: Math.max(0, c - 1) })
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        setSelected({ r, c: Math.min(8, c + 1) })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, setValue])

  const selectedValue = selected ? board[selected.r][selected.c].value : 0

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-auto">
      <ScoreBoard score={errors === 0 && solved ? Math.max(0, DIFFICULTY_BONUS[difficulty] + Math.max(0, 600 - seconds) - errors * 10) : 0} best={highScore} label={t('minigame.score')} />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={difficulty} onValueChange={(v) => newGame(v as Difficulty)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t('minigame.diffEasy')}</SelectItem>
              <SelectItem value="medium">{t('minigame.diffMedium')}</SelectItem>
              <SelectItem value="hard">{t('minigame.diffHard')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={() => newGame(difficulty)}>
            <RotateCcw className="h-3.5 w-3.5" /> {t('minigame.newGame')}
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/85 tabular-nums">
          <span>⏱ {formatTime(seconds)}</span>
          <span className={cn(errors > 0 && 'text-rose-300')}>✗ {errors}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="grid grid-cols-9 bg-white/5 rounded-lg overflow-hidden border-2 border-white/30"
          style={{ width: 'min(100%, 420px)', aspectRatio: '1 / 1' }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = selected?.r === r && selected?.c === c
              const sameRow = selected?.r === r
              const sameCol = selected?.c === c
              const sameBox =
                selected &&
                Math.floor(selected.r / 3) === Math.floor(r / 3) &&
                Math.floor(selected.c / 3) === Math.floor(c / 3)
              const sameValue = selectedValue !== 0 && cell.value === selectedValue
              const isError =
                !cell.fixed && cell.value !== 0 && cell.value !== solution[r][c]
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => setSelected({ r, c })}
                  className={cn(
                    'aspect-square flex items-center justify-center font-semibold text-base sm:text-lg select-none transition-colors',
                    'border border-white/10',
                    c % 3 === 2 && c !== 8 && 'border-r-2 border-r-white/30',
                    r % 3 === 2 && r !== 8 && 'border-b-2 border-b-white/30',
                    cell.fixed ? 'text-white' : 'text-sky-300',
                    isError && 'text-rose-300 bg-rose-500/20',
                    !isSelected && !isError && sameValue && cell.value !== 0 && 'bg-sky-400/20',
                    !isSelected && !isError && (sameRow || sameCol || sameBox) && 'bg-white/[0.06]',
                    isSelected && 'bg-sky-500/40 ring-2 ring-sky-300 z-10',
                  )}
                >
                  {cell.value || ''}
                </button>
              )
            }),
          )}
        </div>

        <div className="grid grid-cols-9 gap-1.5 w-full max-w-[420px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => selected && setValue(selected.r, selected.c, n)}
              disabled={!selected || board[selected.r][selected.c].fixed}
              className="aspect-square flex items-center justify-center rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white font-semibold text-base disabled:opacity-40 disabled:pointer-events-none"
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={() => selected && setValue(selected.r, selected.c, 0)}
          disabled={!selected || board[selected.r][selected.c].fixed}
          className="text-xs text-white/70 hover:text-white disabled:opacity-40"
        >
          {t('minigame.erase')}
        </button>
      </div>

      {solved && (
        <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-emerald-500/20 border border-emerald-400/40">
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          <div className="font-semibold text-emerald-100">{t('minigame.sudokuWin')}</div>
          <div className="text-xs text-emerald-200/80">
            {t('minigame.time')}: {formatTime(seconds)} · {t('minigame.errors')}: {errors}
          </div>
          <Button onClick={() => newGame(difficulty)} size="sm" className="mt-1">
            {t('minigame.newGame')}
          </Button>
        </div>
      )}
    </div>
  )
}
