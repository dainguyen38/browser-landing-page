import { validGame as validTienLen, validSettings as validTienLenSettings, TURN_SECONDS } from '@/lib/tlmn/game'
import { DEAL_DURATION_MS } from '@/lib/tlmn/presentation'
import type { GameKey } from '@/store/minigame'
import { MAX_HP } from '@/lib/boxing/game'
import { validRoster } from '@/lib/boxing/characters'

export type GameSnapshot = {
  version: 1
  game: GameKey
  state: Record<string, unknown>
  refs: Record<string, { current: unknown }>
}

export function newSnapshot(game: GameKey): GameSnapshot {
  return { version: 1, game, state: {}, refs: {} }
}

const object = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown): value is number => number(value) && Number.isInteger(value)
const nonnegative = (value: unknown) => number(value) && value >= 0
const point = (value: unknown): value is { x: number; y: number } => object(value) && integer(value.x) && integer(value.y)
const direction = (value: unknown) => ['up', 'down', 'left', 'right'].includes(value as string)
const matrix = (value: unknown, rows: number, cols: number, cell: (value: any) => boolean): boolean =>
  Array.isArray(value) && value.length === rows && value.every((row) => Array.isArray(row) && row.length === cols && row.every(cell))

function plainData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value!)) return false
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false
  ancestors.add(value!)
  const valid = Object.values(value!).every((child) => plainData(child, ancestors))
  ancestors.delete(value!)
  return valid
}

