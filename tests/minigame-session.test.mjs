import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = mkdtempSync(join(root, '.minigame-tests-'))
after(() => rmSync(temp, { recursive: true, force: true }))
const saved = new Map()
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: (key) => saved.delete(key),
}
after(() => { delete globalThis.localStorage })
const names = { snake: 'SnakeGame', flappy: 'FlappyBird', tetris: 'Tetris', sudoku: 'Sudoku', goldminer: 'GoldMiner', dino: 'DinoGame', g2048: 'Game2048', blockblast: 'BlockBlast', boxing: 'BoxingGame' }
const entry = [
  ...Object.values(names).map((name) => `export { ${name} } from './src/components/minigames/${name}.tsx'`),
  "export * from './src/components/minigames/GameSession.tsx'",
  "export * from './src/lib/minigame/snapshot.ts'",
  "export * from './src/lib/minigame/keyboard.ts'",
  "export { useMinigameStore } from './src/store/minigame.ts'",
  "export { step as snakeStep } from './src/lib/snake/game.ts'",
  "export { BoxingArena } from './src/components/minigames/BoxingArena.tsx'",
  "export { input as boxingInput, update as boxingUpdate } from './src/lib/boxing/game.ts'",
  "export { flap, update as flappyStep } from './src/lib/flappy/game.ts'",
].join('\n')
const output = join(temp, 'games.mjs')
await build({ stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, absWorkingDir: root, outfile: output, bundle: true, packages: 'external', jsx: 'automatic', platform: 'node', format: 'esm', external: ['react', 'react-dom', 'react-dom/*'], logLevel: 'silent' })
const games = await import(pathToFileURL(output).href)

function session(game, snapshot = games.newSnapshot(game)) {
  const control = games.createGameSession(game)
  control.snapshot = snapshot
  control.setPaused(true)
  return control
}
function mount(game, control) {
  // A new server render creates fresh React hooks, just like unmounting and reopening the popup.
  return renderToString(React.createElement(games.GameSessionContext.Provider, { value: control }, React.createElement(games[names[game]])))
}
const copy = (value) => JSON.parse(JSON.stringify(value))

test('snake toggles pause with Space and closes with Esc; other games pause then close with Esc', () => {
  let paused = false
  for (const expected of ['pause', 'resume', 'pause']) {
    const action = games.gameKeyAction('snake', paused, ' ')
    assert.equal(action, expected)
    paused = action === 'pause'
  }
  for (const paused of [false, true]) {
    assert.equal(games.gameKeyAction('snake', paused, 'Escape'), 'close')
    assert.equal(games.gameKeyAction('snake', paused, 'ArrowUp'), null)
  }
  for (const game of Object.keys(names).filter((game) => game !== 'snake')) {
    assert.equal(games.gameKeyAction(game, false, 'Escape'), 'pause', game)
    assert.equal(games.gameKeyAction(game, true, 'Escape'), 'close', game)
    assert.equal(games.gameKeyAction(game, false, ' '), null, game)
    assert.equal(games.gameKeyAction(game, true, ' '), null, game)
  }
})

test('all actual game components restore the same versioned data into fresh React state', () => {
  for (const game of Object.keys(names)) {
    const first = session(game)
    mount(game, first)
    assert.equal(games.validSnapshot(game, first.snapshot), true, `${game} initial schema`)
    if (first.snapshot.refs.engine) {
      first.snapshot.refs.engine.current.score = 12
      first.snapshot.state.score = 12
      first.snapshot.state.running = true
      const engine = first.snapshot.refs.engine.current
      if (game === 'boxing') engine.phase = 'fight'
      if (game === 'tetris') engine.active.y = 6
      if (game === 'dino') { engine.dinoY -= 20; engine.dinoVY = -4 }
      if (game === 'flappy') {
        engine.flying = true
        engine.birdY = 180
        engine.birdVY = -3.2
        first.snapshot.state.flying = true
      }
      if (game === 'goldminer') {
        engine.timeLeft = 32.25
        first.snapshot.state.timeLeft = 33
        engine.clawState = 'retract'
        engine.caughtItem = engine.items[0]
        engine.caughtItem.caught = true
      }
    } else if (game === 'sudoku') {
      first.snapshot.state.seconds = 75
    } else first.snapshot.state.score = 12
    const data = copy(first.snapshot)
    assert.equal(games.validSnapshot(game, data), true, `${game} saved schema`)
    const before = copy(data)
    const restored = session(game, data)
    mount(game, restored)
    assert.deepEqual(restored.snapshot, before, `${game} must not reroll, reset, or mutate saved gameplay`)
    assert.equal(restored.paused, true)
  }
})

