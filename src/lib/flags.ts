// Procedural national/themed flag textures drawn onto a flat offscreen canvas.
// The bunting renderer then slices each texture into rows to fake cloth waving.

export interface FlagDef {
  id: string
  name: string
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

function star(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  rotation = -Math.PI / 2,
) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i * Math.PI) / points + rotation
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

export const FLAGS: FlagDef[] = [
  {
    id: 'vietnam',
    name: 'Việt Nam',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#da251d'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffff00'
      star(ctx, w / 2, h / 2, h * 0.32, h * 0.13, 5)
    },
  },
  {
    id: 'usa',
    name: 'USA',
    draw: (ctx, w, h) => {
      const stripeH = h / 13
      for (let i = 0; i < 13; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#b22234' : '#ffffff'
        ctx.fillRect(0, i * stripeH, w, stripeH + 0.5)
      }
      const cantonW = w * 0.4
      const cantonH = stripeH * 7
      ctx.fillStyle = '#3c3b6e'
      ctx.fillRect(0, 0, cantonW, cantonH)
      ctx.fillStyle = '#fff'
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
          const x = (cantonW / 6) * (c + 0.5)
          const y = (cantonH / 5) * (r + 0.5)
          ctx.beginPath()
          ctx.arc(x, y, 0.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },
  },
  {
    id: 'japan',
    name: '日本',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#bc002d'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2)
      ctx.fill()
    },
  },
  {
    id: 'uk',
    name: 'UK',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#012169'
      ctx.fillRect(0, 0, w, h)
      // white diagonals
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = h * 0.18
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(w, h)
      ctx.moveTo(w, 0)
      ctx.lineTo(0, h)
      ctx.stroke()
      // red diagonals
      ctx.strokeStyle = '#c8102e'
      ctx.lineWidth = h * 0.08
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(w, h)
      ctx.moveTo(w, 0)
      ctx.lineTo(0, h)
      ctx.stroke()
      // white cross
      ctx.fillStyle = '#fff'
      ctx.fillRect(w / 2 - h * 0.17, 0, h * 0.34, h)
      ctx.fillRect(0, h / 2 - h * 0.17, w, h * 0.34)
      // red cross
      ctx.fillStyle = '#c8102e'
      ctx.fillRect(w / 2 - h * 0.1, 0, h * 0.2, h)
      ctx.fillRect(0, h / 2 - h * 0.1, w, h * 0.2)
    },
  },
  {
    id: 'france',
    name: 'France',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#0055a4'
      ctx.fillRect(0, 0, w / 3, h)
      ctx.fillStyle = '#fff'
      ctx.fillRect(w / 3, 0, w / 3, h)
      ctx.fillStyle = '#ef4135'
      ctx.fillRect((2 * w) / 3, 0, w / 3, h)
    },
  },
  {
    id: 'germany',
    name: 'Deutschland',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h / 3)
      ctx.fillStyle = '#dd0000'
      ctx.fillRect(0, h / 3, w, h / 3)
      ctx.fillStyle = '#ffce00'
      ctx.fillRect(0, (2 * h) / 3, w, h / 3)
    },
  },
  {
    id: 'italy',
    name: 'Italia',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#008c45'
      ctx.fillRect(0, 0, w / 3, h)
      ctx.fillStyle = '#fff'
      ctx.fillRect(w / 3, 0, w / 3, h)
      ctx.fillStyle = '#cd212a'
      ctx.fillRect((2 * w) / 3, 0, w / 3, h)
    },
  },
  {
    id: 'china',
    name: '中国',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#de2910'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffde00'
      star(ctx, w * 0.16, h * 0.28, h * 0.16, h * 0.07, 5)
      const small = h * 0.06
      const smallInner = h * 0.026
      const positions: [number, number][] = [
        [0.32, 0.12],
        [0.4, 0.22],
        [0.4, 0.36],
        [0.32, 0.46],
      ]
      for (const [px, py] of positions) {
        star(ctx, w * px, h * py, small, smallInner, 5)
      }
    },
  },
  {
    id: 'korea',
    name: '한국',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const r = h * 0.25
      // taegeuk
      ctx.fillStyle = '#cd2e3a'
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.PI, 0)
      ctx.arc(cx + r / 2, cy, r / 2, 0, Math.PI)
      ctx.arc(cx - r / 2, cy, r / 2, Math.PI, 0, true)
      ctx.fill()
      ctx.fillStyle = '#0047a0'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI)
      ctx.arc(cx - r / 2, cy, r / 2, Math.PI, 0)
      ctx.arc(cx + r / 2, cy, r / 2, 0, Math.PI, true)
      ctx.fill()
    },
  },
  {
    id: 'pride',
    name: 'Pride',
    draw: (ctx, w, h) => {
      const colors = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787']
      const bandH = h / colors.length
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(0, i * bandH, w, bandH + 0.5)
      })
    },
  },
]

const cache = new Map<string, HTMLCanvasElement>()

export function getFlagTexture(id: string, w = 90, h = 60): HTMLCanvasElement {
  const key = `${id}_${w}x${h}`
  const existing = cache.get(key)
  if (existing) return existing
  const def = FLAGS.find((f) => f.id === id) ?? FLAGS[0]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  def.draw(ctx, w, h)
  cache.set(key, canvas)
  return canvas
}

export function getFlag(id: string): FlagDef {
  return FLAGS.find((f) => f.id === id) ?? FLAGS[0]
}
