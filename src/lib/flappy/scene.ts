import { H, GROUND_H, PIPE_W, PIPE_GAP, type GameState, type Pipe } from './game'

export const ENVIRONMENTS = ['day', 'sunset', 'night', 'space', 'beach'] as const
export type Environment = typeof ENVIRONMENTS[number]
export const SCENES = {
  day: { sky: ['#398ded', '#b8e8ff', '#f0fdfa'], ground: ['#6bc66c', '#245b41'], pipe: ['#135d50', '#6ee7b7', '#1b8065'], swatch: 'linear-gradient(145deg,#60a5fa,#a7f3d0)' },
  sunset: { sky: ['#55408d', '#fc9694', '#ffddab'], ground: ['#bd7276', '#59365e'], pipe: ['#813b5e', '#ffbc9a', '#c87578'], swatch: 'linear-gradient(145deg,#7c3aed,#fb923c)' },
  night: { sky: ['#0a1339', '#29356d', '#6678a1'], ground: ['#526c8b', '#1e2d4e'], pipe: ['#252456', '#b6a8fa', '#61539c'], swatch: 'linear-gradient(145deg,#0f172a,#818cf8)' },
  space: { sky: ['#080b24', '#241549', '#15314c'], ground: ['#4d667f', '#101d32'], pipe: ['#163446', '#8ce8ff', '#367d99'], swatch: 'linear-gradient(145deg,#020617,#a855f7)' },
  beach: { sky: ['#35aedf', '#b5f0ff', '#f4fffb'], ground: ['#ffe0a3', '#b78250'], pipe: ['#896025', '#f6e1a4', '#bda05b'], swatch: 'linear-gradient(145deg,#22d3ee,#fcd34d)' },
} as const

function gradient(ctx: CanvasRenderingContext2D, top: number, bottom: number, colors: readonly string[]) {
  const fill = ctx.createLinearGradient(0, top, 0, bottom)
  colors.forEach((color, i) => fill.addColorStop(i / (colors.length - 1), color))
  return fill
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius)
  fill.addColorStop(0, color)
  fill.addColorStop(1, 'transparent')
  ctx.fillStyle = fill
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function ridge(ctx: CanvasRenderingContext2D, width: number, base: number, height: number, offset: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= width + 8; x += 8) {
    const p = x + offset
    ctx.lineTo(x, base - height * (0.55 + Math.sin(p * 0.008) * 0.3 + Math.cos(p * 0.017) * 0.15))
  }
  ctx.lineTo(width, H)
  ctx.closePath()
  ctx.fill()
}

