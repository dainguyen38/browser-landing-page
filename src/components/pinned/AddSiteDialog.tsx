import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { isValidUrl, normalizeUrl } from '@/lib/favicon'
import { useT } from '@/i18n/useT'
import type { PinnedSite } from '@/store/pinned'

interface Props {
  open: boolean
  initial?: PinnedSite | null
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; url: string; customIconUrl?: string }) => void
}

export function AddSiteDialog({ open, initial, onOpenChange, onSubmit }: Props) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [customIcon, setCustomIcon] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setUrl(initial?.url ?? '')
      setCustomIcon(initial?.customIconUrl ?? '')
      setError(null)
    }
  }, [open, initial])

  const handleSave = () => {
    if (!isValidUrl(url)) {
      setError(t('pinned.invalidUrl'))
      return
    }
    onSubmit({
      name: name.trim() || new URL(normalizeUrl(url)).hostname.replace(/^www\./, ''),
      url: normalizeUrl(url),
      customIconUrl: customIcon.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t('pinned.editTitle') : t('pinned.addTitle')}</DialogTitle>
          <DialogDescription>{t('pinned.url')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="site-url">{t('pinned.url')}</Label>
            <Input
              id="site-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('pinned.urlPh')}
              autoFocus
            />
            {error && <div className="text-xs text-rose-300">{error}</div>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-name">
              {t('pinned.name')} <span className="text-white/50 text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('pinned.namePh')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-icon">
              {t('pinned.customIcon')} <span className="text-white/50 text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="site-icon"
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              placeholder={t('pinned.customIconPh')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
