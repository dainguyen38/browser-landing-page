import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { WeatherCurrent } from '@/lib/weather'

type CacheEntry = {
  key: string // `${lat},${lon},${unit}`
  data: WeatherCurrent
}

type State = {
  cache: CacheEntry | null
}

type Actions = {
  setCache: (entry: CacheEntry) => void
  clear: () => void
}

export const useWeatherStore = create<State & Actions>()(
  persist(
    (set) => ({
      cache: null,
      setCache: (cache) => set({ cache }),
      clear: () => set({ cache: null }),
    }),
    {
      name: 'landing.weather.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
