import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'

export type Priority = 'low' | 'medium' | 'high'

export type Todo = {
  id: string
  text: string
  completed: boolean
  priority: Priority
  dueDate?: string
  category?: string
  createdAt: string
}

export type TodoFilter = 'all' | 'active' | 'completed'
export type TodoSort = 'createdAt' | 'dueDate' | 'priority'

type State = {
  todos: Todo[]
  filter: TodoFilter
  sort: TodoSort
}

type Actions = {
  add: (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => void
  toggle: (id: string) => void
  update: (id: string, patch: Partial<Omit<Todo, 'id' | 'createdAt'>>) => void
  remove: (id: string) => void
  reorder: (orderedIds: string[]) => void
  clearCompleted: () => void
  setFilter: (f: TodoFilter) => void
  setSort: (s: TodoSort) => void
}

export const useTodosStore = create<State & Actions>()(
  persist(
    (set) => ({
      todos: [],
      filter: 'all',
      sort: 'createdAt',
      add: (data) =>
        set((state) => ({
          todos: [
            { id: uid(), createdAt: new Date().toISOString(), completed: false, ...data },
            ...state.todos,
          ],
        })),
      toggle: (id) =>
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
        })),
      update: (id, patch) =>
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      remove: (id) =>
        set((state) => ({
          todos: state.todos.filter((t) => t.id !== id),
        })),
      reorder: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.todos.map((t) => [t.id, t]))
          const reordered: Todo[] = []
          const seen = new Set<string>()
          for (const id of orderedIds) {
            const todo = byId.get(id)
            if (todo && !seen.has(id)) {
              reordered.push(todo)
              seen.add(id)
            }
          }
          // Append any todos that weren't in the orderedIds list (defensive)
          for (const t of state.todos) {
            if (!seen.has(t.id)) reordered.push(t)
          }
          return { todos: reordered }
        }),
      clearCompleted: () =>
        set((state) => ({
          todos: state.todos.filter((t) => !t.completed),
        })),
      setFilter: (filter) => set({ filter }),
      setSort: (sort) => set({ sort }),
    }),
    {
      name: 'landing.todos.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
