import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type TypingLang = 'en' | 'vi'

export interface StageResult {
  /** ISO timestamp of first pass */
  passedAt: string
  /** Best WPM achieved on this stage */
  bestWpm: number
  /** Best accuracy % achieved */
  bestAccuracy: number
  /** How many times the stage has been played */
  attempts: number
}

export interface TimeAttackHigh {
  /** Seconds the run lasted (e.g. 60) */
  duration: number
  wpm: number
  accuracy: number
  setAt: string
}

interface State {
  lang: TypingLang
  /** Use built-in Telex transformer for VN (vs trust OS IME) */
  useTelex: boolean
  /** Mute SFX */
  muted: boolean
  /** Data URL of a custom hero face uploaded by the user */
  heroAvatar: string | null
  /** stage id → result */
  results: Record<string, StageResult>
  /** Per duration (seconds) — best run */
  timeAttackHigh: Record<string, TimeAttackHigh>
  /** Best endless score (most correct chars typed before losing 5 lives) */
  endlessBest: number
}

interface Actions {
  setLang: (l: TypingLang) => void
  setUseTelex: (v: boolean) => void
  setMuted: (v: boolean) => void
  setHeroAvatar: (dataUrl: string | null) => void
  recordStage: (id: string, wpm: number, accuracy: number, passed: boolean) => void
  recordTimeAttack: (durationSec: number, wpm: number, accuracy: number) => void
  recordEndless: (correctChars: number) => void
}

const initial: State = {
  lang: 'en',
  useTelex: true,
  muted: false,
  heroAvatar: null,
  results: {},
  timeAttackHigh: {},
  endlessBest: 0,
}

export const useTypingStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      setLang: (lang) => set({ lang }),
      setUseTelex: (useTelex) => set({ useTelex }),
      setMuted: (muted) => set({ muted }),
      setHeroAvatar: (heroAvatar) => set({ heroAvatar }),
      recordStage: (id, wpm, accuracy, passed) => {
        const existing = get().results[id]
        const next: StageResult = {
          passedAt: existing?.passedAt ?? (passed ? new Date().toISOString() : ''),
          bestWpm: Math.max(existing?.bestWpm ?? 0, wpm),
          bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
          attempts: (existing?.attempts ?? 0) + 1,
        }
        // If this is the first pass, stamp passedAt; otherwise keep the original.
        if (!next.passedAt && passed) next.passedAt = new Date().toISOString()
        set({ results: { ...get().results, [id]: next } })
      },
      recordTimeAttack: (durationSec, wpm, accuracy) => {
        const key = String(durationSec)
        const prev = get().timeAttackHigh[key]
        if (prev && prev.wpm >= wpm) return
        set({
          timeAttackHigh: {
            ...get().timeAttackHigh,
            [key]: { duration: durationSec, wpm, accuracy, setAt: new Date().toISOString() },
          },
        })
      },
      recordEndless: (correctChars) => {
        if (correctChars > get().endlessBest) set({ endlessBest: correctChars })
      },
    }),
    {
      name: 'landing.typing.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
