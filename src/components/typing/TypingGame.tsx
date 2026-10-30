import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Heart, Zap, RotateCcw, VolumeX, Volume2, Pause, Play, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Keyboard } from './Keyboard'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import {
  getStage,
  ENDLESS_POOL_EN,
  ENDLESS_POOL_VI,
  pickRandom,
  type LessonStage,
} from '@/lib/typing/lessons'
import { telexHintFor } from '@/lib/typing/telex'
import { play, setMuted as setSfxMuted, prime as primeAudio } from '@/lib/typing/sounds'
import { useTypingStore } from '@/store/typing'

export type GameMode =
  | { kind: 'lesson'; stageId: string }
  | { kind: 'time'; durationSec: number; lang: 'en' | 'vi' }
  | { kind: 'endless'; lang: 'en' | 'vi' }

interface Props {
  mode: GameMode
  onExit: () => void
}

const MAX_LIVES = 5

interface Enemy {
  id: number
  /** original unit text for display */
  text: string
  /** sequence of raw ASCII keys the user must press to type the unit */
  rawKeys: string[]
  /** boundaries[i] = number of raw keys needed to fully type text[0..i] */
  boundaries: number[]
  /** how many raw keys have been correctly typed so far */
  rawIdx: number
  spawnedAt: number
  durationMs: number
}

interface ResultStats {
  correctChars: number
  mistakes: number
  elapsedSec: number
  wpm: number
  accuracy: number
  passed: boolean
  livesLeft: number
}

/**
 * Expand a target unit into the sequence of raw ASCII keys needed to type it.
 * For English (and Vietnamese without Telex), each char maps to itself.
 * For Vietnamese with Telex, vowels with marks expand to their Telex sequence
 * (e.g. "á" → ["a", "s"], "ơ" → ["o", "w"]).
 */
function buildRawKeys(
  unit: string,
  lang: 'en' | 'vi',
  useTelex: boolean,
): { rawKeys: string[]; boundaries: number[] } {
  const rawKeys: string[] = []
  const boundaries: number[] = []
  for (const ch of unit) {
    if (lang === 'vi' && useTelex) {
      // Preserve case of letters — Telex hint returns lowercase; if char was
      // uppercase, mark the first key as uppercase (Shift) — for v1 we accept
      // lowercase input regardless.
      const seq = telexHintFor(ch.toLowerCase())
      for (const k of seq) rawKeys.push(k)
    } else {
      rawKeys.push(ch.toLowerCase())
    }
    boundaries.push(rawKeys.length)
  }
  return { rawKeys, boundaries }
}

