import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Brush,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Pipette as PipetteIcon,
} from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

type Tool = 'pen' | 'eraser'

const PALETTE = [
  '#ffffff', '#0f172a', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]
const SIZES = [2, 4, 8, 14, 24]
const W = 1200
const H = 800
const MAX_HISTORY = 25

export function DrawingWidget() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const futureRef = useRef<ImageData[]>([])

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(4)
  const [, force] = useState(0) // re-render undo/redo buttons

  // initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = W
    canvas.height = H
    fillBackground(ctx)
    snapshot(ctx)
    force((n) => n + 1)
  }, [])

  const snapshot = (ctx: CanvasRenderingContext2D) => {
    const data = ctx.getImageData(0, 0, W, H)
    historyRef.current.push(data)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    futureRef.current = []
  }

  const undo = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || historyRef.current.length < 2) return
    const last = historyRef.current.pop()!
    futureRef.current.push(last)
    const prev = historyRef.current[historyRef.current.length - 1]
    ctx.putImageData(prev, 0, 0)
    force((n) => n + 1)
  }, [])

  const redo = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || futureRef.current.length === 0) return
    const next = futureRef.current.pop()!
    historyRef.current.push(next)
    ctx.putImageData(next, 0, 0)
    force((n) => n + 1)
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    fillBackground(ctx)
    snapshot(ctx)
    force((n) => n + 1)
  }, [])

  const download = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `drawing-${Date.now()}.png`
    a.click()
  }, [])

  const pickFromScreen = useCallback(async () => {
    type EyeDropper = { new (): { open(): Promise<{ sRGBHex: string }> } }
    const Ctor = (window as unknown as { EyeDropper?: EyeDropper }).EyeDropper
    if (!Ctor) return
    try {
      const e = new Ctor()
      const { sRGBHex } = await e.open()
      setColor(sRGBHex)
    } catch {
      /* cancelled */
    }
  }, [])

  // Keyboard shortcuts (only when this widget area is focused via canvas hover)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // === drawing handlers ===

  const canvasPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const y = ((e.clientY - rect.top) / rect.height) * H
    return { x, y }
  }

  const beginStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    const pt = canvasPointFromEvent(e)
    lastPt.current = pt
    // dot
    ctx.beginPath()
    ctx.fillStyle = tool === 'eraser' ? '#0a0a0f' : color
    ctx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const moveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pt = canvasPointFromEvent(e)
    const last = lastPt.current ?? pt
    ctx.strokeStyle = tool === 'eraser' ? '#0a0a0f' : color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPt.current = pt
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (!drawing.current) return
    drawing.current = false
    lastPt.current = null
    canvas.releasePointerCapture(e.pointerId)
    snapshot(ctx)
    force((n) => n + 1)
  }

  return (
    <GlassCard className="flex flex-col gap-2 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <Brush className="h-4 w-4 text-pink-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('draw.title')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={undo}
            disabled={historyRef.current.length < 2}
            className="h-7 w-7"
            aria-label={t('draw.undo')}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={redo}
            disabled={futureRef.current.length === 0}
            className="h-7 w-7"
            aria-label={t('draw.redo')}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={download}
            className="h-7 w-7"
            aria-label={t('draw.download')}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={clear}
            className="h-7 w-7 text-rose-300 hover:text-rose-200"
            aria-label={t('draw.clear')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
        <div className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 p-0.5">
          <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')} title={t('draw.pen')}>
            <Brush className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title={t('draw.eraser')}>
            <Eraser className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                size === s ? 'border-white bg-white/15' : 'border-white/15 bg-white/5 hover:bg-white/10',
              )}
              aria-label={`${s}px`}
            >
              <span
                className="rounded-full bg-white"
                style={{ width: Math.min(s, 16), height: Math.min(s, 16) }}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                if (tool === 'eraser') setTool('pen')
              }}
              className={cn(
                'h-6 w-6 rounded-md border transition-all',
                color === c && tool === 'pen'
                  ? 'border-white ring-2 ring-white/60 scale-110'
                  : 'border-white/30 hover:border-white/60',
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/30 hover:border-white/60 cursor-pointer"
            title={t('draw.customColor')}
            style={{
              background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`,
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                if (tool === 'eraser') setTool('pen')
              }}
              className="sr-only"
            />
          </label>
          <Button
            size="icon"
            variant="ghost"
            onClick={pickFromScreen}
            className="h-7 w-7"
            aria-label={t('draw.pick')}
            title={t('draw.pick')}
          >
            <PipetteIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 rounded-xl border border-white/15 overflow-hidden bg-zinc-950 relative">
        <canvas
          ref={canvasRef}
          onPointerDown={beginStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          className={cn(
            'w-full h-full select-none touch-none',
            tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
          )}
        />
      </div>
    </GlassCard>
  )
}

function fillBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, W, H)
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-white text-zinc-900' : 'text-white/80 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}