test('Sudoku renders incorrect entries without error colors or an error counter', () => {
  const control = session('sudoku')
  mount('sudoku', control)
  const { board, solution } = control.snapshot.state
  const r = board.findIndex((row) => row.some((cell) => !cell.fixed))
  const c = board[r].findIndex((cell) => !cell.fixed)
  board[r][c].value = solution[r][c] % 9 + 1
  control.snapshot.state.selected = { r, c }
  const html = mount('sudoku', control)
  assert.doesNotMatch(html, /rose-|✗/)
  assert.match(html, /bg-sky-500\/40/)
  assert.equal(games.validSnapshot('sudoku', control.snapshot), true)
})

test('Block Blast keeps custom materials, environment and bounded view when reopened', () => {
  const first = session('blockblast')
  mount('blockblast', first)
  Object.assign(first.snapshot.state, { theme: 5, blockStyle: 5, view: { yaw: 1.2, tilt: 1, zoom: .8 } })
  assert.equal(games.validSnapshot('blockblast', first.snapshot), true)
  const data = copy(first.snapshot)
  const restored = session('blockblast', copy(data))
  mount('blockblast', restored)
  assert.deepEqual(restored.snapshot, data)
  for (const patch of [{theme:6},{blockStyle:6},{view:{yaw:5,tilt:1,zoom:1}},{view:{yaw:0,tilt:0,zoom:1}},{view:{yaw:0,tilt:1,zoom:1.1}}]) {
    const bad = copy(data)
    Object.assign(bad.state, patch)
    assert.equal(games.validSnapshot('blockblast', bad), false)
  }
  const older = copy(data)
  delete older.state.view
  delete older.state.blockStyle
  assert.equal(games.validSnapshot('blockblast', older), true)
})

test('existing saved best scores gain a zero Block Blast record without losing older records', async () => {
  const store = games.useMinigameStore
  const before = store.getState()
  saved.set('landing.minigame.v2', JSON.stringify({ state: { highScores: { snake: 71, flappy: 19 } }, version: 0 }))
  await store.persist.rehydrate()
  assert.equal(store.getState().highScores.blockblast, 0)
  assert.equal(store.getState().highScores.snake, 71)
  assert.equal(store.getState().highScores.flappy, 19)
  store.getState().recordScore('blockblast', 42)
  assert.equal(store.getState().highScores.blockblast, 42)
  store.setState(before)
})

test('snake continues from the saved head, direction, length and fruit instead of starting over', () => {
  const first = session('snake')
  mount('snake', first)
  const st = first.snapshot.refs.engine.current
  st.food = { x: 11, y: 10, kind: 'apple', expiresAt: null }
  games.snakeStep(st, () => 0.99)
  first.snapshot.state.score = st.score
  first.snapshot.state.running = true
  assert.equal(st.snake.length, 5)
  const next = session('snake', copy(first.snapshot))
  mount('snake', next)
  const restored = next.snapshot.refs.engine.current
  assert.deepEqual(restored.snake[0], { x: 11, y: 10 })
  assert.equal(restored.score, 1)
  assert.equal(restored.snake.length, 5)
  games.snakeStep(restored, () => 0.99)
  assert.deepEqual(restored.snake[0], { x: 12, y: 10 })
  assert.equal(restored.score, 1)
})

