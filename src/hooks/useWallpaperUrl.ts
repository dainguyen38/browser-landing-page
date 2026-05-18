import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { BUNDLED_WALLPAPERS, getBundled, loadCustomWallpaper } from '@/lib/wallpapers'

export function useWallpaperUrl(): string | null {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const [url, setUrl] = useState<string | null>(() => getBundled(wallpaperId)?.url ?? null)

  useEffect(() => {
    let revoke: string | null = null
    let cancelled = false

    async function resolve() {
      if (wallpaperId.startsWith('bundled:')) {
        const bundled = getBundled(wallpaperId)
        setUrl(bundled?.url ?? BUNDLED_WALLPAPERS[0]?.url ?? null)
        return
      }
      if (wallpaperId.startsWith('custom:')) {
        const id = wallpaperId.slice('custom:'.length)
        const blob = await loadCustomWallpaper(id)
        if (cancelled) return
        if (blob) {
          const u = URL.createObjectURL(blob)
          revoke = u
          setUrl(u)
        } else {
          // fallback if blob missing
          setUrl(BUNDLED_WALLPAPERS[0]?.url ?? null)
        }
      }
    }

    resolve()
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [wallpaperId])

  return url
}
