import { useEffect, useRef } from 'react'
import { getFlagTexture } from '@/lib/flags'

interface Props {
  flags: string[]
}

const CANVAS_H = 140
const CORD_Y = 16 // resting height of the anchor line
const GRAVITY = 0.4
const FRICTION = 0.985
const STIFFNESS_ITER = 3
const MOUSE_RADIUS = 90
const FLAG_W = 38
const FLAG_H = 27
const FLAG_SPACING = 48 // px between flag attachment points (smaller = more flags)
const ANCHOR_GAP = 300 // approx horizontal distance between fixed anchor pegs
const SLACK = 1.03 // rest-length multiplier → how much the cord droops between anchors
const SEG_LEN = 34 // cord point spacing (larger = fewer points = faster)
const FLAG_STRIP = 3 // px per drawn cloth strip (larger = fewer drawImage calls)
const FPS = 33

interface Point {
  x: number
  y: number
  ox: number
  oy: number
  pinned: boolean
  pinX: number
  pinY: number
}

interface FlagInst {
  pointIndex: number // which cord point it hangs from
  tex: HTMLCanvasElement // pre-rendered flag texture
  phase: number
}

export function FlagBunting({ flags }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flagsRef = useRef<string[]>(flags)
  flagsRef.current = flags.length > 0 ? flags : ['vietnam']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = window.innerWidth
    const H = CANVAS_H

    let points: Point[] = []
    let links: { a: number; b: number; len: number }[] = []
    let flagInsts: FlagInst[] = []

    const mouse = { x: -9999, y: -9999, active: false }

    const build = () => {
      W = window.innerWidth
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Cord spans full width. Points spaced evenly along the top.
      const margin = 16
      const span = W - margin * 2
      const count = Math.max(10, Math.floor(span / SEG_LEN))

      // Fixed anchor pegs across the width (not just the two ends) → the cord
      // hangs in several independent sagging arcs.
      const anchorCount = Math.max(2, Math.round(span / ANCHOR_GAP) + 1)
      const anchorXs: number[] = []
      for (let a = 0; a < anchorCount; a++) {
        anchorXs.push(margin + (a / (anchorCount - 1)) * span)
      }

      points = []
      for (let i = 0; i <= count; i++) {
        const t = i / count
        const x = margin + t * span
        const y = CORD_Y
        points.push({ x, y, ox: x, oy: y, pinned: false, pinX: x, pinY: y })
      }

      // Pin the point nearest each anchor x.
      for (const ax of anchorXs) {
        let best = 0
        let bestD = Infinity
        for (let i = 0; i < points.length; i++) {
          const d = Math.abs(points[i].x - ax)
          if (d < bestD) {
            bestD = d
            best = i
          }
        }
        const p = points[best]
        p.pinned = true
        p.y = CORD_Y
        p.oy = CORD_Y
        p.pinX = p.x
        p.pinY = CORD_Y
      }

      // Links with extra slack so each arc droops.
      links = []
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x
        const dy = points[i + 1].y - points[i].y
        links.push({ a: i, b: i + 1, len: Math.hypot(dx, dy) * SLACK })
      }

      // Place flags along the cord at FLAG_SPACING intervals.
      flagInsts = []
      const flagList = flagsRef.current
      const totalFlags = Math.max(1, Math.floor(span / FLAG_SPACING))
      for (let f = 0; f < totalFlags; f++) {
        const frac = (f + 0.5) / totalFlags
        const pointIndex = Math.round(frac * (points.length - 1))
        flagInsts.push({
          pointIndex,
          tex: getFlagTexture(flagList[f % flagList.length], FLAG_W * 2, FLAG_H * 2),
          phase: f * 0.7,
        })
      }
    }
    build()

    const onResize = () => build()
    window.addEventListener('resize', onResize)

    const onMove = (e: PointerEvent | MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = e.clientY < H + 40
    }
    const onLeave = () => {
      mouse.active = false
      mouse.x = -9999
      mouse.y = -9999
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onMove)
    window.addEventListener('mouseleave', onLeave)

    let raf = 0
    let last = performance.now()
    const t0 = performance.now()

    const simulate = () => {
      // Verlet integration
      for (const p of points) {
        if (p.pinned) continue
        const vx = (p.x - p.ox) * FRICTION
        const vy = (p.y - p.oy) * FRICTION
        p.ox = p.x
        p.oy = p.y
        p.x += vx
        p.y += vy + GRAVITY
      }
      // Mouse push — part the cord where the cursor passes
      if (mouse.active) {
        for (const p of points) {
          if (p.pinned) continue
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < MOUSE_RADIUS * MOUSE_RADIUS) {
            const d = Math.sqrt(d2) || 1
            const force = ((MOUSE_RADIUS - d) / MOUSE_RADIUS) * 6
            p.x += (dx / d) * force
            p.y += (dy / d) * force
          }
        }
      }
      // Constraints
      for (let iter = 0; iter < STIFFNESS_ITER; iter++) {
        for (const l of links) {
          const p1 = points[l.a]
          const p2 = points[l.b]
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const dist = Math.hypot(dx, dy) || 1
          const diff = (l.len - dist) / dist
          const ox = dx * 0.5 * diff
          const oy = dy * 0.5 * diff
          if (!p1.pinned) {
            p1.x -= ox
            p1.y -= oy
          }
          if (!p2.pinned) {
            p2.x += ox
            p2.y += oy
          }
        }
        // keep every anchor peg exactly in place
        for (const p of points) {
          if (p.pinned) {
            p.x = p.pinX
            p.y = p.pinY
          }
        }
      }
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, W, H)

      // Cord
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const cur = points[i]
        const mx = (prev.x + cur.x) / 2
        const my = (prev.y + cur.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      ctx.strokeStyle = 'rgba(40,30,20,0.85)'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Anchor pegs
      for (const p of points) {
        if (!p.pinned) continue
        ctx.fillStyle = 'rgba(30,22,14,0.95)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.arc(p.x - 1, p.y - 1, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Flags
      for (const f of flagInsts) {
        const p = points[f.pointIndex]
        const prev = points[Math.max(0, f.pointIndex - 1)]
        const next = points[Math.min(points.length - 1, f.pointIndex + 1)]
        // cord slope at this point → flag tilts to hang perpendicular-ish
        const slope = Math.atan2(next.y - prev.y, next.x - prev.x)
        // swing from horizontal velocity of the attachment point
        const swing = (p.x - p.ox) * 0.06
        drawFlag(ctx, f.tex, p.x, p.y + 2, slope, swing, time + f.phase)
      }
    }

    const frameMin = 1000 / FPS
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) {
        last = t
        return
      }
      if (t - last < frameMin) return
      last = t
      simulate()
      draw((t - t0) / 1000)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed top-0 left-0 z-40 pointer-events-none"
      style={{ height: CANVAS_H }}
    />
  )
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  x: number,
  y: number,
  slope: number,
  swing: number,
  time: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(slope * 0.6 + swing)

  // tiny attachment knot
  ctx.fillStyle = 'rgba(60,45,30,0.9)'
  ctx.fillRect(-1.5, -1.5, 3, 3)

  // Hang from top-center. Draw in horizontal cloth strips (cheap) with a
  // horizontal wave that grows toward the free bottom edge. No per-strip
  // shadows (those were the main perf cost).
  const halfW = FLAG_W / 2
  const strips = Math.ceil(FLAG_H / FLAG_STRIP)
  const srcH = tex.height
  const srcStripH = srcH / strips
  for (let s = 0; s < strips; s++) {
    const rowT = s / strips
    const srcY = Math.floor(rowT * srcH)
    const waveAmp = rowT * 5
    const offsetX = Math.sin(rowT * 5 + time * 3) * waveAmp
    ctx.drawImage(
      tex,
      0,
      srcY,
      tex.width,
      srcStripH,
      -halfW + offsetX,
      4 + s * FLAG_STRIP,
      FLAG_W,
      FLAG_STRIP + 0.6,
    )
  }
  ctx.restore()
}