export function validSnapshot(game: GameKey, value: unknown): value is GameSnapshot {
  try {
    if (!object(value) || value.version !== 1 || value.game !== game || !object(value.state) || !object(value.refs) || !plainData(value)) return false
    const s = value.state
    if (game === 'tlmn') return validTienLenSettings(s.settings) && ['home','setup','table','rules'].includes(s.screen) &&
      (s.anchorSeat === undefined || (integer(s.anchorSeat) && s.anchorSeat >= 0 && s.anchorSeat < 4)) &&
      (s.muted === undefined || typeof s.muted === 'boolean') &&
      (s.stake === undefined || [1000,10000,50000,100000].includes(s.stake)) &&
      (value.refs.turnClock === undefined || (object(value.refs.turnClock.current) && typeof value.refs.turnClock.current.key === 'string' && value.refs.turnClock.current.key.length <= 100 && nonnegative(value.refs.turnClock.current.remaining) && value.refs.turnClock.current.remaining <= TURN_SECONDS*1000)) &&
      (value.refs.dealClock === undefined || (object(value.refs.dealClock.current) && typeof value.refs.dealClock.current.roundId === 'string' && value.refs.dealClock.current.roundId.length <= 100 && nonnegative(value.refs.dealClock.current.elapsed) && value.refs.dealClock.current.elapsed <= DEAL_DURATION_MS)) &&
      (s.match === null ? s.screen !== 'table' : validTienLen(s.match))
    if (typeof s.running !== 'boolean' && game !== 'g2048') return false
    if (game !== 'sudoku' && (!nonnegative(s.score) || typeof s.over !== 'boolean')) return false
    const st = value.refs.engine?.current
    if (game === 'g2048') {
      return matrix(s.board, 4, 4, (v) => integer(v) && (v === 0 || (v >= 2 && Number.isInteger(Math.log2(v))))) &&
        ['won', 'keepGoing'].every((key) => typeof s[key] === 'boolean') && number(s.cellSize) && s.cellSize >= 44 && s.cellSize <= 100
    }
    if (game === 'sudoku') {
      const solution = s.solution
      const validSolution = matrix(solution, 9, 9, (v) => integer(v) && v >= 1 && v <= 9) &&
        solution.every((row: number[], i: number) => new Set(row).size === 9 && new Set(solution.map((r: number[]) => r[i])).size === 9) &&
        Array.from({ length: 9 }, (_, i) => new Set(Array.from({ length: 9 }, (_, j) => solution[Math.floor(i / 3) * 3 + Math.floor(j / 3)][i % 3 * 3 + j % 3])).size === 9).every(Boolean)
      return ['easy', 'medium', 'hard'].includes(s.difficulty) && nonnegative(s.seconds) && typeof s.solved === 'boolean' && validSolution &&
        matrix(s.board, 9, 9, (v) => object(v) && integer(v.value) && v.value >= 0 && v.value <= 9 && typeof v.fixed === 'boolean') &&
        s.board.every((row: any[], r: number) => row.every((v, c) => !v.fixed || v.value === solution[r][c])) &&
        (s.selected === null || (object(s.selected) && integer(s.selected.r) && integer(s.selected.c) && s.selected.r >= 0 && s.selected.r < 9 && s.selected.c >= 0 && s.selected.c < 9)) &&
        typeof value.refs.claimed?.current === 'boolean'
    }
    if (!object(st) || typeof st.over !== 'boolean' || st.over !== s.over || !nonnegative(st.score) || st.score !== s.score) return false
    if (game === 'boxing') {
      const actions = ['idle','jab','cross','hook','uppercut','body','power','flurry','special','guard','dodge','advance','retreat']
      return (s.roster === undefined || validRoster(s.roster)) && ['spar','arcade','survival','training','versus'].includes(st.mode) && st.mode === s.mode &&
        integer(st.difficulty) && st.difficulty >= 0 && st.difficulty <= 2 && st.difficulty === s.difficulty && typeof s.muted === 'boolean' &&
        ['ready','fight','break','over'].includes(st.phase) && s.running === (st.phase === 'fight') && st.over === (st.phase === 'over') &&
        ['time','left','aiAt'].every(key => nonnegative(st[key])) && st.left <= 45 &&
        integer(st.round) && st.round >= 1 && st.round <= 3 && integer(st.wave) && st.wave >= 1 &&
        (st.winner === null || st.winner === 0 || st.winner === 1) &&
        Array.isArray(st.wins) && st.wins.length === 2 && st.wins.every((v: unknown) => integer(v) && v >= 0) &&
        Array.isArray(st.roundDamage) && st.roundDamage.length === 2 && st.roundDamage.every(nonnegative) &&
        Array.isArray(st.fighters) && st.fighters.length === 2 && st.fighters[0].x < st.fighters[1].x &&
        st.fighters.every((f: any) => object(f) && nonnegative(f.hp) && f.hp <= MAX_HP && ['stamina','meter'].every(key => nonnegative(f[key]) && f[key] <= 100) &&
          number(f.x) && f.x >= .16 && f.x <= .84 && actions.includes(f.move) &&
          ['guardUntil','dodgeUntil','counterUntil','busyUntil','stunUntil','moveAt','moveUntil','damage','chain','repeats'].every(key => nonnegative(f[key])) &&
          number(f.hurtAt) && number(f.lastPunchAt) && (f.lastPunch === null || actions.slice(1,9).includes(f.lastPunch)) &&
          (f.queued === undefined || f.queued === null || (object(f.queued) && actions.slice(1).includes(f.queued.action) && nonnegative(f.queued.expires))) &&
          (f.soundPending === undefined || typeof f.soundPending === 'boolean') &&
          (f.fromX === undefined || (number(f.fromX) && f.fromX >= .16 && f.fromX <= .84)) &&
          (f.stepAt === undefined || number(f.stepAt)) &&
          (f.stepVelocity === undefined || (number(f.stepVelocity) && Math.abs(f.stepVelocity) <= 12)) &&
          (f.hurtMove === undefined || actions.slice(1,9).includes(f.hurtMove)) &&
          (f.hurtPower === undefined || (nonnegative(f.hurtPower) && f.hurtPower <= 100)) &&
          object(f.cooldowns) && Object.values(f.cooldowns).every(nonnegative) &&
          Array.isArray(f.pending) && f.pending.length <= 3 && f.pending.every((p: any) => object(p) && nonnegative(p.at) && actions.slice(1,9).includes(p.punch)))
    }
    if (game === 'blockblast') {
      const view = s.view
      const validView = view === undefined || (object(view) && number(view.yaw) && view.yaw >= -Math.PI*1.25 && view.yaw <= Math.PI*.75 &&
        number(view.tilt) && view.tilt >= Math.PI*35/180 && view.tilt <= Math.PI*65/180 && number(view.zoom) && view.zoom >= .6 && view.zoom <= 1)
      return validView && (s.blockStyle === undefined || (integer(s.blockStyle) && s.blockStyle >= 0 && s.blockStyle < 6)) &&
        matrix(st.board, 8, 8, (v) => integer(v) && v >= 0 && v <= 7) &&
        integer(st.combo) && st.combo >= 0 && integer(s.theme) && s.theme >= 0 && s.theme < 6 &&
        Array.isArray(st.pieces) && st.pieces.length === 3 && st.pieces.some((p: unknown) => p !== null) &&
        st.pieces.every((p: any) => p === null || (object(p) && integer(p.color) && p.color >= 1 && p.color <= 7 &&
          Array.isArray(p.cells) && p.cells.length > 0 && p.cells.length <= 9 &&
          p.cells.every((c: unknown) => point(c) && c.x >= 0 && c.x < 5 && c.y >= 0 && c.y < 5) &&
          new Set(p.cells.map((c: any) => `${c.x},${c.y}`)).size === p.cells.length))
    }
    if (game === 'snake') {
      if (!integer(st.cols) || !integer(st.rows) || st.cols < 16 || st.cols > 32 || st.rows < 16 || st.rows > 24) return false
      const inside = (p: unknown) => point(p) && p.x >= 0 && p.x < st.cols && p.y >= 0 && p.y < st.rows
      const body = (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= st.cols * st.rows && v.every(inside) && new Set(v.map((p) => `${p.x},${p.y}`)).size === v.length
      const fruit = (v: unknown) => object(v) && inside(v) && ['apple', 'coconut', 'mango', 'durian'].includes(v.kind) && (v.kind === 'apple' ? v.expiresAt === null : nonnegative(v.expiresAt))
      const sizes: Record<string, number[]> = { '16x16': [16, 16], '20x20': [20, 20], '28x20': [28, 20], '32x24': [32, 24] }
      const options = s.options
      return object(options) && ['difficulty', 'speedMode', 'arena', 'rivals', 'size'].every((key) => options[key] === st.options?.[key]) && sizes[options.size]?.[0] === st.cols && sizes[options.size]?.[1] === st.rows &&
        ['easy', 'medium', 'hard'].includes(options.difficulty) && ['constant', 'capped', 'endless'].includes(options.speedMode) &&
        ['basic', 'walls', 'obstacles'].includes(options.arena) && typeof options.rivals === 'boolean' &&
        ['emerald', 'neon', 'candy', 'gold', 'pixel'].includes(s.snakeStyle) &&
        body(st.snake) && direction(st.dir) && direction(st.pendingDir) && (st.food === null || fruit(st.food)) &&
        Array.isArray(st.obstacles) && st.obstacles.every(inside) && Array.isArray(st.bonuses) && st.bonuses.every(fruit) &&
        Array.isArray(st.rivals) && st.rivals.length <= 2 && st.rivals.every((r) => object(r) && body(r.snake) && r.snake.length <= 5 && direction(r.dir)) &&
        ['eaten', 'regularEaten', 'elapsed', 'lastRivalStep'].every((key) => nonnegative(st[key]))
    }
    if (game === 'flappy') {
      return number(st.width) && st.width > 0 && number(st.birdX) && st.birdX > 0 && number(st.birdY) && number(st.birdVY) && number(st.birdAngle) &&
        number(st.flapPhase) && nonnegative(st.groundOffset) && st.flying === s.flying && st.recordBroken === s.recordBroken && nonnegative(st.recordToBeat) &&
        nonnegative(st.pipeElapsed) && nonnegative(st.pipeCount) && Array.isArray(st.pipes) && st.pipes.every((p) => object(p) && number(p.x) && number(p.gapY) && typeof p.passed === 'boolean' && integer(p.number) && typeof p.record === 'boolean') &&
        typeof s.flying === 'boolean' && typeof s.recordBroken === 'boolean' && typeof s.recordSaved === 'boolean' && typeof s.playerName === 'string'
    }
    if (game === 'tetris') {
      const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
      return matrix(st.board, 20, 10, (v) => v === null || types.includes(v)) && object(st.active) && types.includes(st.active.type) &&
        integer(st.active.x) && integer(st.active.y) && Array.isArray(st.active.shape) && st.active.shape.length >= 2 && st.active.shape.length <= 4 &&
        matrix(st.active.shape, st.active.shape.length, st.active.shape.length, (v) => v === 0 || v === 1) && types.includes(st.next) &&
        ['level', 'lines', 'elapsedMs', 'lastDrop', 'startTime'].every((key) => nonnegative(st[key])) && ['level', 'lines', 'elapsed'].every((key) => nonnegative(s[key]))
    }
    if (game === 'dino') {
      return ['dinoY', 'dinoVY', 'framesUntilSpawn', 'runFrame', 'groundOffset'].every((key) => number(st[key])) && nonnegative(st.speed) && nonnegative(st.distance) &&
        typeof st.ducking === 'boolean' && Array.isArray(st.obstacles) && st.obstacles.every((p) => object(p) && number(p.x) && number(p.w) && number(p.h) && ['cactus_s', 'cactus_l', 'cactus_double'].includes(p.type)) &&
        Array.isArray(st.clouds) && st.clouds.every((c) => object(c) && number(c.x) && number(c.y) && number(c.speed))
    }
    const item = (v: unknown) => object(v) && integer(v.id) && number(v.x) && number(v.y) && number(v.size) && number(v.rotation) && typeof v.caught === 'boolean' && ['gold_s', 'gold_m', 'gold_l', 'stone_s', 'stone_l', 'diamond', 'bag'].includes(v.type)
    return game === 'goldminer' && ['angle', 'swingDir', 'ropeLength', 'target', 'level', 'timeLeft', 'lastFrame'].every((key) => number(st[key])) &&
      ['swing', 'descend', 'retract'].includes(st.clawState) && typeof st.won === 'boolean' &&
      Array.isArray(st.items) && st.items.every(item) && ['target', 'level', 'timeLeft'].every((key) => nonnegative(s[key])) && typeof s.won === 'boolean' &&
      (st.caughtItem === null || item(st.caughtItem))
  } catch {
    return false
  }
}
