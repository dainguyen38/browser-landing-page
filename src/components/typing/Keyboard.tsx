import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// Color zones map each key to the finger that should press it.
// 0=L pinky, 1=L ring, 2=L middle, 3=L index, 4=L thumb,
// 5=R thumb, 6=R index, 7=R middle, 8=R ring, 9=R pinky
const FINGER_COLOR: Record<number, string> = {
  0: 'bg-rose-500/25',     // L pinky
  1: 'bg-orange-500/25',   // L ring
  2: 'bg-amber-500/25',    // L middle
  3: 'bg-emerald-500/25',  // L index
  4: 'bg-slate-500/25',    // thumbs (space)
  5: 'bg-slate-500/25',
  6: 'bg-emerald-500/25',  // R index
  7: 'bg-amber-500/25',    // R middle
  8: 'bg-orange-500/25',   // R ring
  9: 'bg-rose-500/25',     // R pinky
}

const FINGER_OF_KEY: Record<string, number> = {
  // Row 1 (numbers)
  '`': 0, '1': 0, '2': 1, '3': 2, '4': 3, '5': 3, '6': 6, '7': 6, '8': 7, '9': 8, '0': 9, '-': 9, '=': 9,
  // Row 2
  q: 0, w: 1, e: 2, r: 3, t: 3, y: 6, u: 6, i: 7, o: 8, p: 9, '[': 9, ']': 9, '\\': 9,
  // Row 3 (home)
  a: 0, s: 1, d: 2, f: 3, g: 3, h: 6, j: 6, k: 7, l: 8, ';': 9, "'": 9,
  // Row 4
  z: 0, x: 1, c: 2, v: 3, b: 3, n: 6, m: 6, ',': 7, '.': 8, '/': 9,
  // Space
  ' ': 4,
}

type Row = { keys: string[]; widths?: Record<string, string> }

const LAYOUT: Row[] = [
  { keys: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'], widths: { '⌫': 'w-[60px]' } },
  { keys: ['⇥', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'], widths: { '⇥': 'w-[50px]' } },
  { keys: ['⇪', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '⏎'], widths: { '⇪': 'w-[60px]', '⏎': 'w-[70px]' } },
  { keys: ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '⇧'], widths: { '⇧': 'w-[70px]' } },
  { keys: ['␣'], widths: { '␣': 'w-[420px]' } },
]

interface Props {
  /** Set of keys currently held down (for press animation). Lowercased. */
  pressed?: Set<string>
  /** The next raw key the user should press (lowercase). Highlighted prominently. */
  nextKey?: string
  /** Subsequent keys to press after `nextKey` (the lookahead) — lighter highlight. */
  upcoming?: string[]
  /** Compact mode — smaller keys for tight spaces. */
  compact?: boolean
  className?: string
}

export function Keyboard({ pressed, nextKey, upcoming = [], compact = false, className }: Props) {
  const pressedKeys = useMemo(() => pressed ?? new Set<string>(), [pressed])
  const upcomingSet = useMemo(() => new Set(upcoming.slice(0, 4)), [upcoming])

  const keyBase = compact
    ? 'h-9 min-w-[34px] text-[11px]'
    : 'h-11 min-w-[42px] text-xs'

  return (
    <div
      className={cn(
        'typing-keyboard inline-flex flex-col items-center gap-1.5 select-none',
        className,
      )}
    >
      {LAYOUT.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.keys.map((k, ki) => {
            const lower = k.toLowerCase()
            const isLetter = /^[a-z`0-9\-=\[\]\\;',./ ]$/.test(lower)
            const finger = isLetter ? FINGER_OF_KEY[lower === '' ? ' ' : lower] : undefined
            const isNext = nextKey === lower
            const isUpcoming = upcomingSet.has(lower)
            const isPressed = pressedKeys.has(lower) || (k === '␣' && pressedKeys.has(' '))
            const fingerBg = finger !== undefined ? FINGER_COLOR[finger] : 'bg-white/5'
            const w = row.widths?.[k] ?? ''
            return (
              <div
                key={`${ri}-${ki}-${k}`}
                className={cn(
                  'relative inline-flex items-center justify-center rounded-md border border-white/10 px-2 font-medium tabular-nums',
                  keyBase,
                  w,
                  fingerBg,
                  isPressed && 'bg-primary/60 border-primary text-white scale-95',
                  isNext && !isPressed && 'ring-2 ring-amber-300 bg-amber-300/25 text-amber-100',
                  isUpcoming && !isNext && !isPressed && 'ring-1 ring-amber-300/40 text-amber-200/85',
                  'text-white/85 transition-[transform,background-color,border-color] duration-75',
                )}
              >
                {k}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
