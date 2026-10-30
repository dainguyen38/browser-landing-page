import { useGameSession, useGameState, useGameRef } from './GameSession'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Upload, X, Trophy, Sparkles, Check, Sun, Moon, Orbit, Palmtree, Sunset } from 'lucide-react'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'

import {
  H, BIRD_R,
  initial, resize, flap as flapBird, update, type GameState,
} from '@/lib/flappy/game'
import { BIRDS, drawBird as drawBirdSprite, type BirdStyle } from '@/lib/flappy/birds'

import { ENVIRONMENTS, SCENES, drawEnvironment, drawPipe, type Environment } from '@/lib/flappy/scene'

const ENV_ICONS = { day: Sun, sunset: Sunset, night: Moon, space: Orbit, beach: Palmtree }
const CUSTOM_BIRD_KEY = 'flappy:bird:custom'

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; delay: number }

function makeFireworks(width: number): Spark[] {
  const colors = ['#fde047', '#fb7185', '#67e8f9', '#c4b5fd', '#86efac']
  return Array.from({ length: 5 }, (_, burst) => {
    const x = 40 + Math.random() * (width - 80)
    const y = 70 + Math.random() * 180
    return Array.from({ length: 28 }, (_, i) => {
      const angle = i / 28 * Math.PI * 2
      const speed = 1.3 + Math.random() * 2.3
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 65, color: colors[burst], delay: burst * 20 }
    })
  }).flat()
}

function BirdPreview({ bird }: { bird: BirdStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 96, 72)
    ctx.save()
    ctx.translate(46, 38)
    ctx.scale(1.6, 1.6)
    drawBirdSprite(ctx, bird)
    ctx.restore()
  }, [bird])
  return <canvas ref={ref} width={96} height={72} className="w-12 h-9" aria-hidden="true" />
}

