import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'

const W = 540
const H = 480

const ANCHOR_X = W / 2
const ANCHOR_Y = 76
const SWING_SPEED = 1.6 // rad/sec
const SWING_RANGE = (75 * Math.PI) / 180 // ±75°
const EXTEND_SPEED = 280 // px/sec
const RETRACT_BASE = 220 // px/sec base
const MIN_ROPE = 60
const MAX_ROPE = 440

type ItemType = 'gold_s' | 'gold_m' | 'gold_l' | 'stone_s' | 'stone_l' | 'diamond' | 'bag'

type Item = {
  id: number
  type: ItemType
  x: number
  y: number
  size: number
  rotation: number
  caught: boolean
}

const ITEM_INFO: Record<
  ItemType,
  { value: number; weight: number; color: string; size: number }
> = {
  gold_s: { value: 50, weight: 1.5, color: '#fbbf24', size: 18 },
  gold_m: { value: 100, weight: 2.5, color: '#f59e0b', size: 26 },
  gold_l: { value: 250, weight: 4.5, color: '#d97706', size: 38 },
  stone_s: { value: 11, weight: 3, color: '#9ca3af', size: 22 },
  stone_l: { value: 25, weight: 6, color: '#6b7280', size: 38 },
  diamond: { value: 500, weight: 1, color: '#67e8f9', size: 18 },
  bag: { value: 0 /* random */, weight: 2, color: '#a78bfa', size: 24 },
}

type ClawState = 'swing' | 'descend' | 'retract'

type GameState = {
  angle: number
  swingDir: number // 1 or -1
  ropeLength: number
  clawState: ClawState
  caughtItem: Item | null
  items: Item[]
  score: number
  target: number
  level: number
  timeLeft: number // sec
  over: boolean
  won: boolean
  lastFrame: number
}

let itemIdCounter = 0
function spawnItems(level: number): Item[] {
  const items: Item[] = []
  const pool: ItemType[] = [
    'gold_s', 'gold_s', 'gold_s',
    'gold_m', 'gold_m',
    'gold_l',
    'stone_s', 'stone_s',
    'stone_l',
  ]
  if (level >= 2) pool.push('diamond')
  if (level >= 3) pool.push('bag')
  // count grows with level
  const count = Math.min(14, 7 + level)
  for (let i = 0; i < count; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)]
    const info = ITEM_INFO[type]
    let tries = 0
    while (tries++ < 50) {
      const x = 40 + Math.random() * (W - 80)
      const y = 180 + Math.random() * (H - 180 - 50)
      const collides = items.some((it) => {
        const dx = it.x - x
        const dy = it.y - y
        return Math.sqrt(dx * dx + dy * dy) < it.size + info.size + 4
      })
      if (!collides) {
        items.push({
          id: itemIdCounter++,
          type,
          x,
          y,
          size: info.size,
          rotation: Math.random() * Math.PI,
          caught: false,
        })
        break
      }
    }
  }
  return items
}

function targetForLevel(level: number): number {
  return 500 + (level - 1) * 350
}

function initial(level = 1, prevScore = 0): GameState {
  return {
    angle: 0,
    swingDir: 1,
    ropeLength: MIN_ROPE,
    clawState: 'swing',
    caughtItem: null,
    items: spawnItems(level),
    score: prevScore,
    target: prevScore + targetForLevel(level),
    level,
    timeLeft: 60,
    over: false,
    won: false,
    lastFrame: 0,
  }
}

