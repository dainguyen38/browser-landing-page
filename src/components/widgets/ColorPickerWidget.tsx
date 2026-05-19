import { useEffect, useMemo, useState } from 'react'
import { Palette, Pipette, Copy, Check, Trash2 } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

const HISTORY_KEY = 'landing.colorpicker.v1'
const MAX_HISTORY = 12

type Format = 'hex' | 'rgb' | 'hsl'

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case R:
        h = (G - B) / d + (G < B ? 6 : 0)
        break
      case G:
        h = (B - R) / d + 2
        break
      case B:
        h = (R - G) / d + 4
        break
    }
    h /= 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function relLuminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}
function saveHistory(arr: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

const PRESETS = [
  '#EF4444', '#F97316', '#F59E0B', '#FACC15', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#FFFFFF', '#000000',
]

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> }
}

export function ColorPickerWidget() {
  const { t } = useT()
  const [h, setH] = useState(220)
  const [s, setS] = useState(80)
  const [l, setL] = useState(55)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [format, setFormat] = useState<Format>('hex')
  const [hexInput, setHexInput] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [pickerErr, setPickerErr] = useState<string | null>(null)

  const [r, g, b] = useMemo(() => hslToRgb(h, s, l), [h, s, l])
  const hex = useMemo(() => rgbToHex(r, g, b), [r, g, b])
  useEffect(() => setHexInput(hex), [hex])

  const lum = relLuminance(r, g, b)
  const textOnColor = lum > 0.5 ? '#0f172a' : '#ffffff'

  const updateFromHex = (v: string) => {
    setHexInput(v)
    const rgb = hexToRgb(v)
    if (!rgb) return
    const [nh, ns, nl] = rgbToHsl(rgb[0], rgb[1], rgb[2])
    setH(nh)
    setS(ns)
    setL(nl)
  }

  const formatted = useMemo(() => {
    if (format === 'hex') return hex
    if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`
    return `hsl(${h}, ${s}%, ${l}%)`
  }, [format, hex, r, g, b, h, s, l])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted)
      setCopied(formatted)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  const saveToHistory = (value = hex) => {
    setHistory((prev) => {
      const next = [value, ...prev.filter((c) => c.toLowerCase() !== value.toLowerCase())].slice(
        0,
        MAX_HISTORY,
      )
      saveHistory(next)
      return next
    })
  }

  const pickFromScreen = async () => {
    setPickerErr(null)
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
    if (!Ctor) {
      setPickerErr(t('color.notSupported'))
      return
    }
    try {
      const eye = new Ctor()
      const result = await eye.open()
      updateFromHex(result.sRGBHex)
      saveToHistory(result.sRGBHex.toUpperCase())
    } catch {
      // user cancelled — silent
    }
  }

  const clearHistory = () => {
    setHistory([])
    saveHistory([])
  }

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-pink-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('color.title')}
          </h2>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={pickFromScreen}
          className="h-7 text-xs gap-1.5"
        >
          <Pipette className="h-3.5 w-3.5" />
          {t('color.pick')}
        </Button>
      </header>

      {/* Color swatch + format select + copy */}
      <div className="flex gap-2 items-stretch shrink-0">
        <button
          type="button"
          onClick={() => saveToHistory()}
          title={t('color.saveSwatch')}
          className="w-20 h-20 rounded-xl border-2 border-white/25 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)] flex items-center justify-center font-bold text-sm tracking-wider transition-transform active:scale-95"
          style={{ background: hex, color: textOnColor }}
        >
          {hex}
        </button>
        <div className="flex-1 flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex gap-1.5">
            {(['hex', 'rgb', 'hsl'] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'h-7 px-2 rounded-md text-[10px] uppercase tracking-wider font-semibold border transition-colors',
                  format === f
                    ? 'bg-white text-zinc-900 border-white'
                    : 'bg-white/10 text-white/70 border-white/15 hover:bg-white/20',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={format === 'hex' ? hexInput : formatted}
              onChange={(e) => {
                if (format === 'hex') updateFromHex(e.target.value)
              }}
              readOnly={format !== 'hex'}
              spellCheck={false}
              className="flex-1 h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            <Button onClick={copy} size="sm" variant="secondary" className="h-8 px-2 shrink-0">
              {copied === formatted ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {pickerErr && (
        <div className="text-[10px] text-amber-300/80 shrink-0">{pickerErr}</div>
      )}

      {/* HSL sliders */}
      <div className="space-y-2 shrink-0">
        <Slider
          label="H"
          value={h}
          min={0}
          max={360}
          onChange={setH}
          trackBg="linear-gradient(to right, #ef4444 0%, #facc15 16%, #22c55e 33%, #06b6d4 50%, #3b82f6 66%, #8b5cf6 83%, #ef4444 100%)"
        />
        <Slider
          label="S"
          value={s}
          min={0}
          max={100}
          onChange={setS}
          trackBg={`linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`}
        />
        <Slider
          label="L"
          value={l}
          min={0}
          max={100}
          onChange={setL}
          trackBg={`linear-gradient(to right, #000, hsl(${h}, ${s}%, 50%), #fff)`}
        />
      </div>

      {/* Presets + history */}
      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/55 mb-1.5">
            {t('color.presets')}
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {PRESETS.map((p) => (
              <Swatch key={p} hex={p} active={p.toLowerCase() === hex.toLowerCase()} onClick={() => updateFromHex(p)} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-white/55">
              {t('color.history')}
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[10px] text-white/50 hover:text-white inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                {t('color.clear')}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="text-[11px] text-white/45 italic">{t('color.historyEmpty')}</div>
          ) : (
            <div className="grid grid-cols-9 gap-1.5">
              {history.map((c) => (
                <Swatch key={c} hex={c} active={c.toLowerCase() === hex.toLowerCase()} onClick={() => updateFromHex(c)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

function Swatch({ hex, active, onClick }: { hex: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hex}
      className={cn(
        'aspect-square rounded-md border transition-all active:scale-95',
        active ? 'border-white ring-2 ring-white/60' : 'border-white/15 hover:border-white/40',
      )}
      style={{ background: hex }}
    />
  )
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  trackBg,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  trackBg: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 font-semibold text-white/70">{label}</span>
      <div className="flex-1 relative h-5 flex items-center">
        <div
          className="absolute inset-y-1 left-0 right-0 rounded-full pointer-events-none"
          style={{ background: trackBg }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-5 appearance-none bg-transparent cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:border-2
                     [&::-webkit-slider-thumb]:border-zinc-900
                     [&::-webkit-slider-thumb]:shadow-md
                     [&::-moz-range-thumb]:h-4
                     [&::-moz-range-thumb]:w-4
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-white
                     [&::-moz-range-thumb]:border-2
                     [&::-moz-range-thumb]:border-zinc-900"
        />
      </div>
      <span className="w-8 text-right tabular-nums text-white/85">{value}</span>
    </div>
  )
}
