export const W = 320
export const H = 480
export const PIPE_W = 60
export const PIPE_GAP = 130
export const PIPE_INTERVAL = 1500
export const PIPE_SPEED = 2.2
export const GROUND_H = 56
export const BIRD_R = 14
export const BIRD_X = 80
const GRAVITY = 0.42
const FLAP = -7.2

export type Pipe = { x: number; gapY: number; passed: boolean; number: number; record: boolean }
export type GameState = {
  width: number
  birdX: number
  birdY: number
  birdVY: number
  birdAngle: number
  flapPhase: number
  flying: boolean
  pipes: Pipe[]
  groundOffset: number
  score: number
  over: boolean
  pipeElapsed: number
  pipeCount: number
  recordToBeat: number
  recordBroken: boolean
}

export function initial(recordToBeat = 0, width = W): GameState {
  return {
    width, birdX: width / 4,
    birdY: (H - GROUND_H) / 2, birdVY: 0, birdAngle: 0, flapPhase: 0, flying: false,
    pipes: [],
    groundOffset: 0, score: 0, over: false, pipeElapsed: 0, pipeCount: 0,
    recordToBeat, recordBroken: false,
  }
}

export function resize(st: GameState, width: number) {
  const nextBirdX = width / 4
  for (const p of st.pipes) p.x += nextBirdX - st.birdX
  st.width = width
  st.birdX = nextBirdX
}

export function flap(st: GameState) {
  if (st.over) return
  st.flying = true
  st.birdVY = FLAP
  st.flapPhase = 0
}

export function update(st: GameState, delta: number, random = Math.random) {
  if (st.over || delta <= 0) return
  const dt = delta / (1000 / 60)
  st.flapPhase += 0.35 * dt
  st.groundOffset += PIPE_SPEED * dt
  // The ready phase scrolls the scenery without gravity, collisions, or pipes.
  if (!st.flying) return
  st.birdVY += GRAVITY * dt
  st.birdY += st.birdVY * dt
  st.birdAngle = Math.max(-0.45, Math.min(1.2, st.birdVY * 0.06))
  st.pipeElapsed += delta
  if (st.pipeElapsed >= PIPE_INTERVAL) {
    st.pipeElapsed %= PIPE_INTERVAL
    const number = ++st.pipeCount
    st.pipes.push({
      x: st.width + 10, gapY: 70 + random() * (H - GROUND_H - 70 - PIPE_GAP),
      passed: false, number, record: number === st.recordToBeat + 1,
    })
  }
  for (const p of st.pipes) p.x -= PIPE_SPEED * dt
  st.pipes = st.pipes.filter((p) => p.x + PIPE_W + 6 > -10)
  if (st.birdY + BIRD_R > H - GROUND_H || st.birdY - BIRD_R < 0) {
    st.over = true
    return
  }
  for (const p of st.pipes) {
    if (st.birdX + BIRD_R > p.x - 6 && st.birdX - BIRD_R < p.x + PIPE_W + 6 &&
      (st.birdY - BIRD_R < p.gapY || st.birdY + BIRD_R > p.gapY + PIPE_GAP)) {
      st.over = true
      return
    }
    if (!p.passed && p.x + PIPE_W + 6 < st.birdX - BIRD_R) {
      p.passed = true
      st.score++
      if (st.score > st.recordToBeat) st.recordBroken = true
    }
  }
}