/** Largest i such that boundaries[i] <= rawIdx (i.e. chars fully completed). */
function completedChars(boundaries: number[], rawIdx: number): number {
  // boundaries is monotonically increasing
  let lo = 0
  let hi = boundaries.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (boundaries[mid] <= rawIdx) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function TypingGame({ mode, onExit }: Props) {
  const { t } = useT()
  const lang: 'en' | 'vi' =
    mode.kind === 'lesson' ? (getStage(mode.stageId)?.lang ?? 'en') : mode.lang
  const stage: LessonStage | undefined =
    mode.kind === 'lesson' ? getStage(mode.stageId) : undefined
  const useTelex = useTypingStore((s) => s.useTelex)
  const muted = useTypingStore((s) => s.muted)
  const heroAvatar = useTypingStore((s) => s.heroAvatar)
  const setStoreMuted = useTypingStore((s) => s.setMuted)
  const setHeroAvatar = useTypingStore((s) => s.setHeroAvatar)
  const recordStage = useTypingStore((s) => s.recordStage)
  const recordTimeAttack = useTypingStore((s) => s.recordTimeAttack)
  const recordEndless = useTypingStore((s) => s.recordEndless)

  useEffect(() => {
    setSfxMuted(muted)
  }, [muted])

  // === Game state ===
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'won' | 'lost'>('ready')
  const [enemy, setEnemy] = useState<Enemy | null>(null)
  const [enemyX, setEnemyX] = useState(100)
  const [unitsLeft, setUnitsLeft] = useState<string[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [correctChars, setCorrectChars] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [combo, setCombo] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [shake, setShake] = useState(0)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])
  const [finalStats, setFinalStats] = useState<ResultStats | null>(null)
  const enemyIdRef = useRef(0)
  const particleIdRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Latest enemy ref so the keydown handler always sees current state
  const enemyRef = useRef<Enemy | null>(null)
  useEffect(() => {
    enemyRef.current = enemy
  }, [enemy])

  // === Build the unit queue when mode changes ===
  const initialQueue = useMemo<string[]>(() => {
    if (mode.kind === 'lesson' && stage) return [...stage.units]
    if (mode.kind === 'time' || mode.kind === 'endless') return makePoolBatch(mode.lang, 20)
    return []
  }, [mode, stage])

  // === Reset on mode change ===
  useEffect(() => {
    setPhase('ready')
    setUnitsLeft(initialQueue)
    setEnemy(null)
    setEnemyX(100)
    setLives(MAX_LIVES)
    setCorrectChars(0)
    setMistakes(0)
    setCombo(0)
    setStartedAt(null)
    setElapsedSec(0)
    setFinalStats(null)
  }, [initialQueue])

  const msPerChar = stage?.msPerChar ?? (mode.kind === 'time' ? 1100 : 1200)

  // === Spawn next enemy ===
  const spawnNext = useCallback(() => {
    setUnitsLeft((prev) => {
      let queue = prev
      if (queue.length === 0) {
        if (mode.kind === 'time' || mode.kind === 'endless') {
          queue = makePoolBatch(mode.lang, 20)
        } else {
          return prev
        }
      }
      const [next, ...rest] = queue
      const { rawKeys, boundaries } = buildRawKeys(next, lang, useTelex)
      const dur = Math.max(2000, rawKeys.length * msPerChar)
      setEnemy({
        id: ++enemyIdRef.current,
        text: next,
        rawKeys,
        boundaries,
        rawIdx: 0,
        spawnedAt: performance.now(),
        durationMs: dur,
      })
      setEnemyX(100)
      return rest
    })
  }, [mode, msPerChar, lang, useTelex])

  const startGame = useCallback(() => {
    primeAudio()
    play('start')
    setPhase('playing')
    setStartedAt(performance.now())
    spawnNext()
  }, [spawnNext])

  const finalize = useCallback(
    (passed: boolean) => {
      const totalKeystrokes = correctChars + mistakes
      const acc = totalKeystrokes > 0 ? (correctChars / totalKeystrokes) * 100 : 0
      const minutes = Math.max(elapsedSec / 60, 1 / 60)
      const wpm = correctChars / 5 / minutes
      const stats: ResultStats = {
        correctChars,
        mistakes,
        elapsedSec,
        wpm: Math.round(wpm),
        accuracy: Math.round(acc * 10) / 10,
        passed,
        livesLeft: lives,
      }
      setFinalStats(stats)
      setPhase(passed ? 'won' : 'lost')
      if (passed) play('levelClear')
      else play('gameOver')
      if (mode.kind === 'lesson' && stage) {
        const stagePassed =
          passed && stats.accuracy >= stage.minAccuracy && (!stage.minWpm || stats.wpm >= stage.minWpm)
        recordStage(stage.id, stats.wpm, stats.accuracy, stagePassed)
      } else if (mode.kind === 'time') {
        recordTimeAttack(mode.durationSec, stats.wpm, stats.accuracy)
      } else if (mode.kind === 'endless') {
        recordEndless(stats.correctChars)
      }
    },
    [
      correctChars,
      mistakes,
      elapsedSec,
      lives,
      mode,
      stage,
      recordStage,
      recordTimeAttack,
      recordEndless,
    ],
  )

  useEffect(() => {
    if (phase !== 'playing') return
    if (lives <= 0) finalize(false)
  }, [lives, phase, finalize])

  useEffect(() => {
    if (phase !== 'playing') return
    if (mode.kind !== 'lesson') return
    if (unitsLeft.length === 0 && enemy === null) finalize(true)
  }, [phase, mode, unitsLeft, enemy, finalize])

  useEffect(() => {
    if (phase !== 'playing' || startedAt === null) return
    const id = window.setInterval(() => {
      const sec = (performance.now() - startedAt) / 1000
      setElapsedSec(sec)
      if (mode.kind === 'time' && sec >= mode.durationSec) finalize(true)
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, startedAt, mode, finalize])

  // Enemy movement
  useEffect(() => {
    if (phase !== 'playing' || enemy === null) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const t = (now - enemy.spawnedAt) / enemy.durationMs
      const x = (1 - t) * 100
      setEnemyX(x)
      if (x <= 0) {
        play('lifeLost')
        setLives((l) => l - 1)
        setCombo(0)
        setEnemy(null)
        window.setTimeout(spawnNext, 200)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, enemy, spawnNext])

  // === Keyboard input ===
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (phase === 'ready') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startGame()
        }
        return
      }
      if (phase === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          setPhase('playing')
        }
        return
      }
      if (phase === 'won' || phase === 'lost') return

      // playing
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPhase('paused')
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      const rawKey = e.key.length === 1 ? e.key.toLowerCase() : e.key
      setPressedKeys((prev) => {
        const next = new Set(prev)
        next.add(rawKey)
        return next
      })

      if (e.key.length !== 1 && e.key !== 'Backspace') return
      e.preventDefault()

      const cur = enemyRef.current
      if (!cur) return

      if (e.key === 'Backspace') {
        if (cur.rawIdx > 0) {
          const next = { ...cur, rawIdx: cur.rawIdx - 1 }
          enemyRef.current = next
          setEnemy(next)
        }
        return
      }

      const expected = cur.rawKeys[cur.rawIdx]
      const k = rawKey
      if (k === expected) {
        const oldDone = completedChars(cur.boundaries, cur.rawIdx)
        const newRawIdx = cur.rawIdx + 1
        const newDone = completedChars(cur.boundaries, newRawIdx)
        const gained = newDone - oldDone
        const next: Enemy = { ...cur, rawIdx: newRawIdx }
        enemyRef.current = next
        if (gained > 0) {
          setCorrectChars((c) => c + gained)
          setCombo((c) => c + gained)
          spawnParticles()
        }
        play('correct')
        if (newRawIdx >= cur.rawKeys.length) {
          // unit done
          setEnemy(null)
          window.setTimeout(spawnNext, 80)
        } else {
          setEnemy(next)
        }
      } else {
        play('wrong')
        setMistakes((m) => m + 1)
        setCombo(0)
        setLives((l) => Math.max(0, l - 1))
        setShake(Date.now())
      }
    },
    [phase, startGame, spawnNext],
  )

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onKeyDown, onKeyUp])

  const spawnParticles = () => {
    const id = ++particleIdRef.current
    setParticles((p) => [...p, { id, x: enemyX, y: 50 + (Math.random() - 0.5) * 8 }])
    window.setTimeout(() => setParticles((p) => p.filter((q) => q.id !== id)), 600)
  }

  // === Keyboard highlight hint ===
  const nextKeyHint = useMemo<{ next?: string; upcoming: string[] }>(() => {
    if (!enemy) return { upcoming: [] }
    if (enemy.rawIdx >= enemy.rawKeys.length) return { upcoming: [] }
    return {
      next: enemy.rawKeys[enemy.rawIdx],
      upcoming: enemy.rawKeys.slice(enemy.rawIdx + 1, enemy.rawIdx + 5),
    }
  }, [enemy])

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) {
      alert('Max 200KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setHeroAvatar(result)
    }
    reader.readAsDataURL(file)
  }

  const restart = () => {
    setPhase('ready')
    setUnitsLeft(initialQueue)
    setEnemy(null)
    setEnemyX(100)
    setLives(MAX_LIVES)
    setCorrectChars(0)
    setMistakes(0)
    setCombo(0)
    setStartedAt(null)
    setElapsedSec(0)
    setFinalStats(null)
  }

  const totalKey = correctChars + mistakes
  const liveAccuracy = totalKey > 0 ? Math.round((correctChars / totalKey) * 1000) / 10 : 100
  const liveWpm = useMemo(() => {
    if (elapsedSec < 1) return 0
    return Math.round(correctChars / 5 / (elapsedSec / 60))
  }, [correctChars, elapsedSec])

  const timeLabel =
    mode.kind === 'time'
      ? `${Math.max(0, Math.ceil(mode.durationSec - elapsedSec))}s`
      : `${Math.floor(elapsedSec)}s`

  const title =
    mode.kind === 'lesson'
      ? stage?.title ?? ''
      : mode.kind === 'time'
      ? t('typing.timeAttack') + ' · ' + mode.durationSec + 's'
      : t('typing.endless')

  return (
    <div
      key={shake}
      className={cn(
        // Fills the parent Dialog container — not browser-fullscreen anymore.
        'relative w-full h-full flex flex-col bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl overflow-hidden',
      )}
    >
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            aria-label={t('common.close')}
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart
                key={i}
                className={cn(
                  'h-4 w-4 transition-all',
                  i < lives ? 'text-rose-400 fill-rose-500' : 'text-white/15',
                )}
              />
            ))}
          </div>
          <div className="tabular-nums">
            <span className="text-white/55">{t('typing.score')}</span>{' '}
            <span className="font-bold text-amber-300">{correctChars}</span>
          </div>
          <div className="tabular-nums">
            <span className="text-white/55">WPM</span>{' '}
            <span className="font-bold">{liveWpm}</span>
          </div>
          <div className="tabular-nums">
            <span className="text-white/55">{t('typing.accuracy')}</span>{' '}
            <span className="font-bold">{liveAccuracy}%</span>
          </div>
          <div className="tabular-nums">
            <span className="text-white/55">{t('typing.time')}</span>{' '}
            <span className="font-bold">{timeLabel}</span>
          </div>
          {combo >= 5 && (
            <div className="flex items-center gap-1 text-amber-300 font-bold animate-pulse">
              <Zap className="h-4 w-4" />
              {combo}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStoreMuted(!muted)}
            aria-label={muted ? 'unmute' : 'mute'}
            className="h-9 w-9"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          {phase === 'playing' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPhase('paused')}
              aria-label="pause"
              className="h-9 w-9"
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_50%_120%,rgba(99,102,241,0.4),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-emerald-900/80 via-emerald-800/50 to-transparent" />

        <Hero avatar={heroAvatar} attacking={pressedKeys.size > 0} />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute left-4 bottom-32 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] bg-white/10 hover:bg-white/20 text-white/85 border border-white/15"
          title={t('typing.customHero')}
        >
          <Upload className="h-3 w-3" />
          {t('typing.customHero')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onAvatarPick}
          className="hidden"
        />

        {phase === 'playing' && enemy && <EnemyBlock x={enemyX} enemy={enemy} />}

        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute pointer-events-none animate-ping"
            style={{ left: `calc(${p.x}% - 8px)`, top: `${p.y}%` }}
          >
            <div className="h-3 w-3 rounded-full bg-amber-300" />
          </div>
        ))}

        {phase === 'ready' && <ReadyOverlay onStart={startGame} title={title} stage={stage} />}
        {phase === 'paused' && (
          <DimOverlay>
            <div className="text-3xl font-bold mb-3">{t('typing.paused')}</div>
            <Button onClick={() => setPhase('playing')}>
              <Play className="h-4 w-4" /> {t('typing.resume')}
            </Button>
          </DimOverlay>
        )}
        {(phase === 'won' || phase === 'lost') && finalStats && (
          <ResultOverlay
            phase={phase}
            stats={finalStats}
            stage={stage}
            onRestart={restart}
            onExit={onExit}
          />
        )}
      </div>

      <div className="shrink-0 flex justify-center bg-black/35 border-t border-white/10 py-3 px-4 overflow-x-auto">
        <Keyboard
          pressed={pressedKeys}
          nextKey={nextKeyHint.next}
          upcoming={nextKeyHint.upcoming}
        />
      </div>
    </div>
  )
}

