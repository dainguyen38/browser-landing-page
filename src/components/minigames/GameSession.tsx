import { Component, createContext, useCallback, useContext, useState, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import { newSnapshot, type GameSnapshot } from '@/lib/minigame/snapshot'
import type { GameKey } from '@/store/minigame'

export type GameSession = {
  paused: boolean
  visible: boolean
  pauseVersion: number
  snapshot: GameSnapshot
  assets: Map<string, Blob>
  error: boolean
  setPaused: (paused: boolean) => void
  fail: (error: unknown) => void
  guard: <T>(action: () => T) => T | undefined
}

export function createGameSession(game: GameKey, onChange: (session: GameSession) => void = () => {}): GameSession {
  const session: GameSession = {
    paused: false, visible: true, pauseVersion: 0,
    snapshot: newSnapshot(game), assets: new Map(), error: false,
    setPaused(value) {
      if (session.paused !== value) session.pauseVersion++
      session.paused = value
      onChange(session)
    },
    fail(error) {
      console.error(`Minigame ${game} could not continue`, error)
      session.error = true
      session.setPaused(true)
    },
    guard(action) {
      if (session.error) return
      try { return action() } catch (error) { session.fail(error) }
    },
  }
  return session
}

export const GameSessionContext = createContext<GameSession | null>(null)
export function useGameSession() {
  const session = useContext(GameSessionContext)
  if (!session) throw new Error('Missing minigame session')
  return session
}

// Save gameplay values, never canvas nodes, animation handles, or DOM containers.
export function useGameState<T>(key: string, initial: T | (() => T)) {
  const session = useGameSession()
  const [value, setValue] = useState<T>(() => {
    const state = session.snapshot.state
    if (!(key in state)) state[key] = typeof initial === 'function' ? (initial as () => T)() : initial
    return state[key] as T
  })
  const update = useCallback((action: SetStateAction<T>) => {
    const state = session.snapshot.state
    const next = typeof action === 'function' ? (action as (value: T) => T)(state[key] as T) : action
    state[key] = next
    setValue(next)
  }, [session, key])
  return [value, update] as const
}

export function useGameRef<T>(key: string, initial: T | (() => T)): MutableRefObject<T> {
  const session = useGameSession()
  if (!(key in session.snapshot.refs)) {
    session.snapshot.refs[key] = { current: typeof initial === 'function' ? (initial as () => T)() : initial }
  }
  return session.snapshot.refs[key] as MutableRefObject<T>
}

export class GameErrorBoundary extends Component<{ session: GameSession; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.props.session.fail(error) }
  render() { return this.state.failed ? null : this.props.children }
}
