import { dirVec, type Dir, type Fruit, type Pt } from './game'

export const SNAKE_STYLES = ['emerald', 'neon', 'candy', 'gold', 'pixel'] as const
export type SnakeStyle = typeof SNAKE_STYLES[number]
const PALETTES: Record<SnakeStyle, { body: string; head: string; dark: string; accent: string }> = {
  emerald: { body: '#22c55e', head: '#86efac', dark: '#065f46', accent: '#bbf7d0' },
  neon: { body: '#22d3ee', head: '#a5f3fc', dark: '#164e63', accent: '#c084fc' },
  candy: { body: '#f472b6', head: '#fbcfe8', dark: '#9d174d', accent: '#fef3c7' },
  gold: { body: '#fbbf24', head: '#fef08a', dark: '#92400e', accent: '#fef3c7' },
  pixel: { body: '#a3e635', head: '#d9f99d', dark: '#365314', accent: '#4d7c0f' },
}

export function drawSnake(
  ctx: CanvasRenderingContext2D, snake: Pt[], dir: Dir, style: SnakeStyle,
  cell: number, image: HTMLImageElement | null = null,
) {
  const colors = PALETTES[style]
  const pixel = style === 'pixel'
  ctx.save()
  ctx.lineCap = pixel ? 'square' : 'round'
  ctx.lineJoin = 'round'
  if (style === 'neon') {
    ctx.shadowBlur = cell * 0.6
    ctx.shadowColor = colors.body
  }
  const chunks: Pt[][] = []
  for (const seg of snake) {
    const chunk = chunks[chunks.length - 1]
    const prev = chunk?.[chunk.length - 1]
    if (!prev || Math.abs(prev.x - seg.x) + Math.abs(prev.y - seg.y) !== 1) chunks.push([seg])
    else chunk.push(seg)
  }
  ctx.beginPath()
  for (const chunk of chunks) {
    const points = chunk.map((p) => ({ x: (p.x + 0.5) * cell, y: (p.y + 0.5) * cell }))
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const p = points[i]
      const next = points[i + 1]
      if (!pixel && next) ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2)
      else ctx.lineTo(p.x, p.y)
    }
  }
  ctx.strokeStyle = colors.dark
  ctx.lineWidth = cell * 0.8
  ctx.stroke()
  ctx.strokeStyle = colors.body
  ctx.lineWidth = cell * 0.68
  ctx.stroke()
  ctx.shadowBlur = 0
  if (style === 'neon') {
    ctx.strokeStyle = '#083344'
    ctx.lineWidth = cell * 0.43
    ctx.stroke()
    ctx.strokeStyle = colors.accent
    ctx.lineWidth = cell * 0.13
    ctx.setLineDash([cell * 0.35, cell * 0.4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  for (const chunk of chunks) {
    if (chunk.length !== 1) continue
    const x = (chunk[0].x + 0.5) * cell
    const y = (chunk[0].y + 0.5) * cell
    ctx.fillStyle = colors.body
    if (pixel) ctx.fillRect(x - cell * 0.34, y - cell * 0.34, cell * 0.68, cell * 0.68)
    else {
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.34, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (let i = 1; i < snake.length - 1; i++) {
    const p = snake[i]
    const prev = snake[i - 1]
    const next = snake[i + 1]
    const cx = (p.x + 0.5) * cell
    const cy = (p.y + 0.5) * cell
    const straight = prev.x === next.x || prev.y === next.y
    ctx.fillStyle = colors.accent
    if (pixel) ctx.fillRect(cx - cell * 0.23, cy - cell * 0.23, cell * 0.25, cell * 0.25)
    else if (style === 'gold' && straight) {
      ctx.beginPath()
      ctx.moveTo(cx, cy - cell * 0.16)
      ctx.lineTo(cx + cell * 0.16, cy)
      ctx.lineTo(cx, cy + cell * 0.16)
      ctx.lineTo(cx - cell * 0.16, cy)
      ctx.closePath()
      ctx.fill()
    } else if (style === 'candy' && straight) {
      ctx.strokeStyle = colors.accent
      ctx.lineWidth = cell * 0.17
      ctx.beginPath()
      const horizontal = prev.y === next.y
      ctx.moveTo(cx - (horizontal ? 0 : cell * 0.25), cy - (horizontal ? cell * 0.25 : 0))
      ctx.lineTo(cx + (horizontal ? 0 : cell * 0.25), cy + (horizontal ? cell * 0.25 : 0))
      ctx.stroke()
    } else if (style === 'emerald' && straight && i % 2 === 0) {
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.ellipse(cx - cell * 0.08, cy - cell * 0.1, cell * 0.12, cell * 0.07, -0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  const head = snake[0]
  if (!head) { ctx.restore(); return }
  const hx = (head.x + 0.5) * cell
  const hy = (head.y + 0.5) * cell
  ctx.fillStyle = colors.dark
  if (pixel) ctx.fillRect(hx - cell * 0.46, hy - cell * 0.46, cell * 0.92, cell * 0.92)
  else {
    ctx.beginPath()
    ctx.arc(hx, hy, cell * 0.48, 0, Math.PI * 2)
    ctx.fill()
  }
  const gradient = ctx.createLinearGradient(hx - cell / 2, hy - cell / 2, hx + cell / 2, hy + cell / 2)
  gradient.addColorStop(0, colors.head)
  gradient.addColorStop(1, colors.body)
  ctx.fillStyle = gradient
  if (pixel) ctx.fillRect(hx - cell * 0.41, hy - cell * 0.41, cell * 0.82, cell * 0.82)
  else {
    ctx.beginPath()
    ctx.arc(hx, hy, cell * 0.43, 0, Math.PI * 2)
    ctx.fill()
  }
  if (image) {
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    ctx.save()
    ctx.beginPath()
    ctx.arc(hx, hy, cell * 0.46, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
      side, side, hx - cell / 2, hy - cell / 2, cell, cell)
    ctx.restore()
  } else {
    const v = dirVec(dir)
    for (const sign of [-1, 1]) {
      const ex = hx + v.x * cell * 0.17 - v.y * cell * 0.22 * sign
      const ey = hy + v.y * cell * 0.17 + v.x * cell * 0.22 * sign
      ctx.fillStyle = '#fff'
      if (pixel) ctx.fillRect(ex - cell * 0.13, ey - cell * 0.13, cell * 0.26, cell * 0.26)
      else {
        ctx.beginPath()
        ctx.arc(ex, ey, cell * 0.15, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(ex + v.x * cell * 0.04, ey + v.y * cell * 0.04, cell * 0.075, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = '#fb7185'
    ctx.lineWidth = Math.max(1, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(hx + v.x * cell * 0.4, hy + v.y * cell * 0.4)
    ctx.lineTo(hx + v.x * cell * 0.63, hy + v.y * cell * 0.63)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit, cell: number, time: number) {
  const bonus = fruit.kind !== 'apple'
  const pulse = bonus ? 1 + Math.sin(time / 180 + fruit.x * 0.6) * 0.14 : 1
  const r = cell * (bonus ? 0.65 : 0.55) * pulse
  const x = (fruit.x + 0.5) * cell
  const y = (fruit.y + 0.5) * cell
  const color = { apple: '#f43f5e', coconut: '#a16207', mango: '#fbbf24', durian: '#a3e635' }[fruit.kind]
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = bonus ? 10 + pulse * 5 : 6
  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r)
  gradient.addColorStop(0, fruit.kind === 'coconut' ? '#d6a36c' : color)
  gradient.addColorStop(1, fruit.kind === 'coconut' ? '#713f12' : color)
  ctx.fillStyle = gradient
  ctx.beginPath()
  if (fruit.kind === 'durian') {
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12
      const radius = i % 2 ? r * 0.75 : r
      ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
    }
    ctx.closePath()
  } else if (fruit.kind === 'mango') ctx.ellipse(x, y, r * 0.75, r, 0.5, 0, Math.PI * 2)
  else ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  if (fruit.kind === 'coconut') {
    ctx.fillStyle = '#fffbeb'
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.27, r * 0.84, r * 0.6, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d6c2a2'
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.27, r * 0.5, r * 0.3, -0.3, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    ctx.ellipse(x + 3, y - r, 4, 2, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff77'
    ctx.beginPath()
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.16, r * 0.3, -0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
