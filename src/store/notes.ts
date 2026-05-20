import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'

export type Note = {
  id: string
  title: string
  content: string
  color: string
  createdAt: string
  updatedAt: string
}

type State = { notes: Note[] }

type Actions = {
  add: (init?: Partial<Pick<Note, 'title' | 'content' | 'color'>>) => string
  update: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color'>>) => void
  remove: (id: string) => void
}

const PALETTE = ['#fde68a', '#bbf7d0', '#bae6fd', '#ddd6fe', '#fbcfe8', '#fed7aa']

export const useNotesStore = create<State & Actions>()(
  persist(
    (set) => ({
      notes: [],
      add: (init) => {
        const now = new Date().toISOString()
        const id = uid()
        set((s) => ({
          notes: [
            {
              id,
              title: init?.title ?? '',
              content: init?.content ?? '',
              color: init?.color ?? PALETTE[s.notes.length % PALETTE.length],
              createdAt: now,
              updatedAt: now,
            },
            ...s.notes,
          ],
        }))
        return id
      },
      update: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
          ),
        })),
      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    {
      name: 'landing.notes.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
