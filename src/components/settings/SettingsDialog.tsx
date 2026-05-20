import { useState } from 'react'
import { AlertTriangle, Maximize2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WallpaperPicker } from './WallpaperPicker'
import { useSettingsStore, type ContentWidth } from '@/store/settings'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { t } = useT()
  const hour24 = useSettingsStore((s) => s.hour24)
  const setHour24 = useSettingsStore((s) => s.setHour24)
  const greetingName = useSettingsStore((s) => s.greetingName)
  const setGreetingName = useSettingsStore((s) => s.setGreetingName)
  const contentWidth = useSettingsStore((s) => s.contentWidth)
  const setContentWidth = useSettingsStore((s) => s.setContentWidth)

  const [confirmReset, setConfirmReset] = useState(false)

  const resetAll = () => {
    if (typeof indexedDB !== 'undefined') {
      try { indexedDB.deleteDatabase('keyval-store') } catch {}
    }
    localStorage.clear()
    location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settings.title')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="wallpaper">
          <TabsList className="w-full">
            <TabsTrigger value="wallpaper" className="flex-1">
              {t('settings.wallpaper')}
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              {t('common.settings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallpaper" className="max-h-[60vh] overflow-y-auto pr-1">
            <WallpaperPicker />
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="greeting-name">{t('settings.name')}</Label>
              <Input
                id="greeting-name"
                value={greetingName}
                onChange={(e) => setGreetingName(e.target.value)}
                placeholder={t('settings.namePh')}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="hour24" checked={hour24} onCheckedChange={(v) => setHour24(!!v)} />
              <Label htmlFor="hour24">{t('settings.hour24')}</Label>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4" /> {t('settings.contentWidth')}
              </Label>
              <Select
                value={String(contentWidth)}
                onValueChange={(v) =>
                  setContentWidth((v === 'full' ? 'full' : (Number(v) as ContentWidth)))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t('settings.widthFull')}</SelectItem>
                  <SelectItem value="2000">{t('settings.widthExtraWide')}</SelectItem>
                  <SelectItem value="1600">{t('settings.widthWide')}</SelectItem>
                  <SelectItem value="1280">{t('settings.widthCompact')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 border-t border-white/10">
              <h3 className="flex items-center gap-2 text-sm font-medium text-rose-300 mb-2">
                <AlertTriangle className="h-4 w-4" />
                {t('settings.danger')}
              </h3>
              {confirmReset ? (
                <div className="space-y-2">
                  <p className="text-xs text-white/70">{t('settings.resetConfirm')}</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={resetAll}>
                      {t('common.confirm')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                  {t('settings.resetAll')}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
