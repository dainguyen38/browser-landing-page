import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'

export type PinnedSite = {
  id: string
  name: string
  url: string
  customIconUrl?: string
}

type State = { sites: PinnedSite[] }
type Actions = {
  add: (data: Omit<PinnedSite, 'id'>) => void
  update: (id: string, patch: Partial<Omit<PinnedSite, 'id'>>) => void
  remove: (id: string) => void
  reorder: (ids: string[]) => void
}

export const usePinnedStore = create<State & Actions>()(
  persist(
    (set) => ({
      sites: [],
      add: (data) => set((state) => ({ sites: [...state.sites, { id: uid(), ...data }] })),
      update: (id, patch) =>
        set((state) => ({ sites: state.sites.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
      remove: (id) => set((state) => ({ sites: state.sites.filter((s) => s.id !== id) })),
      reorder: (ids) =>
        set((state) => {
          const map = new Map(state.sites.map((s) => [s.id, s]))
          const reordered = ids.map((id) => map.get(id)).filter(Boolean) as PinnedSite[]
          // append any sites missing from ids (defensive)
          for (const s of state.sites) if (!ids.includes(s.id)) reordered.push(s)
          return { sites: reordered }
        }),
    }),
    {
      name: 'landing.pinned.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