export function FlappyBird() {
  const session = useGameSession()
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef({ scale: 1, dpr: 1 })
  const customImgRef = useRef<HTMLImageElement | null>(null)
  const customUrlRef = useRef<string | null>(null)
  const [hasCustom, setHasCustom] = useState(false)
  const stateRef = useGameRef<GameState | null>('engine', null)
  if (!stateRef.current) stateRef.current = initial(useMinigameStore.getState().highScores.flappy)
  const sparksRef = useRef<Spark[]>([])
  const uploadVersion = useRef(0)
  const [flying, setFlying] = useGameState('flying', false)
  const [recordBroken, setRecordBroken] = useGameState('recordBroken', false)
  const [playerName, setPlayerName] = useGameState('playerName', '')
  const [recordSaved, setRecordSaved] = useGameState('recordSaved', false)
  const [saveError, setSaveError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [score, setScore] = useGameState('score', 0)
  const [over, setOver] = useGameState('over', false)
  const [running, setRunning] = useGameState('running', true)
  const highScore = useMinigameStore((s) => s.highScores.flappy)
  const recordScore = useMinigameStore((s) => s.recordScore)
  const record = useMinigameStore((s) => s.flappyRecord)
  const selectedBird = useMinigameStore((s) => s.flappyBird)
  const selectBird = useMinigameStore((s) => s.selectFlappyBird)
  const savedEnvironment = useMinigameStore((s) => s.flappyEnvironment)
  const environment: Environment = ENVIRONMENTS.includes(savedEnvironment) ? savedEnvironment : 'day'
  const selectEnvironment = useMinigameStore((s) => s.selectFlappyEnvironment)
  const claimRecord = useMinigameStore((s) => s.claimFlappyRecord)

  const flap = useCallback(() => {
    return session.guard(() => {
      if (session.paused || !running || imageLoading) return
      flapBird(stateRef.current!)
      if (!stateRef.current!.over) setFlying(true)
    })
  }, [running, imageLoading])

  const start = useCallback(() => {
    return session.guard(() => {
      stateRef.current = initial(useMinigameStore.getState().highScores.flappy, stateRef.current!.width)
      sparksRef.current = []
      setScore(0)
      setOver(false)
      setFlying(false)
      setRecordBroken(false)
      setRecordSaved(false)
      setSaveError(false)
      setRunning(true)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const version = uploadVersion.current
    void (async () => {
      let url: string | null = null
      try {
        const blob = await idbGet<Blob>(CUSTOM_BIRD_KEY)
        if (!(blob instanceof Blob) || cancelled || version !== uploadVersion.current) return
        url = URL.createObjectURL(blob)
        const img = new Image()
        img.src = url
        await img.decode()
        if (cancelled || version !== uploadVersion.current) {
          URL.revokeObjectURL(url)
          return
        }
        customUrlRef.current = url
        customImgRef.current = img
        setHasCustom(true)
      } catch {
        if (url) URL.revokeObjectURL(url)
        if (!cancelled && version === uploadVersion.current) setImageError(true)
      }
    })()
    return () => {
      cancelled = true
      uploadVersion.current++
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
    }
  }, [])

  const uploadCustomBird = async (file: File) => {
    setImageError(false)
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setImageError(true)
      return
    }
    const version = ++uploadVersion.current
    setImageLoading(true)
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      if (version !== uploadVersion.current) {
        URL.revokeObjectURL(url)
        return
      }
      await idbSet(CUSTOM_BIRD_KEY, file)
      if (version !== uploadVersion.current) {
        URL.revokeObjectURL(url)
        return
      }
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
      customUrlRef.current = url
      customImgRef.current = img
      setHasCustom(true)
      selectBird('custom')
    } catch {
      URL.revokeObjectURL(url)
      if (version === uploadVersion.current) setImageError(true)
    } finally {
      if (version === uploadVersion.current) setImageLoading(false)
    }
  }

  const resetCustomBird = async () => {
    const version = ++uploadVersion.current
    setImageLoading(true)
    try {
      await idbDel(CUSTOM_BIRD_KEY)
      if (version !== uploadVersion.current) return
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current)
      customUrlRef.current = null
      customImgRef.current = null
      setHasCustom(false)
      setImageLoading(false)
      setImageError(false)
      selectBird('canary')
    } catch {
      if (version === uploadVersion.current) setImageError(true)
    } finally {
      if (version === uploadVersion.current) setImageLoading(false)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      return session.guard(() => {
        if (session.paused) return
        const active = document.activeElement
        if (e.repeat || (active instanceof HTMLElement && active.closest('input, textarea, button, [contenteditable=true]'))) return
        if (e.key !== ' ' && e.key !== 'Spacebar') return
        e.preventDefault()
        flap()
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      viewportRef.current = { scale: height / H, dpr }
      resize(stateRef.current!, H * width / height)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    fit()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let raf = 0

    const drawBird = (ctx: CanvasRenderingContext2D, st: GameState) => {
      ctx.save()
      ctx.translate(st.birdX, st.birdY)
      ctx.rotate(st.birdAngle)
      const img = selectedBird === 'custom' ? customImgRef.current : null
      if (img && img.complete && img.naturalWidth > 0) {
        const size = BIRD_R * 2.6
        const scale = size / Math.max(img.naturalWidth, img.naturalHeight)
        ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2,
          img.naturalWidth * scale, img.naturalHeight * scale)
      } else {
        drawBirdSprite(ctx, BIRDS.includes(selectedBird as BirdStyle) ? selectedBird as BirdStyle : 'canary', st.flapPhase)
      }
      ctx.restore()
    }

    const drawFireworks = (ctx: CanvasRenderingContext2D) => {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const p of sparksRef.current) {
        if (p.delay > 0 || p.life <= 0) continue
        ctx.globalAlpha = Math.min(1, p.life / 25)
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p.x - p.vx * 3, p.y - p.vy * 3)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
      }
      ctx.restore()
    }

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const st = stateRef.current!
      const { scale, dpr } = viewportRef.current
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0)
      drawEnvironment(ctx, st, environment)
      for (const p of st.pipes) drawPipe(ctx, p, environment)
      drawBird(ctx, st)
      drawFireworks(ctx)
    }

    const celebrate = () => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) sparksRef.current = makeFireworks(stateRef.current!.width)
    }

    let last = performance.now()
    const loop = (now: number) => session.guard(() => {
      const delta = document.hidden ? 0 : Math.min(40, now - last)
      const dt = delta / (1000 / 60)
      last = now
      if (session.paused) { draw(); raf = requestAnimationFrame(loop); return }
      const st = stateRef.current!
      const previousScore = st.score
      const wasRecord = st.recordBroken
      if (running) update(st, delta)
      if (st.score !== previousScore) {
        setScore(st.score)
        if (st.score > useMinigameStore.getState().highScores.flappy) recordScore('flappy', st.score)
      }
      if (!wasRecord && st.recordBroken) {
        setRecordBroken(true)
        celebrate()
      }
      if (running && st.over) {
        setOver(true)
        setRunning(false)
        if (st.recordBroken) celebrate()
      }
      for (const p of sparksRef.current) {
        if (p.delay > 0) { p.delay -= dt; continue }
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.035 * dt
      }
      sparksRef.current = sparksRef.current.filter((p) => p.life > 0)
      draw()
      raf = requestAnimationFrame(loop)
    })
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, recordScore, selectedBird, environment])

  const canChoose = !flying && !over
  const dockButton = 'shrink-0 rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/15 aria-pressed:border-amber-200 aria-pressed:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200'

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden bg-slate-950 text-white isolate">
      <canvas id="flappy-canvas" ref={canvasRef} role="img" tabIndex={0} aria-label={t('minigame.games.flappy')}
        onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); flap() }}
        className="absolute inset-0 h-full w-full select-none touch-none outline-none cursor-pointer" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/45 to-transparent" />
      <div className="pointer-events-none absolute left-5 top-5 text-xs font-black uppercase tracking-[0.25em] text-white/90 drop-shadow-md sm:text-sm">Flappy Bird</div>
      <div className="pointer-events-none absolute right-14 top-4 flex max-w-[40%] items-center gap-2 rounded-2xl border border-amber-100/20 bg-slate-950/35 px-3 py-2 text-amber-100 shadow-lg backdrop-blur-md">
        <Trophy className="h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 text-right leading-tight">
          <div className="text-[9px] uppercase tracking-widest text-amber-100/70">{t('minigame.best')}</div>
          <div className="text-xl font-black tabular-nums">{highScore}</div>
          {record && record.score === highScore && <div className="max-w-28 truncate text-[10px]">{record.name}</div>}
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 text-center drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]">
        <div className="text-5xl font-black tabular-nums sm:text-6xl" aria-label={t('minigame.score')}>{score}</div>
        {recordBroken && !over && <div role="status" className="mt-2 inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-bold text-amber-950"><Sparkles className="h-3.5 w-3.5" />{t('minigame.newBest')}</div>}
      </div>
      {canChoose && <>
        <button type="button" disabled={imageLoading} onClick={() => { flap(); canvasRef.current?.focus() }} aria-label={t('minigame.play')}
          className="absolute left-1/2 top-[43%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/20 shadow-[0_12px_50px_rgba(15,23,42,0.3),inset_0_2px_0_rgba(255,255,255,0.4)] backdrop-blur-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50 sm:h-20 sm:w-20">
          <Play className="ml-1 h-7 w-7 fill-white sm:h-9 sm:w-9" />
        </button>
        <div className="absolute inset-x-3 bottom-3 flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/50 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-5 sm:bottom-5 sm:flex-row sm:justify-center sm:gap-5">
          <div role="group" aria-label={t('minigame.flappyOptions.chooseBird')} className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1">
            {BIRDS.map((bird) => <button key={bird} type="button" aria-label={t(`minigame.flappyOptions.${bird}`)} title={t(`minigame.flappyOptions.${bird}`)} aria-pressed={selectedBird === bird} onClick={() => selectBird(bird)} className={dockButton}>
              <BirdPreview bird={bird} />
            </button>)}
            {hasCustom && <button type="button" aria-pressed={selectedBird === 'custom'} aria-label={t('minigame.flappyOptions.uploadedBird')} onClick={() => selectBird('custom')} className={`${dockButton} p-1`}>
              <img src={customUrlRef.current!} alt="" className="h-7 w-8 object-contain" />
            </button>}
            <label title={t('minigame.customBird')} className={`${dockButton} relative flex h-9 w-9 items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-amber-200`}>
              <Upload className="h-4 w-4" /><input aria-label={t('minigame.customBird')} type="file" accept="image/*" className="sr-only" disabled={imageLoading} onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadCustomBird(file)
                e.target.value = ''
              }} />
            </label>
            {hasCustom && <button type="button" title={t('minigame.resetBird')} aria-label={t('minigame.resetBird')} disabled={imageLoading} onClick={() => void resetCustomBird()} className={`${dockButton} flex h-9 w-9 items-center justify-center`}><X className="h-4 w-4" /></button>}
          </div>
          <div className="hidden h-8 w-px bg-white/20 sm:block" />
          <div role="group" aria-label={t('minigame.flappyOptions.environment')} className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
            {ENVIRONMENTS.map((scene) => {
              const Icon = ENV_ICONS[scene]
              return <button key={scene} type="button" title={t(`minigame.flappyOptions.${scene}`)} aria-label={t(`minigame.flappyOptions.${scene}`)} aria-pressed={environment === scene} onClick={() => selectEnvironment(scene)} className={`${dockButton} flex h-9 w-10 items-center justify-center shadow-inner`} style={{ background: SCENES[scene].swatch }}>
                <Icon className="h-5 w-5 drop-shadow-md" />
              </button>
            })}
          </div>
        </div>
      </>}
      {imageError && <p role="alert" className="absolute inset-x-4 bottom-36 rounded-lg bg-rose-950/90 p-3 text-center text-xs text-rose-100 sm:bottom-28">{t('minigame.flappyOptions.imageError')}</p>}
      {over && <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-950/35 px-4 py-20 backdrop-blur-[2px]">
        <div className={`my-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border p-5 text-center shadow-2xl backdrop-blur-xl sm:p-7 ${recordBroken ? 'border-amber-200/40 bg-slate-950/75' : 'border-white/20 bg-slate-950/70'}`}>
          {recordBroken && <div className="rounded-full border border-amber-200/40 bg-amber-300/15 p-4 shadow-[0_0_50px_rgba(251,191,36,0.2)]"><Trophy className="h-9 w-9 text-amber-300" /></div>}
          <div className={`text-2xl font-black ${recordBroken ? 'text-amber-200' : 'text-white'}`}>{t(recordBroken ? 'minigame.newBest' : 'minigame.gameOver')}</div>
          <div className="text-6xl font-black tabular-nums">{score}</div>
          {recordBroken && <form className="flex w-full flex-col gap-2" onSubmit={(e) => {
            e.preventDefault()
            const saved = claimRecord(score, playerName)
            setRecordSaved(saved); setSaveError(!saved)
          }}>
            <Input aria-label={t('minigame.flappyOptions.namePlaceholder')} value={playerName} maxLength={32} required disabled={recordSaved} autoComplete="nickname" placeholder={t('minigame.flappyOptions.namePlaceholder')} onChange={(e) => { setPlayerName(e.target.value); setSaveError(false) }} className="h-11 rounded-xl text-center" />
            <Button type="submit" disabled={!playerName.trim() || recordSaved} className="h-11 rounded-xl">{recordSaved ? <Check className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}{t(recordSaved ? 'minigame.flappyOptions.saved' : 'minigame.flappyOptions.saveRecord')}</Button>
            {saveError && <p role="alert" className="text-xs text-rose-300">{t('minigame.flappyOptions.recordChanged')}</p>}
          </form>}
          <Button onClick={start} variant={recordBroken ? 'secondary' : 'default'} className="h-11 w-full rounded-xl"><RotateCcw className="h-4 w-4" />{t('minigame.playAgain')}</Button>
        </div>
      </div>}
    </div>
  )
}
