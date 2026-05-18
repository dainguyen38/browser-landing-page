import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type WidgetId = 'clock' | 'pinned' | 'todo' | 'weather'

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
}

export const DEFAULT_LAYOUT: GridItem[] = [
  { i: 'clock', x: 0, y: 0, w: 8, h: 5, minW: 2, minH: 2 },
  { i: 'weather', x: 8, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'pinned', x: 0, y: 5, w: 12, h: 5, minW: 2, minH: 2 },
  { i: 'todo', x: 0, y: 10, w: 12, h: 10, minW: 2, minH: 3 },
]

const DEFAULT_IDS: WidgetId[] = ['clock', 'pinned', 'todo', 'weather']

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
