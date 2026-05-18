import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Upload, X } from 'lucide-react'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { ScoreBoard } from './ScoreBoard'

const CUSTOM_BIRD_KEY = 'flappy:bird:custom'

const W = 320
const H = 480

const GRAVITY = 0.42
const FLAP = -7.2
const PIPE_W = 60
const PIPE_GAP = 130
const PIPE_INTERVAL = 1500 // ms
const PIPE_SPEED = 2.2
const GROUND_H = 56
const BIRD_R = 14

type Pipe = { x: number; gapY: number; passed: boolean }
type Cloud = { x: number; y: number; r: number; speed: number }

type GameState = {
  birdY: number
  birdVY: number
  birdAngle: number
  flapPhase: number
  pipes: Pipe[]
  clouds: Cloud[]
  groundOffset: number
  score: number
  over: boolean
  lastPipe: number
}

function makeClouds(): Cloud[] {
  return Array.from({ length: 4 }, () => ({
    x: Math.random() * W,
    y: 40 + Math.random() * 140,
    r: 14 + Math.random() * 12,
    speed: 0.25 + Math.random() * 0.35,
  }))
}

function initial(): GameState {
  return {
    birdY: H / 2,
    birdVY: 0,
    birdAngle: 0,
    flapPhase: 0,
    pipes: [],
    clouds: makeClouds(),
    groundOffset: 0,
    score: 0,
    over: false,
    lastPipe: 0,
  }
}

function randomGap(): number {
  return 70 + Math.random() * (H - GROUND_H - 70 - PIPE_GAP)
}

