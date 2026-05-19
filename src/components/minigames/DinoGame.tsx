import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'

const W = 720
const H = 200
const GROUND_Y = 170
const DINO_X = 60
const GRAVITY = 0.7
const JUMP_VY = -12
const BASE_SPEED = 5
const MAX_SPEED = 13
const SPEED_RAMP = 0.0015 // per frame
const SPAWN_MIN = 60
const SPAWN_MAX = 130

type Obstacle = {
  x: number
  type: 'cactus_s' | 'cactus_l' | 'cactus_double'
  w: number
  h: number
}

type Cloud = { x: number; y: number; speed: number }

type GameState = {
  dinoY: number
  dinoVY: number
  ducking: boolean
  runFrame: number
  obstacles: Obstacle[]
  clouds: Cloud[]
  groundOffset: number
  speed: number
  framesUntilSpawn: number
  score: number
  distance: number
  over: boolean
}

function newObstacle(): Obstacle {
  const roll = Math.random()
  if (roll < 0.45) return { type: 'cactus_s', x: W + 10, w: 14, h: 30 }
  if (roll < 0.8) return { type: 'cactus_l', x: W + 10, w: 18, h: 42 }
  return { type: 'cactus_double', x: W + 10, w: 30, h: 34 }
}

function initial(): GameState {
  return {
    dinoY: GROUND_Y - 44,
    dinoVY: 0,
    ducking: false,
    runFrame: 0,
    obstacles: [],
    clouds: [
      { x: 200, y: 40, speed: 0.4 },
      { x: 480, y: 70, speed: 0.3 },
      { x: 650, y: 30, speed: 0.5 },
    ],
    groundOffset: 0,
    speed: BASE_SPEED,
    framesUntilSpawn: 60,
    score: 0,
    distance: 0,
    over: false,
  }
}

