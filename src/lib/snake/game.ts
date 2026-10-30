export const BOARD_SIZES = {
  '16x16': { cols: 16, rows: 16 },
  '20x20': { cols: 20, rows: 20 },
  '28x20': { cols: 28, rows: 20 },
  '32x24': { cols: 32, rows: 24 },
} as const
export type BoardSize = keyof typeof BOARD_SIZES
export type Pt = { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type SpeedMode = 'constant' | 'capped' | 'endless'
export type Arena = 'basic' | 'walls' | 'obstacles'
export type FruitKind = 'apple' | 'coconut' | 'mango' | 'durian'
export type Options = { difficulty: Difficulty; speedMode: SpeedMode; arena: Arena; rivals: boolean; size: BoardSize }
export type Fruit = Pt & { kind: FruitKind; expiresAt: number | null }
export type Rival = { snake: Pt[]; dir: Dir }
export type GameState = {
  options: Options
  cols: number
  rows: number
  snake: Pt[]
  dir: Dir
  pendingDir: Dir
  food: Fruit | null
  bonuses: Fruit[]
  obstacles: Pt[]
  rivals: Rival[]
  score: number
  eaten: number
  regularEaten: number
  elapsed: number
  lastRivalStep: number
  over: boolean
  won: boolean
}

export const DEFAULT_OPTIONS: Options = {
  difficulty: 'medium', speedMode: 'capped', arena: 'basic', rivals: false, size: '20x20',
}
export const FRUITS = {
  apple: { points: 1, lifetime: 0, chance: 1 },
  coconut: { points: 5, lifetime: 10000, chance: 1 },
  mango: { points: 10, lifetime: 7000, chance: 0.15 },
  durian: { points: 25, lifetime: 4000, chance: 0.05 },
} as const
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
export const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y
export const dirVec = (d: Dir): Pt => ({
  x: d === 'right' ? 1 : d === 'left' ? -1 : 0,
  y: d === 'down' ? 1 : d === 'up' ? -1 : 0,
})
const outside = (p: Pt, cols: number, rows: number) => p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows

export function stepInterval(st: GameState): number {
  const base = { easy: 180, medium: 130, hard: 95 }[st.options.difficulty]
  if (st.options.speedMode === 'constant') return base
  const interval = base / (1 + st.eaten * 0.08)
  return st.options.speedMode === 'capped' ? Math.max(55, interval) : interval
}

export function makeObstacles(layout: number, cols = 20, rows = 20): Pt[] {
  const cells: Pt[] = []
  // Open-ended structures leave wide corridors and the starting row clear.
  for (let i = 0; i < 5; i++) {
    if (layout === 0) cells.push({ x: 4 + i, y: 5 }, { x: 11 + i, y: 14 })
    else if (layout === 1) cells.push({ x: 4, y: 3 + i }, { x: 15, y: 12 + i })
    else cells.push({ x: 4 + i, y: 4 }, { x: 11 + i, y: 15 })
  }
  if (layout === 2) {
    for (let i = 1; i < 4; i++) cells.push({ x: 4, y: 4 + i }, { x: 15, y: 15 - i })
  }
  const scaled: Pt[] = []
  for (const p of cells) {
    const left = Math.floor(p.x * cols / 20)
    const top = Math.floor(p.y * rows / 20)
    const right = Math.max(left, Math.floor((p.x + 1) * cols / 20) - 1)
    const bottom = Math.max(top, Math.floor((p.y + 1) * rows / 20) - 1)
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) scaled.push({ x, y })
    }
  }
  return scaled.filter((p, i) => scaled.findIndex((other) => same(p, other)) === i)
}

export function freeCell(blocked: Pt[], random = Math.random, cols = 20, rows = 20): Pt | null {
  const occupied = new Set(blocked.map((p) => p.y * cols + p.x))
  const free: Pt[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied.has(y * cols + x)) free.push({ x, y })
    }
  }
  return free.length ? free[Math.floor(random() * free.length)] : null
}

function occupied(st: GameState): Pt[] {
  return [...st.snake, ...st.obstacles, ...st.rivals.flatMap((r) => r.snake),
    ...st.bonuses, ...(st.food ? [st.food] : [])]
}

function spawnBonus(st: GameState, kind: Exclude<FruitKind, 'apple'>, random: () => number) {
  if (kind !== 'coconut' && st.bonuses.some((f) => f.kind === kind)) return
  const cell = freeCell(occupied(st), random, st.cols, st.rows)
  if (cell) st.bonuses.push({ ...cell, kind, expiresAt: st.elapsed + FRUITS[kind].lifetime })
}

