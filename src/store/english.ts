import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'

export type Topic = {
  id: string
  name: string
  /** Datamuse `topics=` query string */
  query: string
  custom: boolean
}

export const DEFAULT_TOPICS: Topic[] = [
  { id: 'daily', name: 'Daily life', query: 'family,home,morning,routine', custom: false },
  { id: 'business', name: 'Business', query: 'business,office,meeting,company', custom: false },
  { id: 'technology', name: 'Technology', query: 'technology,computer,software,internet', custom: false },
  { id: 'travel', name: 'Travel', query: 'travel,airport,hotel,vacation', custom: false },
  { id: 'food', name: 'Food', query: 'food,restaurant,cooking,kitchen', custom: false },
  { id: 'nature', name: 'Nature', query: 'nature,animal,forest,weather', custom: false },
  { id: 'health', name: 'Health', query: 'health,medicine,doctor,exercise', custom: false },
  { id: 'education', name: 'Education', query: 'education,school,study,learning', custom: false },
  { id: 'emotion', name: 'Emotions', query: 'emotion,feeling,happiness,mood', custom: false },
  { id: 'sport', name: 'Sports', query: 'sport,game,team,exercise', custom: false },
]

export const TARGET_LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
]

export const MIN_WORD_COUNT = 3
export const MAX_WORD_COUNT = 20

interface State {
  topics: Topic[]
  activeTopicId: string
  wordCount: number
  targetLanguage: string
  /** date YYYY-MM-DD → topicId → list of words (cached so words don't change across day) */
  daily: Record<string, Record<string, string[]>>
  /** counter incremented to force re-roll within the same day */
  refreshTick: number
}

interface Actions {
  setActiveTopic: (id: string) => void
  setWordCount: (n: number) => void
  setTargetLanguage: (code: string) => void
  addTopic: (name: string, query: string) => string
  removeTopic: (id: string) => void
  cacheDaily: (topicId: string, words: string[]) => void
  refresh: () => void
}

export const useEnglishStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      topics: DEFAULT_TOPICS,
      activeTopicId: DEFAULT_TOPICS[0].id,
      wordCount: 6,
      targetLanguage: 'vi',
      daily: {},
      refreshTick: 0,
      setActiveTopic: (id) => set({ activeTopicId: id }),
      setWordCount: (n) =>
        set({ wordCount: Math.max(MIN_WORD_COUNT, Math.min(MAX_WORD_COUNT, Math.floor(n))) }),
      setTargetLanguage: (code) => set({ targetLanguage: code }),
      addTopic: (name, query) => {
        const id = uid().slice(0, 8)
        const t: Topic = { id, name: name.trim() || 'Topic', query: query.trim() || name.trim(), custom: true }
        set((s) => ({ topics: [...s.topics, t], activeTopicId: id }))
        return id
      },
      removeTopic: (id) =>
        set((s) => {
          const topics = s.topics.filter((t) => t.id !== id)
          const activeTopicId = s.activeTopicId === id ? topics[0]?.id ?? '' : s.activeTopicId
          return { topics, activeTopicId }
        }),
      cacheDaily: (topicId, words) => {
        const date = new Date().toISOString().slice(0, 10)
        set((s) => ({
          daily: {
            ...s.daily,
            [date]: { ...(s.daily[date] ?? {}), [topicId]: words },
          },
        }))
        // Keep only last 7 days of cache
        const keepCutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
        const cur = get().daily
        const keys = Object.keys(cur).filter((d) => d < keepCutoff)
        if (keys.length > 0) {
          const next = { ...cur }
          for (const k of keys) delete next[k]
          set({ daily: next })
        }
      },
      refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
    }),
    {
      name: 'landing.english.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
