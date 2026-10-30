import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

async function loadModule(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), 'utf8')
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to)
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { initial, resize, flap, update, PIPE_INTERVAL, PIPE_W, BIRD_X, BIRD_R, H, GROUND_H } =
  await loadModule('../src/lib/flappy/game.ts')
const FRAME = 1000 / 60

function passNextPipe(st) {
  st.birdY = 210
  st.birdVY = 0
  const number = st.score + 1
  st.pipes = [{ x: BIRD_X - BIRD_R - PIPE_W - 7, gapY: 150, passed: false, number, record: number === st.recordToBeat + 1 }]
  update(st, FRAME)
}

test('the ready bird cruises indefinitely with no gravity, pipes, score, or collisions', () => {
  const st = initial(5)
  const y = st.birdY
  for (let i = 0; i < 3600; i++) update(st, FRAME)
  assert.equal(st.birdY, y)
  assert.equal(st.birdVY, 0)
  assert.equal(st.birdAngle, 0)
  assert.equal(st.pipeElapsed, 0)
  assert.equal(st.pipes.length, 0)
  assert.equal(st.score, 0)
  assert.equal(st.over, false)
  assert.equal(st.flying, false)
  assert.ok(st.groundOffset > 0)
  assert.ok(st.flapPhase > 0)
})

test('the first flap lifts the bird and enables falling; later flaps restore lift', () => {
  const st = initial()
  const y = st.birdY
  flap(st)
  assert.equal(st.flying, true)
  update(st, FRAME)
  assert.ok(st.birdY < y)
  for (let i = 0; i < 20; i++) update(st, FRAME)
  assert.ok(st.birdVY > 0)
  flap(st)
  assert.ok(st.birdVY < 0)
})

test('pipe timing begins on the first flap, regardless of time spent in ready mode', () => {
  const st = initial(2)
  update(st, 60000)
  flap(st)
  for (let i = 0; i < 100; i++) {
    // Keep the test bird airborne while checking the independent spawn clock.
    st.birdY = 210
    st.birdVY = 0
    update(st, 15, () => 0.5)
    assert.equal(st.pipes.length, i < 99 ? 0 : 1)
  }
  assert.equal(st.pipeElapsed, 0)
  assert.equal(st.pipes[0].number, 1)
  assert.equal(st.pipes[0].record, false)
})

test('only the pipe that beats the captured record is gold, including the first ever record', () => {
  for (const best of [0, 2, 20]) {
    const st = initial(best)
    flap(st)
    const gold = []
    for (let number = 1; number <= best + 3; number++) {
      st.birdY = 210
      st.birdVY = 0
      st.pipeElapsed = PIPE_INTERVAL - 1
      st.pipes = []
      update(st, 1)
      assert.equal(st.pipes[0].number, number)
      if (st.pipes[0].record) gold.push(number)
    }
    assert.deepEqual(gold, [best + 1])
    assert.equal(st.recordToBeat, best)
  }
})

test('tying the record does not celebrate; breaking it does, and pipes score only once', () => {
  const st = initial(2)
  flap(st)
  passNextPipe(st)
  assert.equal(st.score, 1)
  assert.equal(st.recordBroken, false)
  update(st, FRAME)
  assert.equal(st.score, 1)
  passNextPipe(st)
  assert.equal(st.score, 2)
  assert.equal(st.recordBroken, false)
  passNextPipe(st)
  assert.equal(st.score, 3)
  assert.equal(st.recordBroken, true)
  passNextPipe(st)
  assert.equal(st.recordBroken, true)
})

test('ceiling, ground, and visible pipe rims cause collisions without awarding points', () => {
  for (const position of ['ceiling', 'ground', 'rim']) {
    const st = initial()
    flap(st)
    st.birdVY = 0
    if (position === 'ceiling') st.birdY = BIRD_R - 1
    else if (position === 'ground') st.birdY = H - GROUND_H - BIRD_R + 1
    else {
      st.birdY = 50
      // Only the six-pixel rim overlaps the bird, not the pipe body.
      st.pipes = [{ x: BIRD_X + BIRD_R + 4, gapY: 150, passed: false, number: 1, record: true }]
    }
    update(st, FRAME)
    assert.equal(st.over, true, position)
    assert.equal(st.score, 0)
    assert.equal(st.recordBroken, false)
    const y = st.birdY
    flap(st)
    update(st, FRAME)
    assert.equal(st.birdY, y)
  }
})