export function GoldMiner() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(initial())
  const [score, setScore] = useState(0)
  const [target, setTarget] = useState(targetForLevel(1))
  const [level, setLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.goldminer)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const start = useCallback(() => {
    stateRef.current = initial(1, 0)
    setScore(0)
    setTarget(targetForLevel(1))
    setLevel(1)
    setTimeLeft(60)
    setRunning(true)
    setOver(false)
    setWon(false)
  }, [])

  const nextLevel = useCallback(() => {
    const cur = stateRef.current
    stateRef.current = initial(cur.level + 1, cur.score)
    setLevel(cur.level + 1)
    setTarget(stateRef.current.target)
    setTimeLeft(60)
    setOver(false)
    setWon(false)
    setRunning(true)
  }, [])

  const claimLevel = useCallback(() => {
    const st = stateRef.current
    if (st.score < st.target) return
    st.won = true
    setWon(true)
    setRunning(false)
  }, [])

  const dropClaw = useCallback(() => {
    const st = stateRef.current
    if (st.clawState !== 'swing' || st.over) return
    st.clawState = 'descend'
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return
      if (!running) return
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        dropClaw()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, dropClaw])

  // game loop
  useEffect(() => {
    if (!running) return
    let raf = 0

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current

      drawSky(ctx)
      drawGround(ctx)
      drawPlatform(ctx, ANCHOR_X, 130)
      drawMiner(ctx, ANCHOR_X, 110)

      // items
      for (const it of st.items) {
        if (it.caught && st.caughtItem?.id !== it.id) continue
        if (it.caught && st.caughtItem?.id === it.id) continue // drawn with claw
        drawItem(ctx, it)
      }

      // rope + claw
      const angle = st.angle
      const ropeEndX = ANCHOR_X + Math.sin(angle) * st.ropeLength
      const ropeEndY = ANCHOR_Y + Math.cos(angle) * st.ropeLength
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ANCHOR_X, ANCHOR_Y)
      ctx.lineTo(ropeEndX, ropeEndY)
      ctx.stroke()

      // caught item rides with claw
      if (st.caughtItem) {
        const ci = { ...st.caughtItem, x: ropeEndX, y: ropeEndY + 8 }
        drawItem(ctx, ci)
      }

      drawClaw(ctx, ropeEndX, ropeEndY, angle)

      // HUD overlays drawn by React (timer/level/target)
    }

    const update = (dt: number) => {
      const st = stateRef.current
      if (st.over) return

      // timer
      st.timeLeft = Math.max(0, st.timeLeft - dt)
      setTimeLeft(Math.ceil(st.timeLeft))
      if (st.timeLeft <= 0 && st.clawState === 'swing') {
        // end game
        if (st.score >= st.target) {
          st.won = true
          setWon(true)
          setRunning(false)
        } else {
          st.over = true
          setOver(true)
          setRunning(false)
          recordScore('goldminer', st.score)
        }
        return
      }

      if (st.clawState === 'swing') {
        st.angle += st.swingDir * SWING_SPEED * dt
        if (st.angle > SWING_RANGE) {
          st.angle = SWING_RANGE
          st.swingDir = -1
        } else if (st.angle < -SWING_RANGE) {
          st.angle = -SWING_RANGE
          st.swingDir = 1
        }
      } else if (st.clawState === 'descend') {
        st.ropeLength += EXTEND_SPEED * dt
        // check collision with items
        const tipX = ANCHOR_X + Math.sin(st.angle) * st.ropeLength
        const tipY = ANCHOR_Y + Math.cos(st.angle) * st.ropeLength
        // out of bounds → start retract
        if (st.ropeLength >= MAX_ROPE || tipX < 0 || tipX > W || tipY > H - 10) {
          st.clawState = 'retract'
          return
        }
        for (const it of st.items) {
          if (it.caught) continue
          const dx = it.x - tipX
          const dy = it.y - tipY
          if (Math.sqrt(dx * dx + dy * dy) < it.size * 0.7 + 12) {
            it.caught = true
            st.caughtItem = it
            st.clawState = 'retract'
            return
          }
        }
      } else if (st.clawState === 'retract') {
        let speed = RETRACT_BASE
        if (st.caughtItem) {
          const info = ITEM_INFO[st.caughtItem.type]
          speed = Math.max(60, RETRACT_BASE / info.weight)
        }
        st.ropeLength -= speed * dt
        if (st.ropeLength <= MIN_ROPE) {
          st.ropeLength = MIN_ROPE
          // collect item
          if (st.caughtItem) {
            const t = st.caughtItem.type
            let val = ITEM_INFO[t].value
            if (t === 'bag') val = [25, 100, 250, 500][Math.floor(Math.random() * 4)]
            st.score += val
            setScore(st.score)
            st.items = st.items.filter((x) => x.id !== st.caughtItem!.id)
            st.caughtItem = null
            // check level completion
            if (st.score >= st.target && st.items.length === 0) {
              st.won = true
              setWon(true)
              setRunning(false)
              return
            }
          }
          st.clawState = 'swing'
        }
      }
    }

    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      update(dt)
      draw()
      if (!stateRef.current.over && !stateRef.current.won) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, recordScore])

  // record on game over
  useEffect(() => {
    if (over) recordScore('goldminer', stateRef.current.score)
  }, [over, recordScore])

  // idle draw
  useEffect(() => {
    if (running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawSky(ctx)
    drawGround(ctx)
    drawPlatform(ctx, ANCHOR_X, 130)
    drawMiner(ctx, ANCHOR_X, 110)
  }, [running])

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      <div className="flex items-center justify-between gap-2 text-xs text-white/85 tabular-nums flex-wrap">
        <span>
          {t('minigame.level')}: <span className="font-semibold text-white">{level}</span>
        </span>
        <span>
          {t('minigame.target')}: <span className="font-semibold text-amber-300">{target}</span>
        </span>
        <span className={timeLeft <= 10 ? 'text-rose-300 font-semibold' : ''}>
          ⏱ {timeLeft}s
        </span>
        {running && score >= target && (
          <Button
            size="sm"
            onClick={claimLevel}
            className="ml-auto bg-emerald-500 hover:bg-emerald-400 text-white animate-pulse"
          >
            ✓ {t('minigame.claimLevel')}
          </Button>
        )}
      </div>
      <div
        className="relative mx-auto"
        style={{ aspectRatio: `${W} / ${H}`, height: 'min(calc(95vh - 240px), 540px)' }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={dropClaw}
          className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer select-none"
        />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm rounded-xl gap-2">
            {won ? (
              <>
                <div className="text-2xl font-bold text-emerald-200 drop-shadow">
                  {t('minigame.levelClear')}!
                </div>
                <div className="text-sm text-white/75">
                  {t('minigame.score')}: {score} / {target}
                </div>
                <Button onClick={nextLevel} className="mt-2">
                  <Play className="h-4 w-4" /> {t('minigame.nextLevel')}
                </Button>
              </>
            ) : over ? (
              <>
                <div className="text-2xl font-bold text-white drop-shadow">{t('minigame.gameOver')}</div>
                <div className="text-sm text-white/75">
                  {t('minigame.score')}: {score} / {target}
                </div>
                {score >= highScore && score > 0 && (
                  <div className="text-amber-300 text-sm font-medium">★ {t('minigame.newBest')}</div>
                )}
                <Button onClick={start} className="mt-2">
                  <RotateCcw className="h-4 w-4" /> {t('minigame.playAgain')}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={start} size="lg">
                  <Play className="h-5 w-5" /> {t('minigame.play')}
                </Button>
                <div className="text-[11px] text-white/70 mt-1 text-center max-w-[18rem]">
                  {t('minigame.goldHint')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// === drawing helpers ===

function drawSky(ctx: CanvasRenderingContext2D) {
  // sunset gradient
  const sky = ctx.createLinearGradient(0, 0, 0, 160)
  sky.addColorStop(0, '#312e81')
  sky.addColorStop(0.35, '#7c3aed')
  sky.addColorStop(0.7, '#ea580c')
  sky.addColorStop(1, '#fb923c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, 160)

  // stars (top portion)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  const stars = [
    [40, 18], [80, 28], [120, 14], [170, 30], [230, 12],
    [290, 26], [340, 18], [410, 32], [470, 20], [520, 14],
  ]
  for (const [sx, sy] of stars) {
    ctx.beginPath()
    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  // sun
  const sunX = W * 0.78
  const sunY = 78
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90)
  halo.addColorStop(0, 'rgba(254, 240, 138, 0.85)')
  halo.addColorStop(0.4, 'rgba(253, 186, 116, 0.4)')
  halo.addColorStop(1, 'rgba(254, 240, 138, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180)
  const sunBody = ctx.createRadialGradient(sunX - 5, sunY - 5, 2, sunX, sunY, 24)
  sunBody.addColorStop(0, '#fef9c3')
  sunBody.addColorStop(1, '#f97316')
  ctx.fillStyle = sunBody
  ctx.beginPath()
  ctx.arc(sunX, sunY, 22, 0, Math.PI * 2)
  ctx.fill()

  // far mountains
  ctx.fillStyle = 'rgba(67, 56, 202, 0.55)'
  ctx.beginPath()
  ctx.moveTo(0, 160)
  for (let x = 0; x <= W; x += 30) {
    const h = 32 + Math.sin(x * 0.04) * 22 + Math.sin(x * 0.09) * 14
    ctx.lineTo(x, 160 - h)
  }
  ctx.lineTo(W, 160)
  ctx.closePath()
  ctx.fill()

  // near mountains (darker)
  ctx.fillStyle = 'rgba(30, 27, 75, 0.9)'
  ctx.beginPath()
  ctx.moveTo(0, 160)
  for (let x = 0; x <= W; x += 24) {
    const h = 22 + Math.sin(x * 0.06) * 16 + Math.sin(x * 0.13) * 11
    ctx.lineTo(x, 160 - h)
  }
  ctx.lineTo(W, 160)
  ctx.closePath()
  ctx.fill()

  // clouds
  const clouds: { x: number; y: number; r: number }[] = [
    { x: 70, y: 50, r: 16 },
    { x: 230, y: 36, r: 20 },
    { x: 410, y: 62, r: 14 },
  ]
  for (const c of clouds) drawCloud(ctx, c.x, c.y, c.r)

  // tree silhouettes near the mountain base
  drawTree(ctx, 60, 152, 22, '#1e293b')
  drawTree(ctx, 100, 154, 18, '#0f172a')
  drawTree(ctx, 460, 152, 24, '#1e293b')
  drawTree(ctx, 500, 155, 18, '#0f172a')
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  // top — peach lit
  ctx.fillStyle = '#fed7aa'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.arc(x + r * 0.75, y + r * 0.1, r * 0.85, 0, Math.PI * 2)
  ctx.arc(x - r * 0.75, y + r * 0.1, r * 0.8, 0, Math.PI * 2)
  ctx.arc(x + r * 0.3, y - r * 0.55, r * 0.6, 0, Math.PI * 2)
  ctx.fill()
  // bottom shading
  ctx.fillStyle = 'rgba(124, 45, 18, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.5, r * 1.1, r * 0.35, 0, 0, Math.PI)
  ctx.fill()
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, color: string) {
  ctx.fillStyle = color
  // triangle pine
  ctx.beginPath()
  ctx.moveTo(x, baseY - h)
  ctx.lineTo(x - h * 0.35, baseY)
  ctx.lineTo(x + h * 0.35, baseY)
  ctx.closePath()
  ctx.fill()
  // second tier
  ctx.beginPath()
  ctx.moveTo(x, baseY - h - h * 0.45)
  ctx.lineTo(x - h * 0.28, baseY - h * 0.4)
  ctx.lineTo(x + h * 0.28, baseY - h * 0.4)
  ctx.closePath()
  ctx.fill()
}

function drawGround(ctx: CanvasRenderingContext2D) {
  // grass top
  const grass = ctx.createLinearGradient(0, 152, 0, 172)
  grass.addColorStop(0, '#22c55e')
  grass.addColorStop(0.5, '#16a34a')
  grass.addColorStop(1, '#14532d')
  ctx.fillStyle = grass
  ctx.fillRect(0, 152, W, 20)
  // grass tufts
  ctx.fillStyle = '#4ade80'
  for (let x = 0; x < W; x += 8) {
    ctx.beginPath()
    ctx.moveTo(x, 152)
    ctx.lineTo(x + 2, 148)
    ctx.lineTo(x + 4, 152)
    ctx.closePath()
    ctx.fill()
  }
  // dirt
  const ground = ctx.createLinearGradient(0, 172, 0, H)
  ground.addColorStop(0, '#a16207')
  ground.addColorStop(0.3, '#78350f')
  ground.addColorStop(1, '#1c0a02')
  ctx.fillStyle = ground
  ctx.fillRect(0, 172, W, H - 172)
  // dirt speckles
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let i = 0; i < 80; i++) {
    const x = (i * 67) % W
    const y = 180 + ((i * 23) % (H - 200))
    ctx.beginPath()
    ctx.arc(x, y, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
  // dirt cracks (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(90, 200)
  ctx.lineTo(140, 230)
  ctx.lineTo(120, 270)
  ctx.moveTo(300, 220)
  ctx.lineTo(340, 250)
  ctx.moveTo(460, 250)
  ctx.lineTo(420, 290)
  ctx.stroke()
}

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // support posts
  ctx.fillStyle = '#451a03'
  ctx.fillRect(x - 26, y + 12, 5, 16)
  ctx.fillRect(x + 21, y + 12, 5, 16)
  // plank
  const plank = ctx.createLinearGradient(0, y, 0, y + 14)
  plank.addColorStop(0, '#b45309')
  plank.addColorStop(0.45, '#92400e')
  plank.addColorStop(1, '#451a03')
  ctx.fillStyle = plank
  ctx.fillRect(x - 32, y, 64, 14)
  // wood grain
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let i = 0; i < 7; i++) ctx.fillRect(x - 30 + i * 9, y + 2, 1.5, 10)
  // top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(x - 32, y, 64, 2)
  // pulley wheel (anchor for rope)
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.arc(x, ANCHOR_Y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#52525b'
  ctx.beginPath()
  ctx.arc(x, ANCHOR_Y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(x, ANCHOR_Y, 2, 0, Math.PI * 2)
  ctx.fill()
  // pulley bracket
  ctx.fillStyle = '#374151'
  ctx.fillRect(x - 10, ANCHOR_Y - 14, 4, 10)
  ctx.fillRect(x + 6, ANCHOR_Y - 14, 4, 10)
  ctx.fillRect(x - 12, ANCHOR_Y - 16, 24, 4)
}

function drawMiner(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  // long shadow under feet
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(0, 26, 22, 3.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // boots
  ctx.fillStyle = '#1c1917'
  roundRect(ctx, -13, 19, 11, 8, 2)
  roundRect(ctx, 2, 19, 11, 8, 2)
  ctx.fillStyle = '#44403c'
  ctx.fillRect(-13, 19, 11, 2)
  ctx.fillRect(2, 19, 11, 2)
  // pants
  const pants = ctx.createLinearGradient(0, 4, 0, 22)
  pants.addColorStop(0, '#1e40af')
  pants.addColorStop(1, '#1e3a8a')
  ctx.fillStyle = pants
  roundRect(ctx, -12, 4, 24, 18, 3)
  // belt
  ctx.fillStyle = '#78350f'
  ctx.fillRect(-13, 2, 26, 4)
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(-3, 2, 6, 4)
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 1
  ctx.strokeRect(-3, 2, 6, 4)
  // shirt body (red)
  const shirt = ctx.createLinearGradient(-12, -10, 12, 5)
  shirt.addColorStop(0, '#fca5a5')
  shirt.addColorStop(0.4, '#ef4444')
  shirt.addColorStop(1, '#7f1d1d')
  ctx.fillStyle = shirt
  roundRect(ctx, -13, -10, 26, 14, 4)
  // shirt center seam
  ctx.strokeStyle = 'rgba(120, 20, 20, 0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(0, 2)
  ctx.stroke()
  // suspenders
  ctx.strokeStyle = '#1e40af'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-6, -10)
  ctx.lineTo(-6, 6)
  ctx.moveTo(6, -10)
  ctx.lineTo(6, 6)
  ctx.stroke()
  // arms (raised holding rope)
  ctx.fillStyle = shirt as unknown as string
  ctx.fillStyle = '#ef4444'
  roundRect(ctx, -19, -10, 6, 12, 2)
  roundRect(ctx, 13, -10, 6, 12, 2)
  // hands (gloves)
  ctx.fillStyle = '#92400e'
  ctx.beginPath()
  ctx.arc(-16, -12, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(16, -12, 4, 0, Math.PI * 2)
  ctx.fill()
  // neck
  ctx.fillStyle = '#d97706'
  ctx.fillRect(-3, -14, 6, 4)
  // face (round, slightly oval)
  const face = ctx.createRadialGradient(-3, -22, 2, 0, -20, 13)
  face.addColorStop(0, '#fde68a')
  face.addColorStop(0.7, '#fbbf24')
  face.addColorStop(1, '#b45309')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.ellipse(0, -20, 10, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  // ears
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.arc(-9, -19, 2.5, 0, Math.PI * 2)
  ctx.arc(9, -19, 2.5, 0, Math.PI * 2)
  ctx.fill()
  // moustache (curly)
  ctx.fillStyle = '#451a03'
  ctx.beginPath()
  ctx.ellipse(-3, -15, 3.4, 1.6, -0.3, 0, Math.PI * 2)
  ctx.ellipse(3, -15, 3.4, 1.6, 0.3, 0, Math.PI * 2)
  ctx.fill()
  // mouth
  ctx.strokeStyle = '#7c2d12'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, -13, 2, 0.1, Math.PI - 0.1)
  ctx.stroke()
  // teeth tiny
  ctx.fillStyle = '#fff'
  ctx.fillRect(-1.3, -12.5, 2.6, 1)
  // nose
  ctx.fillStyle = '#d97706'
  ctx.beginPath()
  ctx.arc(0, -18, 1.6, 0, Math.PI * 2)
  ctx.fill()
  // eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-3.5, -22, 2, 0, Math.PI * 2)
  ctx.arc(3.5, -22, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-3.2, -22, 1.1, 0, Math.PI * 2)
  ctx.arc(3.8, -22, 1.1, 0, Math.PI * 2)
  ctx.fill()
  // eyebrows
  ctx.strokeStyle = '#451a03'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-6, -25)
  ctx.lineTo(-1.5, -25.5)
  ctx.moveTo(1.5, -25.5)
  ctx.lineTo(6, -25)
  ctx.stroke()
  // helmet — dome
  const helmet = ctx.createLinearGradient(0, -34, 0, -22)
  helmet.addColorStop(0, '#fef08a')
  helmet.addColorStop(0.5, '#facc15')
  helmet.addColorStop(1, '#92400e')
  ctx.fillStyle = helmet
  ctx.beginPath()
  ctx.arc(0, -25, 12, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  // helmet bottom rim
  ctx.fillStyle = '#92400e'
  ctx.fillRect(-13, -25, 26, 3)
  // helmet highlight
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(-4, -31, 4, 2, -0.5, 0, Math.PI * 2)
  ctx.fill()
  // helmet light housing
  ctx.fillStyle = '#374151'
  ctx.fillRect(-3, -33, 6, 3)
  // light glow
  ctx.shadowBlur = 16
  ctx.shadowColor = '#fef3c7'
  ctx.fillStyle = '#fef9c3'
  ctx.beginPath()
  ctx.arc(0, -32, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  // light shine
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.arc(-0.8, -33, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
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

function drawClaw(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  // wrist
  ctx.fillStyle = '#334155'
  ctx.fillRect(-5, -3, 10, 6)
  // jaws
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  // left
  ctx.beginPath()
  ctx.moveTo(-4, 2)
  ctx.lineTo(-10, 12)
  ctx.lineTo(-2, 14)
  ctx.stroke()
  // right
  ctx.beginPath()
  ctx.moveTo(4, 2)
  ctx.lineTo(10, 12)
  ctx.lineTo(2, 14)
  ctx.stroke()
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillRect(-3, -2, 2, 1)
  ctx.restore()
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item) {
  ctx.save()
  ctx.translate(it.x, it.y)
  ctx.rotate(it.rotation * 0.3)
  const info = ITEM_INFO[it.type]
  const r = it.size
  if (it.type === 'diamond') {
    // diamond shape
    ctx.shadowBlur = 16
    ctx.shadowColor = '#67e8f9'
    const grad = ctx.createLinearGradient(0, -r, 0, r)
    grad.addColorStop(0, '#cffafe')
    grad.addColorStop(0.5, '#22d3ee')
    grad.addColorStop(1, '#0e7490')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.7, -r * 0.2)
    ctx.lineTo(0, r)
    ctx.lineTo(-r * 0.7, -r * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-r * 0.5, -r * 0.2)
    ctx.lineTo(0, 0)
    ctx.lineTo(r * 0.5, -r * 0.2)
    ctx.stroke()
  } else if (it.type === 'bag') {
    // mystery bag
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.arc(0, 4, r * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#7c3aed'
    ctx.fillRect(-r * 0.5, -r * 0.7, r, r * 0.4)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${r}px ui-sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', 0, 4)
  } else if (it.type.startsWith('stone')) {
    ctx.fillStyle = '#4b5563'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const rr = r * (0.85 + 0.15 * Math.sin(i * 3))
      const px = Math.cos(a) * rr
      const py = Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.4, r * 0.2, -0.4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // gold nugget
    ctx.shadowBlur = 10
    ctx.shadowColor = info.color
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r)
    grad.addColorStop(0, '#fef3c7')
    grad.addColorStop(0.5, info.color)
    grad.addColorStop(1, '#92400e')
    ctx.fillStyle = grad
    ctx.beginPath()
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const rr = r * (0.85 + 0.15 * Math.sin(i * 2.7))
      const px = Math.cos(a) * rr
      const py = Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.12, -0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
