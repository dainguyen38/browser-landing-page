// Per-widget data clearing. Triggered from the Widget Visibility popover.
// Each entry knows which localStorage keys + IndexedDB blobs belong to a
// widget so the user can wipe just that widget's state. After running we
// `location.reload()` so every store re-hydrates from a clean slate.

import { del as idbDel } from 'idb-keyval'
import type { WidgetId } from '@/store/layout'

type Clearer = () => Promise<void> | void

const STATIC_KEYS: Partial<Record<WidgetId, string[]>> = {
  pinned: ['landing.pinned.v1'],
  todo: ['landing.todos.v1'],
  weather: ['landing.weather.v1'],
  minigame: ['landing.minigame.v2', 'landing.minigame.v1'],
  gold: ['landing.gold.v1'],
  colorpicker: ['landing.colorpicker.v1'],
  notes: ['landing.notes.v1'],
  tree: ['landing.tree.v2', 'landing.tree.v1'],
  english: ['landing.english.v1'],
}

const FOOTBALL_PREFIX = 'landing.football.v1:'

const IDB_KEYS: Partial<Record<WidgetId, string[]>> = {
  minigame: ['flappy:bird:custom'],
}

const PREFIX_KEYS: Partial<Record<WidgetId, string[]>> = {
  currency: ['landing.fx.v1:'],
  football: [FOOTBALL_PREFIX],
}

export const HAS_PERSISTED_DATA: Record<WidgetId, boolean> = {
  clock: false,
  pinned: true,
  todo: true,
  weather: true,
  minigame: true,
  calculator: false,
  gold: true,
  lunar: false,
  colorpicker: true,
  currency: true,
  notes: true,
  drawing: false,
  tree: true,
  english: true,
  football: true,
}

const CLEARERS: Partial<Record<WidgetId, Clearer>> = {}

export function clearWidgetData(id: WidgetId): Promise<void> {
  return (async () => {
    const keys = STATIC_KEYS[id] ?? []
    for (const key of keys) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }

    const prefixes = PREFIX_KEYS[id] ?? []
    for (const prefix of prefixes) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i)
          if (k && k.startsWith(prefix)) localStorage.removeItem(k)
        }
      } catch {
        /* ignore */
      }
    }

    const idbs = IDB_KEYS[id] ?? []
    for (const key of idbs) {
      try {
        await idbDel(key)
      } catch {
        /* ignore */
      }
    }

    const custom = CLEARERS[id]
    if (custom) await custom()
  })()
}
