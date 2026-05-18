import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type CustomWallpaperMeta = { id: string; name: string }

export type WeatherLocation = {
  name: string
  latitude: number
  longitude: number
  country?: string
}

export type ContentWidth = 'full' | 2000 | 1600 | 1280

type State = {
  wallpaperId: string
  customWallpapers: CustomWallpaperMeta[]
  greetingName: string
  hour24: boolean
  locale: 'vi' | 'en'
  weatherLocation: WeatherLocation
  weatherUnit: 'celsius' | 'fahrenheit'
  contentWidth: ContentWidth
}

type Actions = {
  setWallpaperId: (id: string) => void
  addCustomWallpaper: (meta: CustomWallpaperMeta) => void
  removeCustomWallpaper: (id: string) => void
  setGreetingName: (name: string) => void
  setHour24: (v: boolean) => void
  setLocale: (l: 'vi' | 'en') => void
  setWeatherLocation: (loc: WeatherLocation) => void
  setWeatherUnit: (u: 'celsius' | 'fahrenheit') => void
  setContentWidth: (w: ContentWidth) => void
}

const defaultLocale = (): 'vi' | 'en' => {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

export const useSettingsStore = create<State & Actions>()(
  persist(
    (set) => ({
      wallpaperId: 'bundled:01',
      customWallpapers: [],
      greetingName: '',
      hour24: true,
      locale: defaultLocale(),
      weatherLocation: defaultLocale() === 'vi'
        ? { name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, country: 'VN' }
        : { name: 'New York', latitude: 40.7128, longitude: -74.006, country: 'US' },
      weatherUnit: 'celsius',
      contentWidth: 'full',
      setWallpaperId: (id) => set({ wallpaperId: id }),
      addCustomWallpaper: (meta) =>
        set((state) => ({ customWallpapers: [...state.customWallpapers, meta] })),
      removeCustomWallpaper: (id) =>
        set((state) => ({ customWallpapers: state.customWallpapers.filter((w) => w.id !== id) })),
      setGreetingName: (greetingName) => set({ greetingName }),
      setHour24: (hour24) => set({ hour24 }),
      setLocale: (locale) => set({ locale }),
      setWeatherLocation: (weatherLocation) => set({ weatherLocation }),
      setWeatherUnit: (weatherUnit) => set({ weatherUnit }),
      setContentWidth: (contentWidth) => set({ contentWidth }),
    }),
    {
      name: 'landing.settings.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