function makePoolBatch(lang: 'en' | 'vi', n: number): string[] {
  const pool = lang === 'vi' ? ENDLESS_POOL_VI : ENDLESS_POOL_EN
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(pickRandom(pool))
  return out
}

function Hero({ avatar, attacking }: { avatar: string | null; attacking?: boolean }) {
  return (
    <div
      className={cn(
        'absolute bottom-16 left-6 sm:left-12 z-10 transition-transform duration-100',
        attacking && 'translate-x-1',
      )}
    >
      <div className="relative">
        <div className="absolute -inset-2 rounded-full bg-amber-300/15 blur-xl pointer-events-none" />
        <div className="relative h-20 w-20 rounded-full bg-amber-200 border-4 border-amber-300 shadow-lg overflow-hidden flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 80 80" className="h-full w-full">
              <circle cx="28" cy="32" r="4" fill="#1f2937" />
              <circle cx="52" cy="32" r="4" fill="#1f2937" />
              <path
                d="M 24 50 Q 40 64 56 50"
                stroke="#1f2937"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="22" cy="44" r="3" fill="#fbbf24" opacity="0.6" />
              <circle cx="58" cy="44" r="3" fill="#fbbf24" opacity="0.6" />
            </svg>
          )}
        </div>
        <div className="mx-auto mt-1 h-3 w-12 rounded-b-md bg-indigo-600" />
        <div className="mx-auto h-6 w-10 rounded-md bg-indigo-700" />
      </div>
    </div>
  )
}

