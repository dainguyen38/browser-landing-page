import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/snake/game.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const gameUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { initial, step, advanceTime, stepInterval, freeCell, makeObstacles, nextCell, same, FRUITS, DEFAULT_OPTIONS, BOARD_SIZES } =
  await import(gameUrl)

function game(options = {}) {
  return initial({ ...DEFAULT_OPTIONS, ...options }, () => 0.99)
}

function eatRegular(st, random = () => 0.99) {
  const next = nextCell(st.snake[0], st.pendingDir, st.options.arena, st.cols, st.rows)
  st.food = { ...next, kind: 'apple', expiresAt: null }
  step(st, random)
}

test('every six regular apples spawn a coconut; the regular fruit stays available', () => {
  const st = game()
  for (let i = 0; i < 5; i++) eatRegular(st)
  assert.equal(st.bonuses.length, 0)
  eatRegular(st)
  assert.equal(st.score, 6)
  assert.equal(st.bonuses.length, 1)
  assert.equal(st.bonuses[0].kind, 'coconut')
  assert.equal(st.bonuses[0].expiresAt, 10000)
  assert.ok(st.food)
  for (let i = 0; i < 6; i++) eatRegular(st)
  assert.equal(st.bonuses.filter((f) => f.kind === 'coconut').length, 2)
})

test('random bonuses respect rarity thresholds and never overlap occupied cells', () => {
  for (const [roll, expected] of [[0.2, []], [0.1, ['mango']], [0.01, ['mango', 'durian']]]) {
    const st = game()
    st.regularEaten = 5
    eatRegular(st, () => roll)
    assert.deepEqual(st.bonuses.filter((f) => f.kind !== 'coconut').map((f) => f.kind), expected)
    const cells = [...st.snake, st.food, ...st.bonuses].map((p) => `${p.x},${p.y}`)
    assert.equal(new Set(cells).size, cells.length)
  }
  assert.ok(FRUITS.coconut.points < FRUITS.mango.points && FRUITS.mango.points < FRUITS.durian.points)
  assert.ok(FRUITS.mango.chance < 1 / 6 && FRUITS.durian.chance < FRUITS.mango.chance)
})

test('bonuses expire in rarity order, but regular apples never expire', () => {
  const st = game()
  eatRegular(st, () => 0)
  st.bonuses.push({ x: 0, y: 1, kind: 'coconut', expiresAt: 10000 })
  const food = st.food
  advanceTime(st, 4000)
  assert.deepEqual(st.bonuses.map((f) => f.kind), ['mango', 'coconut'])
  advanceTime(st, 3000)
  assert.deepEqual(st.bonuses.map((f) => f.kind), ['coconut'])
  advanceTime(st, 3000)
  assert.equal(st.bonuses.length, 0)
  assert.equal(st.food, food)
})

test('each bonus awards its own points without advancing the six-apple counter', () => {
  for (const kind of ['coconut', 'mango', 'durian']) {
    const st = game()
    const food = st.food
    st.bonuses.push({ x: 11, y: 10, kind, expiresAt: FRUITS[kind].lifetime })
    step(st)
    assert.equal(st.score, FRUITS[kind].points)
    assert.equal(st.regularEaten, 0)
    assert.equal(st.eaten, 1)
    assert.equal(st.snake.length, 5)
    assert.equal(st.bonuses.length, 0)
    assert.equal(st.food, food)
  }
})

test('difficulty selects initial speed for all speed modes; only capped mode has a ceiling', () => {
  for (const mode of ['constant', 'capped', 'endless']) {
    const starts = ['easy', 'medium', 'hard'].map((difficulty) => stepInterval(game({ difficulty, speedMode: mode })))
    assert.deepEqual(starts, [180, 130, 95])
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const st = game({ difficulty, speedMode: mode })
      const base = stepInterval(st)
      st.eaten = 1000
      const faster = stepInterval(st)
      st.eaten = 2000
      if (mode === 'constant') assert.equal(stepInterval(st), base)
      else if (mode === 'capped') assert.equal(stepInterval(st), 55)
      else {
        assert.ok(faster < 55)
        assert.ok(stepInterval(st) < faster)
        assert.ok(stepInterval(st) > 0)
      }
    }
  }
})

test('basic arena wraps every edge; walls and obstacle arenas kill at every edge', () => {
  for (const [head, dir, expected] of [
    [{ x: 19, y: 5 }, 'right', { x: 0, y: 5 }],
    [{ x: 0, y: 5 }, 'left', { x: 19, y: 5 }],
    [{ x: 5, y: 0 }, 'up', { x: 5, y: 19 }],
    [{ x: 5, y: 19 }, 'down', { x: 5, y: 0 }],
  ]) {
    for (const arena of ['basic', 'walls', 'obstacles']) {
      const st = game({ arena })
      st.snake = [head]
      st.pendingDir = dir
      step(st)
      assert.equal(st.over, arena !== 'basic')
      if (arena === 'basic') assert.deepEqual(st.snake[0], expected)
    }
  }
})