export function drawEnvironment(ctx: CanvasRenderingContext2D, st: GameState, environment: Environment) {
  const { width, groundOffset: off } = st
  const theme = SCENES[environment]
  const floor = H - GROUND_H
  ctx.save()
  ctx.fillStyle = gradient(ctx, 0, floor, theme.sky)
  ctx.fillRect(0, 0, width, H)
  if (environment === 'night' || environment === 'space') {
    if (environment === 'space') {
      glow(ctx, width * 0.65, 140, 230, '#7c3aed44')
      glow(ctx, width * 0.3, 290, 170, '#0891b233')
    }
    for (let i = 0; i < width / 5; i++) {
      const x = ((i * 127.7 - off * (0.015 + i % 3 * 0.008)) % (width + 8) + width + 8) % (width + 8)
      const y = (i * 71.3) % (floor - 30)
      ctx.globalAlpha = 0.35 + (Math.sin(off * 0.01 + i) + 1) * 0.25
      ctx.fillStyle = '#e0f2fe'
      ctx.beginPath()
      ctx.arc(x, y, i % 9 === 0 ? 1.2 : 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    const x = width * 0.76
    glow(ctx, x, 92, 90, '#c4b5fd44')
    ctx.fillStyle = gradient(ctx, 50, 130, environment === 'space' ? ['#f5d0fe', '#8064b6', '#43355e'] : ['#fffce5', '#becbe9'])
    ctx.beginPath()
    ctx.arc(x, 92, environment === 'space' ? 38 : 25, 0, Math.PI * 2)
    ctx.fill()
    if (environment === 'space') {
      ctx.strokeStyle = '#c4b5fd99'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.ellipse(x, 92, 66, 12, -0.3, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 6; i++) {
        const ax = ((i * 173 - off * 0.08) % (width + 180) + width + 180) % (width + 180) - 60
        ctx.fillStyle = '#63718a'
        ctx.beginPath()
        ctx.ellipse(ax, 300 + i % 3 * 35, 12 + i * 2, 6 + i, i, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = '#8794b233'
      for (const [dx, dy, r] of [[-8, -4, 5], [7, 9, 7], [5, -12, 3]]) {
        ctx.beginPath(); ctx.arc(x + dx, 92 + dy, r, 0, Math.PI * 2); ctx.fill()
      }
    }
  } else {
    const x = width * 0.76
    const y = environment === 'sunset' ? 180 : 80
    glow(ctx, x, y, 120, '#fff4bd88')
    ctx.fillStyle = environment === 'sunset' ? '#ffdb9e' : '#fff7ce'
    ctx.beginPath(); ctx.arc(x, y, environment === 'sunset' ? 44 : 23, 0, Math.PI * 2); ctx.fill()
    for (let layer = 0; layer < 2; layer++) {
      ctx.globalAlpha = layer ? 0.8 : 0.4
      for (let i = 0; i < width / 140 + 2; i++) {
        const x = ((i * 170 - off * (layer ? 0.12 : 0.05)) % (width + 180) + width + 180) % (width + 180) - 90
        const y = 75 + i % 3 * 47 + layer * 30
        ctx.fillStyle = environment === 'sunset' ? '#ffe3d5' : '#fff'
        ctx.beginPath()
        ctx.ellipse(x, y, 42, 10, 0, 0, Math.PI * 2)
        ctx.ellipse(x - 12, y - 6, 23, 15, 0, 0, Math.PI * 2)
        ctx.ellipse(x + 15, y - 7, 20, 18, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }
  if (environment === 'beach') {
    ctx.fillStyle = gradient(ctx, 260, floor, ['#4fcacb', '#087eaa', '#6fdfdf'])
    ctx.fillRect(0, 260, width, floor - 260)
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = '#e0ffff55'
      ctx.lineWidth = 1 + i * 0.08
      ctx.beginPath()
      const y = 270 + i * 12
      for (let x = 0; x <= width; x += 8) {
        ctx.lineTo(x, y + Math.sin((x + off * (0.3 + i * 0.03)) * 0.025) * 2)
      }
      ctx.stroke()
    }
    const island = width * 0.75 - Math.sin(off * 0.0005) * 8
    ctx.fillStyle = '#2d9b8c'
    ctx.beginPath(); ctx.ellipse(island, 288, 75, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#766039'; ctx.lineWidth = 5
    ctx.beginPath(); ctx.moveTo(island, 283); ctx.quadraticCurveTo(island + 8, 255, island - 2, 235); ctx.stroke()
    for (let i = -2; i <= 2; i++) {
      ctx.strokeStyle = '#218773'; ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(island - 2, 235); ctx.quadraticCurveTo(island + i * 13, 222, island + i * 21, 242); ctx.stroke()
    }
  } else {
    const colors = environment === 'day' ? ['#82b8bd', '#55968d', '#377663'] :
      environment === 'sunset' ? ['#a686a9', '#85678e', '#654b77'] :
      environment === 'night' ? ['#4c5982', '#333e64', '#242f4d'] : ['#323251', '#272d45', '#1b283b']
    for (let i = 0; i < 3; i++) ridge(ctx, width, 345 + i * 34, 110 - i * 20, off * (0.04 + i * 0.05) + i * 80, colors[i])
  }
  ctx.fillStyle = gradient(ctx, floor, H, theme.ground)
  ctx.fillRect(0, floor, width, GROUND_H)
  ctx.fillStyle = environment === 'beach' ? '#fff3cc' : environment === 'space' ? '#a5f3fc' : '#ffffff55'
  ctx.fillRect(0, floor, width, environment === 'space' ? 2 : 5)
  for (let x = -(off % 40); x < width; x += 40) {
    ctx.fillStyle = environment === 'space' ? '#67e8f933' : '#00000012'
    ctx.beginPath()
    ctx.moveTo(x, floor + 8); ctx.lineTo(x + 15, floor + 8); ctx.lineTo(x + 35, H); ctx.lineTo(x + 20, H)
    ctx.fill()
  }
  // A soft lens vignette ties the depth layers together without obscuring the play area.
  const vignette = ctx.createRadialGradient(width / 2, H / 2, H * 0.2, width / 2, H / 2, Math.max(width, H) * 0.8)
  vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#07132744')
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, H)
  ctx.restore()
}

export function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe, environment: Environment) {
  const colors = pipe.record ? ['#925b09', '#fff2a5', '#e9ac29'] : SCENES[environment].pipe
  const section = (y: number, height: number, top: boolean) => {
    ctx.save()
    ctx.shadowColor = '#07132744'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5
    const fill = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_W, 0)
    fill.addColorStop(0, colors[0]); fill.addColorStop(0.28, colors[1]); fill.addColorStop(0.5, colors[2]); fill.addColorStop(1, colors[0])
    ctx.fillStyle = fill; ctx.fillRect(pipe.x, y, PIPE_W, height)
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0
    ctx.fillStyle = '#ffffff33'; ctx.fillRect(pipe.x + 9, y, 3, height)
    const capY = top ? y + height - 18 : y
    ctx.fillStyle = fill
    ctx.beginPath(); ctx.roundRect(pipe.x - 6, capY, PIPE_W + 12, 18, 3); ctx.fill()
    ctx.fillStyle = '#ffffff66'; ctx.fillRect(pipe.x - 3, capY + 2, PIPE_W + 6, 2)
    ctx.fillStyle = '#07132744'; ctx.fillRect(pipe.x - 4, capY + 14, PIPE_W + 8, 3)
    if (environment === 'space' && !pipe.record) {
      ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 10; ctx.fillStyle = '#a5f3fc'
      ctx.fillRect(pipe.x - 4, top ? capY + 15 : capY + 1, PIPE_W + 8, 2)
    }
    ctx.restore()
  }
  section(0, pipe.gapY, true)
  section(pipe.gapY + PIPE_GAP, H - GROUND_H - pipe.gapY - PIPE_GAP, false)
  if (pipe.record) {
    ctx.save(); ctx.fillStyle = '#633d0c'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'
    ctx.fillText(`★ ${pipe.number}`, pipe.x + PIPE_W / 2, pipe.gapY - 25); ctx.restore()
  }
}