test('Flappy Bird restores flight velocity and obstacles rather than a new ready screen', () => {
  const first = session('flappy')
  mount('flappy', first)
  const st = first.snapshot.refs.engine.current
  games.flap(st)
  games.flappyStep(st, 16)
  st.pipes = [{ x: 250, gapY: 150, passed: false, number: 1, record: true }]
  first.snapshot.state.flying = true
  const data = copy(first.snapshot)
  const next = session('flappy', data)
  mount('flappy', next)
  assert.equal(next.snapshot.state.flying, true)
  assert.equal(next.snapshot.refs.engine.current.birdVY, st.birdVY)
  games.flappyStep(next.snapshot.refs.engine.current, 16)
  assert.ok(next.snapshot.refs.engine.current.pipes[0].x < 250)
})

test('unknown versions, mismatched games, missing fields, non-finite values and broken boards are rejected', () => {
  for (const game of Object.keys(names)) {
    const control = session(game)
    mount(game, control)
    const valid = control.snapshot
    for (const mutate of [
      (s) => { s.version = 99 },
      (s) => { s.game = game === 'snake' ? 'flappy' : 'snake' },
      (s) => { s.state = {} },
      (s) => { s.state.score = NaN },
      (s) => { if (game === 'g2048') s.state.board = []; else s.refs = {} },
    ]) {
      const bad = copy(valid)
      mutate(bad)
      assert.equal(games.validSnapshot(game, bad), false, `${game}: ${mutate}`)
    }
  }
  for (const game of ['sudoku', 'g2048']) {
    const control = session(game)
    mount(game, control)
    control.snapshot.state.board[0] = []
    assert.equal(games.validSnapshot(game, control.snapshot), false)
  }
})

test('a fresh snapshot discards only a broken game, while runtime failures stop its session', (t) => {
  t.mock.method(console, 'error', () => {})
  const broken = session('snake')
  mount('snake', broken)
  broken.guard(() => { throw new Error('simulated canvas failure') })
  assert.equal(broken.error, true)
  assert.equal(broken.paused, true)
  let ran = false
  broken.guard(() => { ran = true })
  assert.equal(ran, false)
  games.useMinigameStore.getState().recordScore('snake', 90)
  const fresh = session('snake', games.newSnapshot('snake'))
  mount('snake', fresh)
  assert.equal(fresh.snapshot.state.score, 0)
  assert.equal(fresh.snapshot.state.running, false)
  assert.equal(games.useMinigameStore.getState().highScores.snake, 90)
  assert.equal(games.validSnapshot('snake', fresh.snapshot), true)
})


test('pausing and closing preserve isolated sessions and advance the resume clock only on transitions', () => {
  const snake = games.createGameSession('snake')
  const bird = games.createGameSession('flappy')
  mount('snake', snake)
  mount('flappy', bird)
  const data = copy(snake.snapshot)
  snake.setPaused(true)
  assert.equal(snake.pauseVersion, 1)
  snake.setPaused(true)
  assert.equal(snake.pauseVersion, 1)
  snake.visible = false
  assert.equal(bird.paused, false)
  assert.deepEqual(snake.snapshot, data)
  snake.visible = true
  snake.setPaused(false)
  assert.equal(snake.pauseVersion, 2)
  assert.equal(snake.paused, false)
  assert.deepEqual(snake.snapshot, data)
})