export function FlappyBird() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const customImgRef = useRef<HTMLImageElement | null>(null)
  const customUrlRef = useRef<string | null>(null)
  const [hasCustom, setHasCustom] = useState(false)
  const stateRef = useRef<GameState>(initial())
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const highScore = useMinigameStore((s) => s.highScores.flappy)
  const recordScore = useMinigameStore((s) => s.recordScore)

  const flap = useCallback(() => {
    if (!running) return
    if (stateRef.current.over) return
    stateRef.current.birdVY = FLAP
    stateRef.current.flapPhase = 0
  }, [running])

  const start = useCallback(() => {
    stateRef.current = initial()
    setScore(0)
    setOver(false)
    setRunning(true)
  }, [])

  // load custom bird image from IDB
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const blob = await idbGet<Blob>(CUSTOM_BIRD_KEY)
      if (!blob || cancelled) return
      const url = URL.createObjectURL(blob)
      customUrlRef.current = url
      const img = new Image()
      img.onload = () => {
        if (!cancelled) {
          customImgRef.current = img
          setHasCustom(true)
        }
      }
      img.src = url
    })()
    return () => {
      cancelled = true
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
    }
  }, [])

  const uploadCustomBird = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    await idbSet(CUSTOM_BIRD_KEY, file)
    if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
    const url = URL.createObjectURL(file)
    customUrlRef.current = url
    const img = new Image()
    img.onload = () => {
      customImgRef.current = img
      setHasCustom(true)
    }
    img.src = url
  }

  const resetCustomBird = async () => {
    await idbDel(CUSTOM_BIRD_KEY)
    if (customUrlRef.current) {
      URL.revokeObjectURL(customUrlRef.current)
      customUrlRef.current = null
    }
    customImgRef.current = null
    setHasCustom(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      if (e.key !== ' ' && e.key !== 'Spacebar') return
      e.preventDefault()
      if (!running && !over) start()
      else flap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, over, flap, start])

  useEffect(() => {
    let raf = 0

    const drawSky = (ctx: CanvasRenderingContext2D, st: GameState) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H)
      sky.addColorStop(0, '#7dd3fc')
      sky.addColorStop(1, '#bae6fd')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H - GROUND_H)
      // sun
      const sunGrad = ctx.createRadialGradient(W - 50, 60, 0, W - 50, 60, 50)
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)')
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)')
      ctx.fillStyle = sunGrad
      ctx.beginPath()
      ctx.arc(W - 50, 60, 50, 0, Math.PI * 2)
      ctx.fill()
      // clouds
      for (const c of st.clouds) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.arc(c.x + c.r * 0.7, c.y + c.r * 0.1, c.r * 0.8, 0, Math.PI * 2)
        ctx.arc(c.x - c.r * 0.7, c.y + c.r * 0.1, c.r * 0.75, 0, Math.PI * 2)
        ctx.arc(c.x + c.r * 0.3, c.y - c.r * 0.5, c.r * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      // distant hills silhouette
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)'
      ctx.beginPath()
      ctx.moveTo(0, H - GROUND_H)
      for (let x = 0; x <= W; x += 40) {
        const h = 30 + Math.sin(x * 0.05) * 18
        ctx.lineTo(x, H - GROUND_H - h)
      }
      ctx.lineTo(W, H - GROUND_H)
      ctx.closePath()
      ctx.fill()
    }

    const drawPipe = (ctx: CanvasRenderingContext2D, p: Pipe) => {
      // top pipe
      drawPipeSection(ctx, p.x, 0, p.gapY, true)
      // bottom pipe
      drawPipeSection(ctx, p.x, p.gapY + PIPE_GAP, H - GROUND_H - (p.gapY + PIPE_GAP), false)
    }
    const drawPipeSection = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      h: number,
      isTop: boolean,
    ) => {
      // body gradient (3D shading)
      const grad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
      grad.addColorStop(0, '#166534')
      grad.addColorStop(0.15, '#16a34a')
      grad.addColorStop(0.4, '#22c55e')
      grad.addColorStop(0.55, '#86efac')
      grad.addColorStop(0.65, '#22c55e')
      grad.addColorStop(0.9, '#15803d')
      grad.addColorStop(1, '#14532d')
      ctx.fillStyle = grad
      ctx.fillRect(x, y, PIPE_W, h)
      // vertical highlight stripe
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(x + 8, y, 4, h)
      // dark shadow stripe
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(x + PIPE_W - 12, y, 4, h)
      // cap
      const capH = 18
      const capY = isTop ? y + h - capH : y
      const capGrad = ctx.createLinearGradient(x - 6, 0, x + PIPE_W + 6, 0)
      capGrad.addColorStop(0, '#0f5132')
      capGrad.addColorStop(0.2, '#15803d')
      capGrad.addColorStop(0.5, '#34d399')
      capGrad.addColorStop(0.8, '#15803d')
      capGrad.addColorStop(1, '#052e16')
      ctx.fillStyle = capGrad
      ctx.fillRect(x - 6, capY, PIPE_W + 12, capH)
      // cap inner shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(x - 6, isTop ? capY + capH - 3 : capY, PIPE_W + 12, 3)
      // cap top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(x - 6, isTop ? capY : capY + 1, PIPE_W + 12, 2)
    }

    const drawGround = (ctx: CanvasRenderingContext2D, off: number) => {
      // grass strip
      const grassGrad = ctx.createLinearGradient(0, H - GROUND_H, 0, H - GROUND_H + 14)
      grassGrad.addColorStop(0, '#16a34a')
      grassGrad.addColorStop(1, '#166534')
      ctx.fillStyle = grassGrad
      ctx.fillRect(0, H - GROUND_H, W, 14)
      // grass tufts (scrolling)
      ctx.fillStyle = '#22c55e'
      for (let x = -((off * 2) % 8); x < W; x += 8) {
        ctx.beginPath()
        ctx.moveTo(x, H - GROUND_H)
        ctx.lineTo(x + 2, H - GROUND_H - 4)
        ctx.lineTo(x + 4, H - GROUND_H)
        ctx.closePath()
        ctx.fill()
      }
      // dirt
      const dirt = ctx.createLinearGradient(0, H - GROUND_H + 14, 0, H)
      dirt.addColorStop(0, '#92400e')
      dirt.addColorStop(0.5, '#7c2d12')
      dirt.addColorStop(1, '#431407')
      ctx.fillStyle = dirt
      ctx.fillRect(0, H - GROUND_H + 14, W, GROUND_H - 14)
      // pebbles
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let i = 0; i < 12; i++) {
        const px = (((i * 47) - off) % (W + 40) + W + 40) % (W + 40) - 20
        const py = H - GROUND_H + 22 + ((i * 13) % (GROUND_H - 28))
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // top edge line
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, H - GROUND_H + 14, W, 1)
    }

    const drawBird = (ctx: CanvasRenderingContext2D, st: GameState) => {
      const bx = 80
      const by = st.birdY
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(st.birdAngle)
      // custom image path
      const img = customImgRef.current
      if (img && img.complete && img.naturalWidth > 0) {
        const size = BIRD_R * 2.6
        ctx.shadowBlur = 10
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.drawImage(img, -size / 2, -size / 2, size, size)
        ctx.shadowBlur = 0
        ctx.restore()
        return
      }
      // ---- default canvas bird ----
      // body drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(2, BIRD_R + 2, BIRD_R + 2, BIRD_R * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      // wing back (behind body) - animated
      const flap = Math.sin(st.flapPhase)
      const wingBackY = 1 + flap * 5
      const wingBack = ctx.createLinearGradient(0, -6, 0, 10)
      wingBack.addColorStop(0, '#ea580c')
      wingBack.addColorStop(1, '#7c2d12')
      ctx.fillStyle = wingBack
      ctx.beginPath()
      ctx.ellipse(-4, wingBackY, 10, 5.5, -0.2 + flap * 0.15, 0, Math.PI * 2)
      ctx.fill()
      // tail feathers — 3 fanned plumes
      const tailColors = ['#f97316', '#fb923c', '#fdba74']
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = tailColors[i]
        ctx.beginPath()
        ctx.moveTo(-BIRD_R + 2, 0)
        ctx.quadraticCurveTo(-BIRD_R - 6, -6 + i * 5, -BIRD_R - 9, -3 + i * 5)
        ctx.quadraticCurveTo(-BIRD_R - 6, 1 + i * 5, -BIRD_R + 2, 4)
        ctx.closePath()
        ctx.fill()
      }
      // body — yellow gradient sphere
      const body = ctx.createRadialGradient(-4, -5, 2, 0, 3, BIRD_R + 5)
      body.addColorStop(0, '#fffbeb')
      body.addColorStop(0.35, '#fde047')
      body.addColorStop(0.75, '#eab308')
      body.addColorStop(1, '#854d0e')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
      ctx.fill()
      // body outline subtle
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)'
      ctx.lineWidth = 1.3
      ctx.stroke()
      // belly — white/cream patch
      const bellyGrad = ctx.createRadialGradient(-2, 4, 1, -2, 6, BIRD_R)
      bellyGrad.addColorStop(0, 'rgba(255,255,255,0.85)')
      bellyGrad.addColorStop(0.7, 'rgba(254,243,199,0.5)')
      bellyGrad.addColorStop(1, 'rgba(254,243,199,0)')
      ctx.fillStyle = bellyGrad
      ctx.beginPath()
      ctx.ellipse(-2, 4, BIRD_R * 0.75, BIRD_R * 0.55, 0, 0, Math.PI * 2)
      ctx.fill()
      // front wing — bigger, animated
      const wingFrontY = 2 + flap * 4
      const wingFront = ctx.createLinearGradient(0, -4, 0, 12)
      wingFront.addColorStop(0, '#fbbf24')
      wingFront.addColorStop(0.5, '#f59e0b')
      wingFront.addColorStop(1, '#b45309')
      ctx.fillStyle = wingFront
      ctx.save()
      ctx.translate(-2, wingFrontY)
      ctx.rotate(flap * 0.2)
      ctx.beginPath()
      ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
      // feather detail lines
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)'
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(-5 + i * 4, -1)
        ctx.lineTo(-6 + i * 4, 4)
        ctx.stroke()
      }
      ctx.restore()
      // cheek blush
      ctx.fillStyle = 'rgba(244, 114, 182, 0.5)'
      ctx.beginPath()
      ctx.arc(7, 2, 2.5, 0, Math.PI * 2)
      ctx.fill()
      // eye socket (darker patch)
      ctx.fillStyle = 'rgba(120, 53, 15, 0.25)'
      ctx.beginPath()
      ctx.arc(5.5, -5, 5.3, 0, Math.PI * 2)
      ctx.fill()
      // eye sclera
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(5.5, -5, 4.6, 0, Math.PI * 2)
      ctx.fill()
      // iris
      ctx.fillStyle = '#0c4a6e'
      ctx.beginPath()
      ctx.arc(6.5, -5, 2.6, 0, Math.PI * 2)
      ctx.fill()
      // pupil
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(7, -5, 1.5, 0, Math.PI * 2)
      ctx.fill()
      // eye shine (two)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(6.2, -6, 1.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(7.7, -4.2, 0.6, 0, Math.PI * 2)
      ctx.fill()
      // beak — upper triangle
      const beakUpper = ctx.createLinearGradient(0, -3, 0, 1)
      beakUpper.addColorStop(0, '#fb923c')
      beakUpper.addColorStop(1, '#c2410c')
      ctx.fillStyle = beakUpper
      ctx.beginPath()
      ctx.moveTo(BIRD_R - 3, -3)
      ctx.lineTo(BIRD_R + 9, -1)
      ctx.lineTo(BIRD_R - 3, 1)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)'
      ctx.lineWidth = 0.8
      ctx.stroke()
      // beak — lower triangle (slightly open when flapping)
      const beakLower = ctx.createLinearGradient(0, 0, 0, 5)
      beakLower.addColorStop(0, '#ea580c')
      beakLower.addColorStop(1, '#7c2d12')
      ctx.fillStyle = beakLower
      const beakOpen = Math.max(0, flap) * 1.5
      ctx.beginPath()
      ctx.moveTo(BIRD_R - 3, 1)
      ctx.lineTo(BIRD_R + 8, 0)
      ctx.lineTo(BIRD_R - 2, 3 + beakOpen)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // beak highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillRect(BIRD_R - 1, -2.2, 4, 0.7)
      // feet (small, hanging)
      ctx.strokeStyle = '#ea580c'
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-3, BIRD_R - 2)
      ctx.lineTo(-3, BIRD_R + 4)
      ctx.moveTo(3, BIRD_R - 2)
      ctx.lineTo(3, BIRD_R + 4)
      ctx.stroke()
      ctx.restore()
    }

    const drawScore = (ctx: CanvasRenderingContext2D, st: GameState) => {
      const s = String(st.score)
      ctx.font = 'bold 44px ui-sans-serif, system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillText(s, W / 2 + 2, 64)
      // outline
      ctx.lineWidth = 4
      ctx.strokeStyle = '#0f172a'
      ctx.strokeText(s, W / 2, 60)
      ctx.fillStyle = '#fff'
      ctx.fillText(s, W / 2, 60)
    }

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current
      drawSky(ctx, st)
      for (const p of st.pipes) drawPipe(ctx, p)
      drawGround(ctx, st.groundOffset)
      drawBird(ctx, st)
      if (running) drawScore(ctx, st)
    }

    const update = (dt: number) => {
      const st = stateRef.current
      if (st.over) return
      // bird
      st.birdVY += GRAVITY * dt
      st.birdY += st.birdVY * dt
      st.birdAngle = Math.max(-0.45, Math.min(1.2, st.birdVY * 0.06))
      st.flapPhase += 0.35 * dt
      // ground scroll
      st.groundOffset += PIPE_SPEED * dt
      // clouds drift
      for (const c of st.clouds) {
        c.x -= c.speed * dt
        if (c.x + c.r * 2 < 0) {
          c.x = W + c.r * 2
          c.y = 40 + Math.random() * 140
        }
      }
      // spawn pipes
      const now = performance.now()
      if (now - st.lastPipe > PIPE_INTERVAL) {
        st.pipes.push({ x: W + 10, gapY: randomGap(), passed: false })
        st.lastPipe = now
      }
      // move pipes
      for (const p of st.pipes) p.x -= PIPE_SPEED * dt
      st.pipes = st.pipes.filter((p) => p.x + PIPE_W > -10)
      // collision
      const bx = 80
      if (st.birdY + BIRD_R > H - GROUND_H || st.birdY - BIRD_R < 0) {
        st.over = true
        setOver(true)
        setRunning(false)
        recordScore('flappy', st.score)
        return
      }
      for (const p of st.pipes) {
        if (bx + BIRD_R > p.x && bx - BIRD_R < p.x + PIPE_W) {
          if (st.birdY - BIRD_R < p.gapY || st.birdY + BIRD_R > p.gapY + PIPE_GAP) {
            st.over = true
            setOver(true)
            setRunning(false)
            recordScore('flappy', st.score)
            return
          }
        }
        if (!p.passed && p.x + PIPE_W < bx) {
          p.passed = true
          st.score += 1
          setScore(st.score)
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
  }, [running, recordScore])

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <ScoreBoard score={score} best={highScore} label={t('minigame.score')} />
      <div
        className="relative flex-1 min-h-0 mx-auto w-full"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: 'calc(95vh - 220px)' }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={() => {
            if (!running && !over) start()
            else flap()
          }}
          className="absolute inset-0 w-full h-full rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none touch-none cursor-pointer"
        />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-sm rounded-xl gap-2 pointer-events-none">
            {over ? (
              <>
                <div className="text-2xl font-bold text-white drop-shadow">{t('minigame.gameOver')}</div>
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
                <div className="text-[11px] text-white/70 mt-1">{t('minigame.flappyHint')}</div>
                <div className="flex items-center gap-2 mt-2 pointer-events-auto">
                  <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-xs cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {t('minigame.customBird')}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadCustomBird(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {hasCustom && (
                    <Button variant="ghost" size="sm" onClick={resetCustomBird} className="h-8 px-2 text-xs">
                      <X className="h-3.5 w-3.5" />
                      {t('minigame.resetBird')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