function EnemyBlock({ x, enemy }: { x: number; enemy: Enemy }) {
  const done = completedChars(enemy.boundaries, enemy.rawIdx)
  const correctPart = enemy.text.slice(0, done)
  const remainingPart = enemy.text.slice(done)
  // If the next char is partially typed (in Telex transit), render it in amber
  const inTransit =
    done < enemy.text.length &&
    enemy.rawIdx > (done === 0 ? 0 : enemy.boundaries[done - 1])
  const transitChar = inTransit ? enemy.text[done] : ''
  const afterTransit = inTransit ? enemy.text.slice(done + 1) : remainingPart
  return (
    <div
      className="absolute z-10 transition-[left] duration-75 ease-linear"
      style={{ left: `${x}%`, bottom: '42%', transform: 'translateX(-50%)' }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 border border-rose-400/50 shadow-lg backdrop-blur-sm max-w-[80vw]">
          <span className="font-mono text-lg sm:text-xl tabular-nums tracking-wide whitespace-pre">
            <span className="text-emerald-300">{correctPart}</span>
            {inTransit && <span className="text-amber-300 underline decoration-dotted">{transitChar}</span>}
            <span className="text-white/85">{afterTransit}</span>
          </span>
        </div>
        <div className="relative h-14 w-14 rounded-2xl bg-rose-600 border-4 border-rose-400 shadow-lg flex items-center justify-center">
          <svg viewBox="0 0 80 80" className="h-full w-full">
            <circle cx="28" cy="32" r="5" fill="#fff" />
            <circle cx="52" cy="32" r="5" fill="#fff" />
            <circle cx="28" cy="32" r="2.5" fill="#0f172a" />
            <circle cx="52" cy="32" r="2.5" fill="#0f172a" />
            <path
              d="M 22 56 L 28 50 L 34 56 L 40 50 L 46 56 L 52 50 L 58 56"
              stroke="#fff"
              strokeWidth="3"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

function ReadyOverlay({
  onStart,
  title,
  stage,
}: {
  onStart: () => void
  title: string
  stage?: LessonStage
}) {
  const { t } = useT()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
      <div className="text-3xl sm:text-5xl font-bold mb-3 text-center px-6">{title}</div>
      {stage?.blurb && <div className="text-white/65 mb-4 text-center px-6">{stage.blurb}</div>}
      <div className="text-white/55 text-sm mb-6 text-center max-w-md px-6">
        {t('typing.readyHint')}
      </div>
      <Button size="lg" onClick={onStart} className="px-6">
        <Play className="h-4 w-4" /> {t('typing.start')}
      </Button>
    </div>
  )
}

function DimOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
      {children}
    </div>
  )
}

