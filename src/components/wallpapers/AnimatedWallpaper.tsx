import { useEffect, useRef } from 'react'

export type AnimatedVariant = 'aurora' | 'stars' | 'particles' | 'mesh' | 'sakura'

const FPS = 30

interface Props {
  variant: AnimatedVariant
}

export function AnimatedWallpaper({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let state: unknown
    const reset = () => {
      state = createState(variant, w, h)
    }
    reset()
    const onResize = () => {
      resize()
      reset()
    }
    window.addEventListener('resize', onResize)

    let raf = 0
    let last = performance.now()
    const frameMin = 1000 / FPS

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) {
        last = t
        return
      }
      if (t - last < frameMin) return
      last = t
      render(ctx, state, variant, w, h, t / 1000)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  )
}

// === state ===

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

interface Particle {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  swaySpeed: number
  color: string
}

interface Blob {
  x: number
  y: number
  r: number
  color: string
  phase: number
  xAmp: number
  yAmp: number
  xFreq: number
  yFreq: number
}

interface AuroraBand {
  color: string
  y: number
  amp: number
  freq: number
  freq2: number
  phase: number
  speed: number
  thickness: number
}

interface Petal {
  x: number
  y: number
  size: number
  vy: number
  rot: number
  vRot: number
  sway: number
  swaySpeed: number
  flutter: number
}

interface AuroraState {
  bands: AuroraBand[]
  stars: Star[]
}
interface StarsState {
  stars: Star[]
  big: Star[]
  nebula: { x: number; y: number; r: number; color: string }[]
}
interface ParticlesState {
  particles: Particle[]
}
interface MeshState {
  blobs: Blob[]
}
interface SakuraState {
  petals: Petal[]
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createState(variant: AnimatedVariant, w: number, h: number): unknown {
  switch (variant) {
    case 'aurora': {
      const state: AuroraState = {
        bands: [
          { color: '#10b981', y: h * 0.55, amp: h * 0.12, freq: 0.0035, freq2: 0.008, phase: 0, speed: 0.25, thickness: h * 0.35 },
          { color: '#8b5cf6', y: h * 0.45, amp: h * 0.14, freq: 0.0028, freq2: 0.006, phase: 1.2, speed: 0.18, thickness: h * 0.3 },
          { color: '#06b6d4', y: h * 0.6, amp: h * 0.1, freq: 0.0045, freq2: 0.009, phase: 2.4, speed: 0.3, thickness: h * 0.4 },
          { color: '#ec4899', y: h * 0.4, amp: h * 0.16, freq: 0.0032, freq2: 0.007, phase: 3.6, speed: 0.22, thickness: h * 0.32 },
        ],
        stars: Array.from({ length: 80 }, () => ({
          x: rand(0, w),
          y: rand(0, h * 0.6),
          r: rand(0.4, 1.4),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.4, 1.4),
        })),
      }
      return state
    }
    case 'stars': {
      const state: StarsState = {
        stars: Array.from({ length: 240 }, () => ({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(0.3, 1.2),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.5, 2),
        })),
        big: Array.from({ length: 25 }, () => ({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(1.2, 2.4),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.3, 1.0),
        })),
        nebula: [
          { x: w * 0.2, y: h * 0.35, r: Math.max(w, h) * 0.45, color: '#3b0764' },
          { x: w * 0.8, y: h * 0.6, r: Math.max(w, h) * 0.4, color: '#1e3a8a' },
          { x: w * 0.5, y: h * 0.2, r: Math.max(w, h) * 0.3, color: '#831843' },
          { x: w * 0.6, y: h * 0.85, r: Math.max(w, h) * 0.35, color: '#0c4a6e' },
        ],
      }
      return state
    }
    case 'particles': {
      const palette = ['#fbbf24', '#a78bfa', '#06b6d4', '#f472b6', '#fde047', '#ffffff']
      const state: ParticlesState = {
        particles: Array.from({ length: 75 }, () => ({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(1.5, 3.5),
          vy: rand(0.15, 0.45),
          sway: rand(0, Math.PI * 2),
          swaySpeed: rand(0.4, 1.2),
          color: palette[Math.floor(Math.random() * palette.length)],
        })),
      }
      return state
    }
    case 'mesh': {
      const state: MeshState = {
        blobs: [
          { x: w * 0.25, y: h * 0.3, r: Math.max(w, h) * 0.55, color: '#8b5cf6', phase: 0, xAmp: w * 0.18, yAmp: h * 0.22, xFreq: 0.25, yFreq: 0.18 },
          { x: w * 0.75, y: h * 0.25, r: Math.max(w, h) * 0.5, color: '#ec4899', phase: 1, xAmp: w * 0.16, yAmp: h * 0.2, xFreq: 0.22, yFreq: 0.21 },
          { x: w * 0.3, y: h * 0.8, r: Math.max(w, h) * 0.48, color: '#06b6d4', phase: 2, xAmp: w * 0.2, yAmp: h * 0.18, xFreq: 0.18, yFreq: 0.24 },
          { x: w * 0.7, y: h * 0.75, r: Math.max(w, h) * 0.55, color: '#f59e0b', phase: 3, xAmp: w * 0.17, yAmp: h * 0.2, xFreq: 0.26, yFreq: 0.16 },
        ],
      }
      return state
    }
    case 'sakura': {
      const state: SakuraState = {
        petals: Array.from({ length: 60 }, () => ({
          x: rand(0, w),
          y: rand(-h, h),
          size: rand(8, 16),
          vy: rand(0.4, 1.0),
          rot: rand(0, Math.PI * 2),
          vRot: rand(-0.04, 0.04),
          sway: rand(0, Math.PI * 2),
          swaySpeed: rand(0.5, 1.2),
          flutter: rand(0.3, 0.8),
        })),
      }
      return state
    }
  }
}