test('replay resets flight, pipes, and celebrations against the new record', () => {
  const st = initial(7)
  assert.equal(st.recordToBeat, 7)
  assert.equal(st.flying, false)
  assert.equal(st.recordBroken, false)
  assert.equal(st.score, 0)
  assert.deepEqual(st.pipes, [])
  assert.equal(st.pipeElapsed, 0)
})

test('wide and portrait fields spawn pipes beyond the actual right edge and score at the bird', () => {
  for (const width of [240, 480, 900]) {
    const st = initial(2, width)
    assert.equal(st.birdX, width / 4)
    flap(st)
    st.birdVY = 0
    st.pipeElapsed = PIPE_INTERVAL - 1
    update(st, 1)
    assert.ok(st.pipes[0].x > width)
    st.pipes = [{ x: st.birdX - BIRD_R - PIPE_W - 7, gapY: 150, passed: false, number: 1, record: false }]
    st.birdY = 210
    update(st, FRAME)
    assert.equal(st.score, 1)
    assert.equal(st.over, false)
  }
})

test('resizing preserves the distance to every pipe, score, and flight state', () => {
  const st = initial(3)
  flap(st)
  st.pipes = [{ x: 120, gapY: 150, passed: false, number: 1, record: false }]
  const distance = st.pipes[0].x - st.birdX
  for (const width of [900, 240, 640]) {
    resize(st, width)
    assert.equal(st.width, width)
    assert.equal(st.pipes[0].x - st.birdX, distance)
    assert.equal(st.score, 0)
    assert.equal(st.flying, true)
    assert.equal(st.over, false)
  }
})

test('record names and bird choice persist, while older scores and other games stay intact', async () => {
  const memory = new Map()
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  }
  memory.set('landing.minigame.v2', JSON.stringify({ state: {
    highScores: { snake: 30, flappy: 5, tetris: 0, sudoku: 0, goldminer: 0, dino: 0, g2048: 0 },
  }, version: 0 }))
  const { useMinigameStore: store } = await loadModule('../src/store/minigame.ts', {
    "'zustand'": JSON.stringify(import.meta.resolve('zustand')),
    "'zustand/middleware'": JSON.stringify(import.meta.resolve('zustand/middleware')),
  })
  assert.equal(store.getState().highScores.flappy, 5)
  assert.equal(store.getState().flappyRecord, null)
  assert.equal(store.getState().flappyBird, 'canary')
  assert.equal(store.getState().flappyEnvironment, 'day')
  store.getState().recordScore('flappy', 6)
  assert.equal(store.getState().claimFlappyRecord(6, '   '), false)
  assert.equal(store.getState().claimFlappyRecord(5, 'Old score'), false)
  assert.equal(store.getState().claimFlappyRecord(6, '  Đại  '), true)
  assert.equal(store.getState().flappyRecord.name, 'Đại')
  store.getState().selectFlappyBird('owl')
  store.getState().selectFlappyEnvironment('beach')
  const persisted = JSON.parse(memory.get('landing.minigame.v2')).state
  assert.equal(persisted.flappyRecord.name, 'Đại')
  assert.equal(persisted.flappyRecord.score, 6)
  assert.equal(persisted.highScores.snake, 30)
  assert.equal(persisted.flappyBird, 'owl')
  assert.equal(persisted.flappyEnvironment, 'beach')
  store.getState().recordScore('snake', 31)
  store.getState().recordScore('flappy', 6)
  assert.equal(store.getState().flappyRecord.name, 'Đại')
  store.getState().recordScore('flappy', 7)
  assert.equal(store.getState().flappyRecord, null)
  assert.equal(store.getState().claimFlappyRecord(6, 'Stale name'), false)
  assert.equal(store.getState().claimFlappyRecord(7, 'a'.repeat(40)), true)
  assert.equal(store.getState().flappyRecord.name.length, 32)
  store.setState({ flappyRecord: null, flappyBird: 'canary', flappyEnvironment: 'day' })
  memory.set('landing.minigame.v2', JSON.stringify({ state: persisted, version: 0 }))
  await store.persist.rehydrate()
  assert.equal(store.getState().flappyRecord.name, 'Đại')
  assert.equal(store.getState().flappyBird, 'owl')
  assert.equal(store.getState().flappyEnvironment, 'beach')
  delete globalThis.localStorage
})