test('Boxing restores an in-flight punch and its buffered combo, and rejects corrupted queued commands',()=>{
  const control=session('boxing');mount('boxing',control)
  const st=control.snapshot.refs.engine.current
  st.mode='versus';st.phase='fight';control.snapshot.state.mode='versus';control.snapshot.state.running=true
  games.boxingInput(st,0,'jab');games.boxingInput(st,0,'cross')
  assert.equal(games.validSnapshot('boxing',control.snapshot),true)
  const data=copy(control.snapshot), restored=session('boxing',copy(data));mount('boxing',restored)
  assert.deepEqual(restored.snapshot,data)
  const engine=restored.snapshot.refs.engine.current
  for(let i=0;i<42;i++)games.boxingUpdate(engine,1/60)
  assert.equal(engine.fighters[0].chain,2)
  assert.equal(engine.fighters[0].lastPunch,'cross')
  for(const queued of [{action:'unknown',expires:1},{action:'cross',expires:-1}]) {
    const bad=copy(data);bad.refs.engine.current.fighters[0].queued=queued
    assert.equal(games.validSnapshot('boxing',bad),false)
  }
})
test('boxing artwork renders a drawn result safely without a fighter target',()=>{
  const control=session('boxing');mount('boxing',control)
  const state=control.snapshot.refs.engine.current
  state.phase='over';state.over=true;state.winner=null
  const html=renderToString(React.createElement(games.BoxingArena,{state,event:{kind:'win',player:-1,damage:0},eventAt:0,reducedMotion:true}))
  assert.doesNotMatch(html,/NaN|undefined/)
  assert.match(html,/RINGSIDE/)
})

test('boxing saves independent fighter choices and rejects invalid character IDs',()=>{
  const control=session('boxing');mount('boxing',control)
  control.snapshot.state.roster=['nova','titan']
  assert.equal(games.validSnapshot('boxing',control.snapshot),true)
  const restored=session('boxing',copy(control.snapshot)),html=mount('boxing',restored)
  assert.deepEqual(restored.snapshot.state.roster,['nova','titan'])
  assert.match(html,/nova-portrait.png/);assert.match(html,/titan-portrait.png/)
  for(const roster of [['nova'],['nova','unknown'],['nova','../../remote']]){
    const bad=copy(control.snapshot);bad.state.roster=roster
    assert.equal(games.validSnapshot('boxing',bad),false)
  }
  const legacy=copy(control.snapshot);delete legacy.state.roster
  assert.equal(games.validSnapshot('boxing',legacy),true)
})

test('boxing preserves movement momentum and hit reaction data while validating new optional fields',()=>{
  const control=session('boxing');mount('boxing',control)
  const st=control.snapshot.refs.engine.current
  st.mode='versus';st.phase='fight';control.snapshot.state.mode='versus';control.snapshot.state.running=true
  games.boxingInput(st,0,'advance')
  for(let i=0;i<14;i++)games.boxingUpdate(st,1/60)
  games.boxingInput(st,0,'power')
  for(let i=0;i<33;i++)games.boxingUpdate(st,1/60)
  control.snapshot.state.score=st.score
  assert.equal(st.fighters[1].hurtMove,'power');assert.ok(st.fighters[1].hurtPower>0)
  assert.equal(games.validSnapshot('boxing',control.snapshot),true)
  const restored=session('boxing',copy(control.snapshot));mount('boxing',restored);assert.deepEqual(restored.snapshot,control.snapshot)
  for(const [key,value] of [['stepVelocity',20],['hurtMove','unknown'],['hurtPower',-1],['hurtPower',101]]){
    const bad=copy(control.snapshot);bad.refs.engine.current.fighters[1][key]=value
    assert.equal(games.validSnapshot('boxing',bad),false)
  }
})


test('boxing saves 1000 HP and renders health as a bounded percentage',()=>{
  const control=session('boxing');mount('boxing',control)
  const st=control.snapshot.refs.engine.current
  st.phase='fight';control.snapshot.state.running=true;st.fighters[0].hp=500
  const html=mount('boxing',control)
  assert.match(html,/aria-valuemax="1000" aria-valuenow="500"/)
  assert.match(html,/class="ringside-health "><span style="width:50%"/)
  assert.equal(games.validSnapshot('boxing',control.snapshot),true)
  const restored=session('boxing',copy(control.snapshot));mount('boxing',restored)
  assert.deepEqual(restored.snapshot,control.snapshot)
  for(const hp of [1001,-1,Infinity]){
    const bad=copy(control.snapshot);bad.refs.engine.current.fighters[0].hp=hp
    assert.equal(games.validSnapshot('boxing',bad),false)
  }
})