test('obstacle templates leave every free cell reachable and the starting route clear', () => {
  for (let layout = 0; layout < 3; layout++) {
    const obstacles = makeObstacles(layout)
    assert.ok(obstacles.length > 0)
    assert.ok(obstacles.every((p) => p.y !== 10))
    const blocked = new Set(obstacles.map((p) => `${p.x},${p.y}`))
    const seen = new Set(['10,10'])
    const queue = [{ x: 10, y: 10 }]
    for (let i = 0; i < queue.length; i++) {
      for (const d of ['up', 'down', 'left', 'right']) {
        const p = nextCell(queue[i], d, 'obstacles')
        const key = `${p.x},${p.y}`
        if (p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20 && !seen.has(key) && !blocked.has(key)) {
          seen.add(key)
          queue.push(p)
        }
      }
    }
    assert.equal(seen.size + blocked.size, 400)
    const st = game({ arena: 'obstacles' })
    st.obstacles = [{ x: 11, y: 10 }]
    step(st)
    assert.equal(st.over, true)
  }
  assert.equal(game({ arena: 'basic' }).obstacles.length, 0)
  assert.equal(game({ arena: 'walls' }).obstacles.length, 0)
})

test('self and rival collisions kill; entering a vacating tail cell is legal', () => {
  const st = game()
  st.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }]
  step(st)
  assert.equal(st.over, false)
  st.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 7, y: 5 }]
  st.pendingDir = 'right'
  step(st)
  assert.equal(st.over, true)
  const withRival = game()
  withRival.rivals = [{ snake: [{ x: 11, y: 10 }], dir: 'up' }]
  step(withRival)
  assert.equal(withRival.over, true)
})

test('all option combinations spawn safe fruit and short, separated rivals', () => {
  let seed = 17
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const speedMode of ['constant', 'capped', 'endless']) {
      for (const arena of ['basic', 'walls', 'obstacles']) {
        for (const rivals of [false, true]) {
          const st = initial({ difficulty, speedMode, arena, rivals }, random)
          assert.equal(st.rivals.length >= 1 && st.rivals.length <= 2, rivals)
          const points = [...st.snake, ...st.obstacles, st.food, ...st.rivals.flatMap((r) => r.snake)]
          assert.equal(new Set(points.map((p) => `${p.x},${p.y}`)).size, points.length)
          for (const r of st.rivals) {
            assert.ok(r.snake.length >= 3 && r.snake.length <= 5)
            assert.ok(r.snake.every((p) => Math.abs(p.x - 10) + Math.abs(p.y - 10) >= 6))
          }
          for (let i = 0; i < 100; i++) advanceTime(st, 240, random)
          for (const r of st.rivals) {
            assert.ok(r.snake.length <= 5)
            for (const p of r.snake) {
              assert.ok(p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20)
              assert.ok(![...st.snake, ...st.obstacles, st.food].some((b) => same(b, p)))
            }
          }
        }
      }
    }
  }
})

test('trapped rivals leave the board instead of blocking it forever', () => {
  const st = game({ arena: 'walls' })
  st.rivals = [{ snake: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], dir: 'left' }]
  st.obstacles = [{ x: 0, y: 1 }]
  advanceTime(st, 240)
  assert.equal(st.rivals.length, 0)
})

test('a full board terminates cleanly and the final apple records a win', () => {
  const all = Array.from({ length: 400 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) }))
  assert.equal(freeCell(all), null)
  const st = game()
  st.snake = [{ x: 0, y: 0 }]
  st.obstacles = all.filter((p) => !(p.y === 0 && p.x <= 1))
  st.food = { x: 1, y: 0, kind: 'apple', expiresAt: null }
  step(st)
  assert.equal(st.over, true)
  assert.equal(st.won, true)
  assert.equal(st.score, 1)
})

test('every arena size wraps at its actual edges and wall modes stop at those same edges', () => {
  for (const [size, { cols, rows }] of Object.entries(BOARD_SIZES)) {
    const edges = [
      [{ x: cols - 1, y: 1 }, 'right', { x: 0, y: 1 }],
      [{ x: 0, y: 1 }, 'left', { x: cols - 1, y: 1 }],
      [{ x: 1, y: 0 }, 'up', { x: 1, y: rows - 1 }],
      [{ x: 1, y: rows - 1 }, 'down', { x: 1, y: 0 }],
    ]
    for (const [head, dir, expected] of edges) {
      for (const arena of ['basic', 'walls', 'obstacles']) {
        const st = game({ size, arena })
        st.snake = [head]
        st.pendingDir = dir
        st.food = null
        st.obstacles = []
        step(st)
        assert.equal(st.over, arena !== 'basic', `${size} ${arena} ${dir}`)
        if (arena === 'basic') assert.deepEqual(st.snake[0], expected)
      }
    }
  }
})

