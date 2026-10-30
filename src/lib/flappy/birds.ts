export const BIRDS = ['canary', 'bluejay', 'parrot', 'owl', 'penguin', 'hummingbird'] as const
export type BirdStyle = typeof BIRDS[number]

// Shared by the picker and the game so previews match the playable birds.
export function drawBird(ctx: CanvasRenderingContext2D, style: BirdStyle, phase = 0) {
  const palette = {
    canary: ['#fde047', '#f59e0b', '#fff7cf'],
    bluejay: ['#60a5fa', '#2563eb', '#eff6ff'],
    parrot: ['#fb7185', '#10b981', '#fef3c7'],
    owl: ['#c4a484', '#795548', '#fff0da'],
    penguin: ['#334155', '#0f172a', '#f8fafc'],
    hummingbird: ['#2dd4bf', '#0f766e', '#d1fae5'],
  }[style]
  const [body, wing, belly] = palette
  const outline = '#24324b'
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string, angle = 0) => {
    if (color.startsWith('#') && color.length === 7 && color !== outline) {
      const light = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 0, x, y, Math.max(rx, ry) * 1.3)
      light.addColorStop(0, color)
      light.addColorStop(0.55, color)
      light.addColorStop(1, '#24324b')
      ctx.fillStyle = light
    } else ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2)
    ctx.fill()
  }
  const polygon = (points: number[][], color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = outline
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  const eye = (x: number, y: number, r = 4) => {
    ellipse(x, y, r + 0.8, r + 0.8, outline)
    ellipse(x, y, r, r, '#fff')
    ellipse(x + 0.8, y, r * 0.52, r * 0.62, outline)
    ellipse(x + 0.1, y - 1, r * 0.18, r * 0.18, '#fff')
  }
  ctx.save()
  if (style === 'owl') {
    polygon([[-11, -6], [-13, -18], [-2, -11]], wing)
    polygon([[2, -11], [13, -18], [11, -6]], wing)
  } else if (style === 'bluejay') {
    polygon([[-8, -8], [-8, -21], [5, -10]], wing)
  } else if (style === 'canary') {
    ellipse(-4, -13, 2.5, 6, wing, -0.5)
    ellipse(0, -14, 2, 6, body, 0.15)
  }
  if (style !== 'penguin' && style !== 'owl') {
    polygon([[-10, -1], [-23, -7], [-20, 2], [-24, 6], [-10, 7]], wing)
  }
  ellipse(2, 4, 14.5, 13, '#07132733')
  ellipse(0, 0, 14.5, style === 'hummingbird' ? 10.5 : 14.5, outline)
  ellipse(0, -0.4, 13.4, style === 'hummingbird' ? 9.4 : 13.4, body)
  ellipse(2, 5, style === 'parrot' ? 8 : 10, style === 'hummingbird' ? 5 : 8.5, belly)
  if (style === 'penguin') {
    ellipse(-6, -4, 5, 7, belly, -0.2)
    ellipse(6, -4, 5, 7, belly, 0.2)
    ellipse(-6, 14, 4.2, 2, '#fb923c')
    ellipse(6, 14, 4.2, 2, '#fb923c')
  }
  const flap = Math.sin(phase)
  ellipse(-7, 3 + flap * 2.5, style === 'hummingbird' ? 10 : 8, 4.7, outline, -0.35 + flap * 0.6)
  ellipse(-7, 2.7 + flap * 2.5, style === 'hummingbird' ? 9 : 7, 3.8, wing, -0.35 + flap * 0.6)
  if (style === 'owl') {
    ellipse(-5.5, -4, 6, 7.5, belly, -0.2)
    ellipse(5.5, -4, 6, 7.5, belly, 0.2)
    eye(-5.5, -4, 3.8)
    eye(5.5, -4, 3.8)
    polygon([[-2, 2], [2, 2], [0, 6]], '#fb923c')
    for (const x of [-5, 0, 5]) ellipse(x, 9, 0.8, 1.5, wing)
  } else if (style === 'penguin') {
    eye(-5, -4, 2.8)
    eye(5, -4, 2.8)
    polygon([[-3, 1], [4, 1], [0.5, 5]], '#fb923c')
  } else {
    if (style === 'parrot') ellipse(6, -4, 7, 7, belly)
    eye(6, -5, style === 'hummingbird' ? 3 : 4)
    if (style === 'parrot') {
      ctx.fillStyle = '#fbbf24'
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(12, -3)
      ctx.bezierCurveTo(18, -6, 25, -1, 23, 3)
      ctx.quadraticCurveTo(22, 7, 18, 8)
      ctx.quadraticCurveTo(20, 1, 13, 2)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      polygon([[13, 2], [18, 4], [14, 6]], '#fb923c')
      ellipse(16, -1.5, 0.8, 0.8, '#78350f')
    } else {
      polygon(style === 'hummingbird' ? [[12, -2], [28, -4], [13, 1]] : [[12, -2], [22, 1], [12, 4]],
        style === 'hummingbird' ? outline : '#fb923c')
    }
    ellipse(7, 3.5, 2.5, 1.6, '#fda4af')
  }
  ellipse(-5, -8, 3.5, 1.6, 'rgba(255,255,255,0.35)', -0.4)
  ctx.restore()
}
