import { useState } from 'react'
import { AlertTriangle, Maximize2, Flag } from 'lucide-react'
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
import { FLAGS } from '@/lib/flags'
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
  const buntingEnabled = useSettingsStore((s) => s.buntingEnabled)
  const setBuntingEnabled = useSettingsStore((s) => s.setBuntingEnabled)
  const buntingFlags = useSettingsStore((s) => s.buntingFlags)
  const setBuntingFlags = useSettingsStore((s) => s.setBuntingFlags)

  const toggleFlag = (id: string) => {
    if (buntingFlags.includes(id)) {
      if (buntingFlags.length === 1) return // keep at least one
      setBuntingFlags(buntingFlags.filter((f) => f !== id))
    } else {
      setBuntingFlags([...buntingFlags, id])
    }
  }

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

            {/* Top flag bunting */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Flag className="h-4 w-4" /> {t('settings.bunting')}
                </Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={buntingEnabled}
                  onClick={() => setBuntingEnabled(!buntingEnabled)}
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                    buntingEnabled ? 'bg-primary' : 'bg-white/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      buntingEnabled ? 'translate-x-4' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>
              {buntingEnabled && (
                <>
                  <p className="text-[11px] text-white/55">{t('settings.buntingHint')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FLAGS.map((f) => {
                      const active = buntingFlags.includes(f.id)
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFlag(f.id)}
                          className={cn(
                            'px-2 py-1 rounded-md text-xs border transition-colors',
                            active
                              ? 'border-primary bg-primary/20 text-white'
                              : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10',
                          )}
                        >
                          {f.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
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