test('resized obstacle layouts stay connected, and rivals stay within each arena', () => {
  for (const [size, { cols, rows }] of Object.entries(BOARD_SIZES)) {
    const center = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }
    for (let layout = 0; layout < 3; layout++) {
      const obstacles = makeObstacles(layout, cols, rows)
      const blocked = new Set(obstacles.map((p) => `${p.x},${p.y}`))
      assert.equal(obstacles.length, blocked.size)
      assert.ok(obstacles.every((p) => p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows && p.y !== center.y))
      const seen = new Set([`${center.x},${center.y}`])
      const queue = [center]
      for (let i = 0; i < queue.length; i++) {
        for (const d of ['up', 'down', 'left', 'right']) {
          const p = nextCell(queue[i], d, 'obstacles', cols, rows)
          const key = `${p.x},${p.y}`
          if (p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows && !blocked.has(key) && !seen.has(key)) {
            seen.add(key)
            queue.push(p)
          }
        }
      }
      assert.equal(seen.size + blocked.size, cols * rows, `${size} layout ${layout}`)
    }
    for (const arena of ['basic', 'walls', 'obstacles']) {
      const st = game({ size, arena, rivals: true })
      const cells = [...st.snake, st.food, ...st.obstacles, ...st.rivals.flatMap((r) => r.snake)]
      assert.equal(new Set(cells.map((p) => `${p.x},${p.y}`)).size, cells.length)
      assert.ok(st.rivals.length >= 1 && st.rivals.length <= 2)
      for (let i = 0; i < 100; i++) {
        advanceTime(st, 240)
        for (const r of st.rivals) {
          assert.ok(r.snake.every((p) => p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows))
          assert.ok(r.snake.every((p) => ![...st.snake, ...st.obstacles, st.food].some((b) => same(p, b))))
        }
      }
    }
  }
})

test('fruit spawning and full-board completion use the selected arena dimensions', () => {
  for (const [size, { cols, rows }] of Object.entries(BOARD_SIZES)) {
    const st = game({ size })
    for (let i = 0; i < 6; i++) eatRegular(st, () => 0.01)
    const fruits = [st.food, ...st.bonuses]
    assert.equal(st.over, false)
    assert.ok(st.bonuses.some((f) => f.kind === 'coconut'))
    assert.ok(fruits.every((p) => p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows))
    const occupied = [...st.snake, ...fruits].map((p) => `${p.x},${p.y}`)
    assert.equal(new Set(occupied).size, occupied.length)
    const all = Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) }))
    assert.equal(freeCell(all, Math.random, cols, rows), null)
    const full = game({ size })
    full.snake = [{ x: 0, y: 0 }]
    full.obstacles = all.filter((p) => !(p.y === 0 && p.x <= 1))
    full.food = { x: 1, y: 0, kind: 'apple', expiresAt: null }
    step(full)
    assert.equal(full.won, true)
  }
})

test('only bonus fruit pulses; drawing never changes its hitbox or displays countdown text', async () => {
  const source = readFileSync(new URL('../src/lib/snake/render.ts', import.meta.url), 'utf8')
    .replace("'./game'", JSON.stringify(gameUrl))
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
  const { drawFruit } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
  function paint(fruit, time) {
    const shapes = []
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      arc: (...args) => shapes.push(['arc', ...args]),
      ellipse: (...args) => shapes.push(['ellipse', ...args]),
      lineTo: (...args) => shapes.push(['line', ...args]),
      fillText: () => assert.fail('Countdown text should not be drawn'),
      strokeText: () => assert.fail('Countdown text should not be drawn'),
    }
    drawFruit(ctx, fruit, 22, time)
    return shapes
  }
  for (const kind of ['apple', 'coconut', 'mango', 'durian']) {
    const fruit = { kind, x: 2, y: 3, expiresAt: kind === 'apple' ? null : 10000 }
    const copy = { ...fruit }
    const early = paint(fruit, 0)
    const later = paint(fruit, 250)
    const body = early[0]
    const radius = kind === 'durian'
      ? Math.hypot(body[1] - (fruit.x + 0.5) * 22, body[2] - (fruit.y + 0.5) * 22)
      : kind === 'mango' ? body[4] : body[3]
    assert.ok(radius > 11, `${kind} should be larger than its cell`)
    if (kind === 'apple') assert.deepEqual(early, later)
    else assert.notDeepEqual(early, later)
    assert.deepEqual(fruit, copy)
  }
})

test('the board fits phone, landscape, desktop, and zero-size containers without distortion or overflow', async () => {
  const source = readFileSync(new URL('../src/lib/snake/layout.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
  const { fitBoard } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
  for (const [width, height] of [[291, 260], [343, 430], [460, 210], [900, 610], [0, 0], [320, 0]]) {
    for (const { cols, rows } of Object.values(BOARD_SIZES)) {
      const fitted = fitBoard(width, height, cols, rows)
      assert.ok(fitted.width >= 0 && fitted.width <= width + 1e-8)
      assert.ok(fitted.height >= 0 && fitted.height <= height + 1e-8)
      if (width && height) {
        assert.ok(Math.abs(fitted.width / fitted.height - cols / rows) < 1e-8)
        assert.ok(Math.abs(fitted.width - width) < 1e-8 || Math.abs(fitted.height - height) < 1e-8)
      }
    }
  }
})