export function DinoGame() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(initial())
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.dino ?? 0)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const jump = useCallback(() => {
    const st = stateRef.current
    if (!running || st.over) return
    if (st.dinoY >= GROUND_Y - 44 - 0.5) {
      st.dinoVY = JUMP_VY
    }
  }, [running])

  const setDuck = useCallback(
    (down: boolean) => {
      const st = stateRef.current
      if (!running || st.over) return
      st.ducking = down
    },
    [running],
  )

  const start = useCallback(() => {
    stateRef.current = initial()
    setScore(0)
    setOver(false)
    setRunning(true)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        if (!running && !stateRef.current.over) start()
        else jump()
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setDuck(true)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setDuck(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [running, jump, setDuck, start])

  useEffect(() => {
    let raf = 0

    const drawDino = (ctx: CanvasRenderingContext2D, st: GameState) => {
      const x = DINO_X
      const baseY = st.dinoY
      const ducking = st.ducking && st.dinoY >= GROUND_Y - 44 - 0.5
      ctx.save()
      // ducking pose is shorter & longer
      if (ducking) ctx.translate(x, baseY + 14)
      else ctx.translate(x, baseY)

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(20, ducking ? 30 : 44, 22, 3, 0, 0, Math.PI * 2)
      ctx.fill()

      // body
      const body = ctx.createLinearGradient(0, 0, 0, 44)
      body.addColorStop(0, '#52525b')
      body.addColorStop(1, '#1f2937')
      ctx.fillStyle = body

      if (ducking) {
        // ducking: long horizontal body
        roundRect(ctx, 0, 14, 56, 16, 4)
        // head
        roundRect(ctx, 48, 8, 22, 18, 4)
        // eye
        ctx.fillStyle = '#fff'
        ctx.fillRect(62, 14, 4, 4)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(63, 15, 2, 2)
        // legs alternating (low)
        ctx.fillStyle = body as unknown as string
        ctx.fillStyle = '#1f2937'
        if (st.runFrame % 2 === 0) {
          ctx.fillRect(8, 28, 6, 6)
          ctx.fillRect(24, 30, 6, 4)
        } else {
          ctx.fillRect(8, 30, 6, 4)
          ctx.fillRect(24, 28, 6, 6)
        }
      } else {
        // standing
        // legs (drawn first, behind body)
        ctx.fillStyle = '#1f2937'
        if (st.runFrame % 2 === 0) {
          ctx.fillRect(10, 38, 6, 8)
          ctx.fillRect(20, 40, 6, 4)
        } else {
          ctx.fillRect(10, 40, 6, 4)
          ctx.fillRect(20, 38, 6, 8)
        }
        // tail
        ctx.beginPath()
        ctx.moveTo(0, 18)
        ctx.lineTo(-10, 8)
        ctx.lineTo(-8, 22)
        ctx.closePath()
        ctx.fill()
        // body
        ctx.fillStyle = body
        roundRect(ctx, 0, 16, 26, 24, 4)
        // arm (small T-rex arm)
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(20, 22, 5, 3)
        // head
        ctx.fillStyle = body
        roundRect(ctx, 18, 4, 24, 18, 5)
        // jaw under-shadow
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(20, 19, 18, 2)
        // eye
        ctx.fillStyle = '#fff'
        ctx.fillRect(33, 9, 4, 4)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(34, 10, 2, 2)
        // mouth line
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(28, 16, 8, 1)
        // nostril
        ctx.fillRect(38, 8, 1, 1)
        // belly highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(2, 26, 14, 6)
      }
      ctx.restore()
    }

    const drawCactus = (ctx: CanvasRenderingContext2D, ob: Obstacle) => {
      const x = ob.x
      const y = GROUND_Y - ob.h
      const grad = ctx.createLinearGradient(x, 0, x + ob.w, 0)
      grad.addColorStop(0, '#15803d')
      grad.addColorStop(0.5, '#22c55e')
      grad.addColorStop(1, '#14532d')
      ctx.fillStyle = grad
      if (ob.type === 'cactus_double') {
        // two cacti
        ctx.fillRect(x, y, 11, ob.h)
        ctx.fillRect(x + 16, y + 5, 11, ob.h - 5)
        // arms
        ctx.fillRect(x - 4, y + 8, 4, 10)
        ctx.fillRect(x + 11, y + 14, 4, 8)
        ctx.fillRect(x + 27, y + 12, 4, 10)
      } else {
        ctx.fillRect(x, y, ob.w * 0.55, ob.h)
        // side arm
        const armOnLeft = ob.type === 'cactus_s'
        if (armOnLeft) {
          ctx.fillRect(x - 4, y + 8, 4, ob.h * 0.4)
        } else {
          ctx.fillRect(x + ob.w * 0.55, y + 12, 4, ob.h * 0.45)
          ctx.fillRect(x - 4, y + 18, 4, ob.h * 0.3)
        }
      }
      // spikes detail (dark dots)
      ctx.fillStyle = '#052e16'
      for (let yy = y + 4; yy < y + ob.h; yy += 6) {
        ctx.fillRect(x + 3, yy, 1, 2)
        ctx.fillRect(x + 6, yy + 3, 1, 2)
      }
    }

    const drawCloud = (ctx: CanvasRenderingContext2D, c: Cloud) => {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2)
      ctx.arc(c.x + 8, c.y - 2, 10, 0, Math.PI * 2)
      ctx.arc(c.x + 16, c.y + 1, 8, 0, Math.PI * 2)
      ctx.arc(c.x + 6, c.y + 4, 7, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawGround = (ctx: CanvasRenderingContext2D, st: GameState) => {
      // ground line
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y + 1)
      ctx.lineTo(W, GROUND_Y + 1)
      ctx.stroke()
      // pebbles + dashes (scrolling)
      ctx.fillStyle = '#64748b'
      for (let i = 0; i < 30; i++) {
        const px = (((i * 91 - st.groundOffset) % (W + 50)) + W + 50) % (W + 50) - 25
        const py = GROUND_Y + 6 + ((i * 13) % 14)
        ctx.fillRect(px, py, 2, 2)
      }
      // dash marks
      ctx.fillStyle = '#94a3b8'
      for (let i = 0; i < 20; i++) {
        const px = (((i * 45 - st.groundOffset * 1.2) % (W + 30)) + W + 30) % (W + 30) - 15
        ctx.fillRect(px, GROUND_Y + 4, 6, 1)
      }
    }

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#0f172a')
      sky.addColorStop(0.5, '#334155')
      sky.addColorStop(1, '#1e293b')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      // stars
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      for (let i = 0; i < 24; i++) {
        const sx = (i * 73) % W
        const sy = (i * 31) % 90
        ctx.fillRect(sx, sy, 1, 1)
      }
      // moon
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.arc(W * 0.85, 36, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.arc(W * 0.85 + 5, 32, 14, 0, Math.PI * 2)
      ctx.fill()
      // clouds
      for (const c of st.clouds) drawCloud(ctx, c)
      // ground
      drawGround(ctx, st)
      // obstacles
      for (const ob of st.obstacles) drawCactus(ctx, ob)
      // dino
      drawDino(ctx, st)
      // score (in canvas, top right)
      ctx.fillStyle = '#cbd5e1'
      ctx.font = 'bold 18px ui-monospace, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(String(st.score).padStart(5, '0'), W - 14, 28)
      if (!running) {
        ctx.font = 'bold 14px ui-monospace, monospace'
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'right'
        ctx.fillText(`HI ${String(highScore).padStart(5, '0')}`, W - 14, 52)
      }
    }

    const collides = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

    const update = (dt: number) => {
      const st = stateRef.current
      if (st.over) return
      // speed ramp
      st.speed = Math.min(MAX_SPEED, st.speed + SPEED_RAMP * dt)
      // dino physics
      st.dinoVY += GRAVITY * dt * (st.ducking ? 2 : 1)
      st.dinoY += st.dinoVY * dt
      if (st.dinoY >= GROUND_Y - 44) {
        st.dinoY = GROUND_Y - 44
        st.dinoVY = 0
      }
      // run animation
      st.runFrame += dt * 0.18
      // ground scroll
      st.groundOffset += st.speed * dt
      // clouds
      for (const c of st.clouds) {
        c.x -= c.speed * dt
        if (c.x < -40) {
          c.x = W + 40
          c.y = 20 + Math.random() * 70
        }
      }
      // spawn obstacle
      st.framesUntilSpawn -= dt
      if (st.framesUntilSpawn <= 0) {
        st.obstacles.push(newObstacle())
        st.framesUntilSpawn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN) - st.speed * 4
      }
      // move obstacles
      for (const ob of st.obstacles) ob.x -= st.speed * dt
      st.obstacles = st.obstacles.filter((ob) => ob.x + ob.w > -5)
      // distance / score
      st.distance += st.speed * dt
      const newScore = Math.floor(st.distance / 5)
      if (newScore !== st.score) {
        st.score = newScore
        setScore(st.score)
      }
      // collision
      const ducking = st.ducking && st.dinoY >= GROUND_Y - 44 - 0.5
      const dinoBox = ducking
        ? { x: DINO_X + 6, y: GROUND_Y - 18, w: 50, h: 16 }
        : { x: DINO_X + 4, y: st.dinoY + 8, w: 38, h: 36 }
      for (const ob of st.obstacles) {
        const obBox = ob.type === 'cactus_double'
          ? { x: ob.x, y: GROUND_Y - ob.h, w: 30, h: ob.h }
          : { x: ob.x, y: GROUND_Y - ob.h, w: ob.w * 0.55, h: ob.h }
        if (collides(dinoBox, obBox)) {
          st.over = true
          setOver(true)
          setRunning(false)
          recordScore('dino', st.score)
          return
        }
      }
    }

    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(2.5, (t - last) / (1000 / 60))
      last = t
      if (running) update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, recordScore, highScore])

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      <div
        className="relative mx-auto w-full"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: 'calc(95vh - 220px)' }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={() => {
            if (!running && !stateRef.current.over) start()
            else jump()
          }}
          className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer select-none touch-none"
        />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm rounded-xl gap-2 pointer-events-none">
            {over ? (
              <>
                <div className="text-2xl font-bold text-white drop-shadow">
                  {t('minigame.gameOver')}
                </div>
                {score >= highScore && score > 0 && (
                  <div className="text-amber-300 text-sm font-medium">
                    ★ {t('minigame.newBest')}
                  </div>
                )}
                <Button onClick={start} className="mt-2 pointer-events-auto">
                  <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={start} size="lg" className="pointer-events-auto">
                  <Play className="h-5 w-5" /> {t('minigame.play')}
                </Button>
                <div className="text-[11px] text-white/70 mt-1 text-center max-w-[24rem]">
                  {t('minigame.dinoHint')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}