export function initial(options: Partial<Options> = DEFAULT_OPTIONS, random = Math.random): GameState {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const { cols, rows } = BOARD_SIZES[settings.size]
  const center = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }
  const st: GameState = {
    options: settings, cols, rows,
    snake: Array.from({ length: 4 }, (_, i) => ({ x: center.x - i, y: center.y })),
    dir: 'right', pendingDir: 'right', food: null, bonuses: [],
    obstacles: settings.arena === 'obstacles' ? makeObstacles(Math.floor(random() * 3), cols, rows) : [],
    rivals: [], score: 0, eaten: 0, regularEaten: 0, elapsed: 0, lastRivalStep: 0,
    over: false, won: false,
  }
  if (settings.rivals) {
    const count = 1 + Math.floor(random() * 2)
    for (let n = 0; n < count; n++) {
      const length = 3 + Math.floor(random() * 3)
      const candidates: Pt[][] = []
      const blocked = occupied(st)
      for (let y = 2; y < rows - 2; y++) {
        for (let x = length; x < cols - 2; x++) {
          const body = Array.from({ length }, (_, i) => ({ x: x - i, y }))
          if (body.every((p) => Math.abs(p.x - center.x) + Math.abs(p.y - center.y) >= 6 &&
            !blocked.some((b) => same(p, b)))) candidates.push(body)
        }
      }
      if (candidates.length) st.rivals.push({ snake: candidates[Math.floor(random() * candidates.length)], dir: 'right' })
    }
  }
  const cell = freeCell(occupied(st), random, st.cols, st.rows)
  if (cell) st.food = { ...cell, kind: 'apple', expiresAt: null }
  return st
}

export function nextCell(head: Pt, dir: Dir, arena: Arena, cols = 20, rows = 20): Pt {
  const v = dirVec(dir)
  const p = { x: head.x + v.x, y: head.y + v.y }
  return arena === 'basic' ? { x: (p.x + cols) % cols, y: (p.y + rows) % rows } : p
}

export function advanceTime(st: GameState, delta: number, random = Math.random) {
  if (st.over) return
  st.elapsed += delta
  st.bonuses = st.bonuses.filter((f) => f.expiresAt! > st.elapsed)
  if (st.elapsed - st.lastRivalStep < 240) return
  st.lastRivalStep = st.elapsed
  for (const rival of [...st.rivals]) {
    const blocked = [...st.obstacles, ...st.snake, ...st.bonuses, ...(st.food ? [st.food] : []),
      ...st.rivals.flatMap((r) => r === rival ? r.snake.slice(0, -1) : r.snake)]
    const directions = (Object.keys(OPPOSITE) as Dir[]).filter((d) => {
      const next = nextCell(rival.snake[0], d, st.options.arena, st.cols, st.rows)
      return d !== OPPOSITE[rival.dir] && !outside(next, st.cols, st.rows) && !blocked.some((p) => same(p, next))
    })
    if (!directions.length) {
      // A trapped rival leaves instead of permanently blocking a corridor.
      st.rivals = st.rivals.filter((r) => r !== rival)
      continue
    }
    const dir = directions.includes(rival.dir) && random() < 0.7
      ? rival.dir : directions[Math.floor(random() * directions.length)]
    rival.dir = dir
    rival.snake.unshift(nextCell(rival.snake[0], dir, st.options.arena, st.cols, st.rows))
    rival.snake.pop()
  }
}

export function step(st: GameState, random = Math.random) {
  if (st.over) return
  st.dir = st.pendingDir
  const next = nextCell(st.snake[0], st.dir, st.options.arena, st.cols, st.rows)
  const regular = st.food && same(next, st.food)
  const bonus = st.bonuses.find((f) => same(next, f))
  const fruit = regular ? st.food : bonus
  const body = fruit ? st.snake : st.snake.slice(0, -1)
  if (outside(next, st.cols, st.rows) || [...body, ...st.obstacles, ...st.rivals.flatMap((r) => r.snake)].some((p) => same(p, next))) {
    st.over = true
    return
  }
  st.snake.unshift(next)
  if (!fruit) {
    st.snake.pop()
    return
  }
  st.eaten++
  st.score += FRUITS[fruit.kind].points
  if (regular) {
    st.regularEaten++
    st.food = null
    // Reserve the permanent fruit's cell before allocating any bonuses.
    let cell = freeCell(occupied(st), random, st.cols, st.rows)
    if (!cell && st.bonuses.length) {
      st.bonuses.pop()
      cell = freeCell(occupied(st), random, st.cols, st.rows)
    }
    if (!cell) {
      st.over = true
      st.won = true
      return
    }
    st.food = { ...cell, kind: 'apple', expiresAt: null }
    if (st.regularEaten % 6 === 0) spawnBonus(st, 'coconut', random)
    if (random() < FRUITS.mango.chance) spawnBonus(st, 'mango', random)
    if (random() < FRUITS.durian.chance) spawnBonus(st, 'durian', random)
  } else {
    st.bonuses = st.bonuses.filter((f) => f !== bonus)
  }
}
