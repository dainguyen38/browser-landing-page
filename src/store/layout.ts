import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type WidgetId =
  | 'clock'
  | 'pinned'
  | 'todo'
  | 'weather'
  | 'minigame'
  | 'calculator'
  | 'gold'
  | 'lunar'
  | 'colorpicker'
  | 'currency'
  | 'notes'
  | 'drawing'
  | 'tree'

export type GridItem = {
  i: WidgetId
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

type State = {
  layout: GridItem[]
  hidden: WidgetId[]
}

type Actions = {
  setLayout: (next: GridItem[]) => void
  toggleHidden: (id: WidgetId) => void
  setHidden: (next: WidgetId[]) => void
}

export const DEFAULT_LAYOUT: GridItem[] = [
  { i: 'clock', x: 0, y: 0, w: 8, h: 5, minW: 2, minH: 2, maxW: 12 },
  { i: 'weather', x: 8, y: 0, w: 4, h: 5, minW: 2, minH: 3, maxW: 12 },
  { i: 'gold', x: 0, y: 5, w: 4, h: 6, minW: 3, minH: 5, maxW: 12 },
  { i: 'currency', x: 4, y: 5, w: 4, h: 9, minW: 3, minH: 7, maxW: 12 },
  { i: 'lunar', x: 8, y: 5, w: 4, h: 9, minW: 3, minH: 6, maxW: 12 },
  { i: 'pinned', x: 0, y: 10, w: 12, h: 5, minW: 2, minH: 2, maxW: 12 },
  { i: 'todo', x: 0, y: 15, w: 7, h: 10, minW: 2, minH: 3, maxW: 12 },
  { i: 'minigame', x: 7, y: 15, w: 5, h: 8, minW: 3, minH: 4, maxW: 12 },
  { i: 'calculator', x: 0, y: 25, w: 5, h: 11, minW: 3, minH: 8, maxW: 12 },
  { i: 'colorpicker', x: 5, y: 25, w: 7, h: 11, minW: 3, minH: 6, maxW: 12 },
  { i: 'notes', x: 0, y: 36, w: 5, h: 10, minW: 3, minH: 5, maxW: 12 },
  { i: 'tree', x: 5, y: 36, w: 4, h: 12, minW: 3, minH: 8, maxW: 12 },
  { i: 'drawing', x: 9, y: 36, w: 3, h: 12, minW: 3, minH: 7, maxW: 12 },
]

const DEFAULT_IDS: WidgetId[] = [
  'clock',
  'pinned',
  'todo',
  'weather',
  'minigame',
  'calculator',
  'gold',
  'lunar',
  'colorpicker',
  'currency',
  'notes',
  'drawing',
  'tree',
]

export const useLayoutStore = create<State & Actions>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      hidden: [],
      setLayout: (next) => set({ layout: next }),
      toggleHidden: (id) =>
        set((state) => ({
          hidden: state.hidden.includes(id)
            ? state.hidden.filter((x) => x !== id)
            : [...state.hidden, id],
        })),
      setHidden: (next) => set({ hidden: next }),
    }),
    {
      name: 'landing.layout.v2',
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: any) => {
        const defaults = new Map(DEFAULT_LAYOUT.map((l) => [l.i, l]))
        // refresh min/max from DEFAULT_LAYOUT so existing users get updated bounds
        const layout: GridItem[] = (Array.isArray(persisted?.layout) ? persisted.layout : []).map(
          (it: any) => {
            const d = defaults.get(it.i)
            return d
              ? { ...it, minW: d.minW, minH: d.minH, maxW: d.maxW, maxH: d.maxH }
              : it
          },
        )
        const present = new Set(layout.map((x) => x.i))
        for (const id of DEFAULT_IDS) {
          if (!present.has(id)) {
            const fallback = defaults.get(id)
            if (fallback) layout.push(fallback)
          }
        }
        return { ...persisted, layout, hidden: persisted?.hidden ?? [] }
      },
    },
  ),
)