// === render ===

function render(
  ctx: CanvasRenderingContext2D,
  state: unknown,
  variant: AnimatedVariant,
  w: number,
  h: number,
  time: number,
) {
  ctx.globalCompositeOperation = 'source-over'
  switch (variant) {
    case 'aurora':
      renderAurora(ctx, state as AuroraState, w, h, time)
      break
    case 'stars':
      renderStars(ctx, state as StarsState, w, h, time)
      break
    case 'particles':
      renderParticles(ctx, state as ParticlesState, w, h, time)
      break
    case 'mesh':
      renderMesh(ctx, state as MeshState, w, h, time)
      break
    case 'sakura':
      renderSakura(ctx, state as SakuraState, w, h, time)
      break
  }
}

function renderAurora(
  ctx: CanvasRenderingContext2D,
  state: AuroraState,
  w: number,
  h: number,
  t: number,
) {
  // night sky background
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#020617')
  bg.addColorStop(0.5, '#0b1437')
  bg.addColorStop(1, '#020617')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // distant stars
  for (const s of state.stars) {
    const tw = 0.4 + (Math.sin(t * s.speed + s.phase) + 1) * 0.3
    ctx.fillStyle = `rgba(220, 230, 255, ${tw})`
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // aurora bands
  ctx.globalCompositeOperation = 'lighter'
  for (const band of state.bands) {
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) {
      const y =
        band.y +
        Math.sin(x * band.freq + t * band.speed + band.phase) * band.amp +
        Math.sin(x * band.freq2 + t * band.speed * 1.4 + band.phase) * band.amp * 0.4
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()

    const top =
      band.y -
      band.amp * 1.4 +
      Math.sin(t * band.speed) * band.amp * 0.2
    const grad = ctx.createLinearGradient(0, top, 0, top + band.thickness)
    grad.addColorStop(0, hexAlpha(band.color, 0))
    grad.addColorStop(0.3, hexAlpha(band.color, 0.55))
    grad.addColorStop(0.65, hexAlpha(band.color, 0.18))
    grad.addColorStop(1, hexAlpha(band.color, 0))
    ctx.fillStyle = grad
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // ground silhouette for depth
  const ground = ctx.createLinearGradient(0, h * 0.85, 0, h)
  ground.addColorStop(0, 'rgba(0,0,0,0)')
  ground.addColorStop(1, 'rgba(2, 6, 23, 0.95)')
  ctx.fillStyle = ground
  ctx.fillRect(0, h * 0.85, w, h * 0.15)
  // mountain ridge
  ctx.fillStyle = 'rgba(2, 6, 23, 0.95)'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 40) {
    const y = h * 0.93 - Math.abs(Math.sin(x * 0.004 + 1.2)) * h * 0.05 - Math.sin(x * 0.011) * h * 0.02
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function renderStars(
  ctx: CanvasRenderingContext2D,
  state: StarsState,
  w: number,
  h: number,
  t: number,
) {
  // deep space
  ctx.fillStyle = '#000010'
  ctx.fillRect(0, 0, w, h)

  // nebula glow
  ctx.globalCompositeOperation = 'screen'
  for (const n of state.nebula) {
    const cx = n.x + Math.sin(t * 0.1 + n.x * 0.001) * w * 0.05
    const cy = n.y + Math.cos(t * 0.08 + n.y * 0.001) * h * 0.05
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r)
    grad.addColorStop(0, hexAlpha(n.color, 0.45))
    grad.addColorStop(0.5, hexAlpha(n.color, 0.18))
    grad.addColorStop(1, hexAlpha(n.color, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, n.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // small stars
  for (const s of state.stars) {
    const tw = 0.3 + (Math.sin(t * s.speed + s.phase) + 1) * 0.35
    ctx.fillStyle = `rgba(255, 255, 255, ${tw})`
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  // big stars with glow
  ctx.globalCompositeOperation = 'lighter'
  for (const s of state.big) {
    const tw = 0.4 + (Math.sin(t * s.speed + s.phase) + 1) * 0.35
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6)
    grad.addColorStop(0, `rgba(255, 255, 255, ${tw})`)
    grad.addColorStop(0.4, `rgba(180, 200, 255, ${tw * 0.3})`)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2)
    ctx.fill()
    // cross sparkle
    ctx.strokeStyle = `rgba(255, 255, 255, ${tw * 0.4})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(s.x - s.r * 5, s.y)
    ctx.lineTo(s.x + s.r * 5, s.y)
    ctx.moveTo(s.x, s.y - s.r * 5)
    ctx.lineTo(s.x, s.y + s.r * 5)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // shooting star every now and then
  const shootingT = (t * 0.07) % 1
  if (shootingT < 0.15) {
    const progress = shootingT / 0.15
    const seed = Math.floor(t * 0.07)
    const sx = (seed * 137.5) % w
    const sy = ((seed * 53.7) % (h * 0.5))
    const x = sx + progress * w * 0.4
    const y = sy + progress * h * 0.3
    const tailLen = 80
    const grad = ctx.createLinearGradient(x - tailLen, y - tailLen * 0.7, x, y)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, `rgba(255,255,255,${1 - progress})`)
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - tailLen, y - tailLen * 0.7)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  state: ParticlesState,
  w: number,
  h: number,
  t: number,
) {
  // bg
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0f172a')
  bg.addColorStop(0.5, '#1e1b4b')
  bg.addColorStop(1, '#172554')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'lighter'
  for (const p of state.particles) {
    p.y -= p.vy
    p.x += Math.sin(t * p.swaySpeed + p.sway) * 0.35
    if (p.y < -p.r * 6) {
      p.y = h + p.r * 6
      p.x = rand(0, w)
    }
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
    grad.addColorStop(0, hexAlpha(p.color, 0.85))
    grad.addColorStop(0.3, hexAlpha(p.color, 0.4))
    grad.addColorStop(1, hexAlpha(p.color, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function renderMesh(
  ctx: CanvasRenderingContext2D,
  state: MeshState,
  w: number,
  h: number,
  t: number,
) {
  ctx.fillStyle = '#080814'
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'
  for (const b of state.blobs) {
    const bx = b.x + Math.sin(t * b.xFreq + b.phase) * b.xAmp
    const by = b.y + Math.cos(t * b.yFreq + b.phase * 1.3) * b.yAmp
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r)
    grad.addColorStop(0, hexAlpha(b.color, 0.85))
    grad.addColorStop(0.4, hexAlpha(b.color, 0.4))
    grad.addColorStop(1, hexAlpha(b.color, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(bx, by, b.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // gentle dark vignette to anchor center content
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.8)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

function renderSakura(
  ctx: CanvasRenderingContext2D,
  state: SakuraState,
  w: number,
  h: number,
  t: number,
) {
  // warm spring sky
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#fdf2f8')
  sky.addColorStop(0.4, '#fce7f3')
  sky.addColorStop(0.8, '#fbcfe8')
  sky.addColorStop(1, '#f9a8d4')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // soft sun glow
  const sunGrad = ctx.createRadialGradient(w * 0.75, h * 0.25, 0, w * 0.75, h * 0.25, Math.max(w, h) * 0.45)
  sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.6)')
  sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)')
  ctx.fillStyle = sunGrad
  ctx.fillRect(0, 0, w, h)

  // petals
  for (const p of state.petals) {
    p.y += p.vy
    p.x += Math.sin(t * p.swaySpeed + p.sway) * p.flutter
    p.rot += p.vRot
    if (p.y > h + p.size) {
      p.y = -p.size
      p.x = rand(0, w)
    }
    drawPetal(ctx, p.x, p.y, p.size, p.rot)
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  // petal shape — oval with notch
  const grad = ctx.createRadialGradient(0, -size * 0.2, size * 0.1, 0, 0, size)
  grad.addColorStop(0, '#fff1f7')
  grad.addColorStop(0.5, '#fbcfe8')
  grad.addColorStop(1, '#f472b6')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.6)
  ctx.bezierCurveTo(size * 0.7, -size * 0.5, size * 0.6, size * 0.6, 0, size * 0.6)
  ctx.bezierCurveTo(-size * 0.6, size * 0.6, -size * 0.7, -size * 0.5, 0, -size * 0.6)
  ctx.fill()
  // notch
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.beginPath()
  ctx.ellipse(0, size * 0.4, size * 0.18, size * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
