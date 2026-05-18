import { useEffect, useMemo, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settings'
import {
  BUNDLED_WALLPAPERS,
  deleteCustomWallpaper,
  loadCustomWallpaper,
  saveCustomWallpaper,
} from '@/lib/wallpapers'
import { uid } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

type Thumb = { id: string; url: string; label: string; custom: boolean }

export function WallpaperPicker() {
  const { t } = useT()
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const setWallpaperId = useSettingsStore((s) => s.setWallpaperId)
  const customMetas = useSettingsStore((s) => s.customWallpapers)
  const addCustomMeta = useSettingsStore((s) => s.addCustomWallpaper)
  const removeCustomMeta = useSettingsStore((s) => s.removeCustomWallpaper)

  const [customThumbs, setCustomThumbs] = useState<Thumb[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    async function load() {
      const next: Thumb[] = []
      for (const meta of customMetas) {
        const blob = await loadCustomWallpaper(meta.id)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        urls.push(url)
        next.push({ id: `custom:${meta.id}`, url, label: meta.name, custom: true })
      }
      if (!cancelled) setCustomThumbs(next)
    }
    load()
    return () => {
      cancelled = true
      for (const u of urls) URL.revokeObjectURL(u)
    }
  }, [customMetas])

  const bundledThumbs: Thumb[] = useMemo(
    () => BUNDLED_WALLPAPERS.map((w) => ({ id: w.id, url: w.url, label: w.label, custom: false })),
    [],
  )

  const onUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const id = uid()
      await saveCustomWallpaper(id, file)
      addCustomMeta({ id, name: file.name.replace(/\.[^.]+$/, '') })
      setWallpaperId(`custom:${id}`)
    } finally {
      setUploading(false)
    }
  }

  const removeCustom = async (id: string) => {
    // id stored is full key `custom:<uuid>`; strip prefix to delete blob and meta
    const rawId = id.startsWith('custom:') ? id.slice('custom:'.length) : id
    await deleteCustomWallpaper(rawId)
    removeCustomMeta(rawId)
    if (wallpaperId === id) setWallpaperId('bundled:01')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('settings.wallpaperBundled')}</h3>
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
          <span
            className={cn(
              'inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer',
              uploading && 'opacity-60 pointer-events-none',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {t('settings.wallpaperUpload')}
          </span>
        </label>
      </div>

      <Gallery thumbs={bundledThumbs} active={wallpaperId} onSelect={setWallpaperId} />

      {customThumbs.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-white pt-2">{t('settings.wallpaperCustom')}</h3>
          <Gallery
            thumbs={customThumbs}
            active={wallpaperId}
            onSelect={setWallpaperId}
            onRemove={removeCustom}
          />
        </>
      )}
    </div>
  )
}

function Gallery({
  thumbs,
  active,
  onSelect,
  onRemove,
}: {
  thumbs: Thumb[]
  active: string
  onSelect: (id: string) => void
  onRemove?: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {thumbs.map((thumb) => (
        <div key={thumb.id} className="relative group/wp">
          <button
            type="button"
            onClick={() => onSelect(thumb.id)}
            className={cn(
              'block w-full aspect-video rounded-lg overflow-hidden border-2 transition-all',
              active === thumb.id ? 'border-primary ring-2 ring-primary/40' : 'border-white/15 hover:border-white/40',
            )}
            title={thumb.label}
          >
            <img src={thumb.url} alt={thumb.label} className="h-full w-full object-cover" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(thumb.id)}
              className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 group-hover/wp:opacity-100 transition-opacity"
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
