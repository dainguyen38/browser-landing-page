import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Environment } from '@/lib/flappy/scene'
import type { BirdStyle } from '@/lib/flappy/birds'

export type GameKey = 'snake' | 'flappy' | 'tetris' | 'sudoku' | 'goldminer' | 'dino' | 'g2048' | 'blockblast'

const ALL_GAMES: GameKey[] = ['snake', 'flappy', 'tetris', 'sudoku', 'goldminer', 'dino', 'g2048', 'blockblast']

type State = {
  highScores: Record<GameKey, number>
  flappyRecord: { name: string; score: number; recordedAt: number } | null
  flappyEnvironment: Environment
  flappyBird: BirdStyle | 'custom'
}

type Actions = {
  recordScore: (game: GameKey, score: number) => void
  claimFlappyRecord: (score: number, name: string) => boolean
  selectFlappyEnvironment: (environment: Environment) => void
  selectFlappyBird: (bird: BirdStyle | 'custom') => void
}

export const useMinigameStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      highScores: { snake: 0, flappy: 0, tetris: 0, sudoku: 0, goldminer: 0, dino: 0, g2048: 0, blockblast: 0 },
      flappyRecord: null,
      flappyBird: 'canary',
      flappyEnvironment: 'day',
      selectFlappyEnvironment: (flappyEnvironment) => set({ flappyEnvironment }),
      selectFlappyBird: (flappyBird) => set({ flappyBird }),
      claimFlappyRecord: (score, name) => {
        const trimmed = name.trim().slice(0, 32)
        if (!trimmed || score <= 0 || score !== get().highScores.flappy) return false
        set({ flappyRecord: { score, name: trimmed, recordedAt: Date.now() } })
        return true
      },
      recordScore: (game, score) =>
        set((state) => ({
          flappyRecord: game === 'flappy' && score > state.highScores.flappy ? null : state.flappyRecord,
          highScores: {
            ...state.highScores,
            [game]: Math.max(state.highScores[game], score),
          },
        })),
    }),
    {
      name: 'landing.minigame.v2',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<State> | undefined
        return { ...current, ...saved, highScores: { ...current.highScores, ...saved?.highScores } }
      },
      migrate: (persisted: any) => {
        const prev = persisted?.state?.highScores ?? persisted?.highScores ?? {}
        const filled: Record<GameKey, number> = {} as Record<GameKey, number>
        for (const k of ALL_GAMES) filled[k] = prev[k] ?? 0
        return { ...persisted, highScores: filled }
      },
    },
  ),
)
