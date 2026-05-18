import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type GameKey = 'snake' | 'flappy' | 'tetris' | 'sudoku' | 'goldminer'

const ALL_GAMES: GameKey[] = ['snake', 'flappy', 'tetris', 'sudoku', 'goldminer']

type State = {
  highScores: Record<GameKey, number>
}

type Actions = {
  recordScore: (game: GameKey, score: number) => void
}

export const useMinigameStore = create<State & Actions>()(
  persist(
    (set) => ({
      highScores: { snake: 0, flappy: 0, tetris: 0, sudoku: 0, goldminer: 0 },
      recordScore: (game, score) =>
        set((state) => ({
          highScores: {
            ...state.highScores,
            [game]: Math.max(state.highScores[game], score),
          },
        })),
    }),
    {
      name: 'landing.minigame.v2',
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: any) => {
        const prev = persisted?.state?.highScores ?? persisted?.highScores ?? {}
        const filled: Record<GameKey, number> = {} as Record<GameKey, number>
        for (const k of ALL_GAMES) filled[k] = prev[k] ?? 0
        return { ...persisted, highScores: filled }
      },
    },
  ),
)
