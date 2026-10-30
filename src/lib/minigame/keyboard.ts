import type { GameKey } from '@/store/minigame'

export function gameKeyAction(game: GameKey, paused: boolean, key: string) {
  if (key === 'Escape') return game === 'snake' || paused ? 'close' : 'pause'
  if (game === 'snake' && key === ' ') return paused ? 'resume' : 'pause'
  return null
}