function ResultOverlay({
  phase,
  stats,
  stage,
  onRestart,
  onExit,
}: {
  phase: 'won' | 'lost'
  stats: ResultStats
  stage?: LessonStage
  onRestart: () => void
  onExit: () => void
}) {
  const { t } = useT()
  const stagePassed =
    !!stage &&
    phase === 'won' &&
    stats.accuracy >= stage.minAccuracy &&
    (!stage.minWpm || stats.wpm >= stage.minWpm)
  return (
    <DimOverlay>
      <div className="text-4xl font-bold mb-2">
        {phase === 'won' ? t('typing.cleared') : t('typing.gameOver')}
      </div>
      {stage && (
        <div className={cn('text-sm mb-4', stagePassed ? 'text-emerald-300' : 'text-amber-300')}>
          {stagePassed
            ? t('typing.stagePassed')
            : t('typing.stageNotPassed').replace('{acc}', String(stage.minAccuracy)) +
              (stage.minWpm ? ` · ${stage.minWpm} WPM` : '')}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-center">
        <Stat label={t('typing.score')} value={String(stats.correctChars)} />
        <Stat label="WPM" value={String(stats.wpm)} />
        <Stat label={t('typing.accuracy')} value={`${stats.accuracy}%`} />
        <Stat label={t('typing.mistakes')} value={String(stats.mistakes)} />
        <Stat label={t('typing.time')} value={`${Math.round(stats.elapsedSec)}s`} />
        <Stat label={t('typing.lives')} value={`${stats.livesLeft} / ${MAX_LIVES}`} />
      </div>
      <div className="flex gap-3">
        <Button onClick={onRestart}>
          <RotateCcw className="h-4 w-4" /> {t('typing.playAgain')}
        </Button>
        <Button variant="secondary" onClick={onExit}>
          {t('common.close')}
        </Button>
      </div>
    </DimOverlay>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
