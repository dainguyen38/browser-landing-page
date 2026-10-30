import { createContext, useContext } from 'react'

export type GameSession = {
  paused: boolean
  visible: boolean
  pauseVersion: number
  setPaused: (paused: boolean) => void
}

// One stable control object per mounted game, also read by its existing frame/input callbacks.
export const GameSessionContext = createContext<GameSession>({ paused: false, visible: true, pauseVersion: 0, setPaused: () => {} })
export const useGameSession = () => useContext(GameSessionContext)
