import { useState } from 'react'
import { Languages, Clock as ClockIcon, Pin as PinIcon, CheckSquare, Eye, EyeOff, AlertTriangle, ThermometerSun, Maximize2, Gamepad2 } from 'lucide-react'
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
import { useLayoutStore, type WidgetId } from '@/store/layout'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WIDGET_ICONS: Record<WidgetId, React.ElementType> = {
  clock: ClockIcon,
  pinned: PinIcon,
  todo: CheckSquare,
  weather: ThermometerSun,
  minigame: Gamepad2,
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { t } = useT()
  const locale = useSettingsStore((s) => s.locale)
  const setLocale = useSettingsStore((s) => s.setLocale)
  const hour24 = useSettingsStore((s) => s.hour24)
  const setHour24 = useSettingsStore((s) => s.setHour24)
  const greetingName = useSettingsStore((s) => s.greetingName)
  const setGreetingName = useSettingsStore((s) => s.setGreetingName)
  const contentWidth = useSettingsStore((s) => s.contentWidth)
  const setContentWidth = useSettingsStore((s) => s.setContentWidth)
  const hidden = useLayoutStore((s) => s.hidden)
  const toggleHidden = useLayoutStore((s) => s.toggleHidden)

  const [confirmReset, setConfirmReset] = useState(false)

  const resetAll = () => {
    if (typeof indexedDB !== 'undefined') {
      try { indexedDB.deleteDatabase('keyval-store') } catch {}
    }
    localStorage.clear()
    location.reload()
  }

  const widgetKeys: WidgetId[] = ['clock', 'pinned', 'todo', 'weather', 'minigame']

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
            <TabsTrigger value="widgets" className="flex-1">
              {t('settings.widgets')}
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              {t('common.settings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallpaper" className="max-h-[60vh] overflow-y-auto pr-1">
            <WallpaperPicker />
          </TabsContent>

          <TabsContent value="widgets" className="space-y-4">
            <p className="text-xs text-white/60">{t('settings.layoutHint')}</p>
            <div className="space-y-2">
              {widgetKeys.map((id) => {
                const Icon = WIDGET_ICONS[id]
                const isHidden = hidden.includes(id)
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-white/80" />
                      <span className="text-sm">{t(`settings.${id}`)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHidden(id)}
                      className={cn('gap-1.5', isHidden && 'text-white/50')}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {isHidden ? t('common.add') : t('common.delete')}
                    </Button>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Languages className="h-4 w-4" /> {t('settings.language')}
              </Label>
              <div className="inline-flex rounded-md border border-white/15 overflow-hidden">
                <button
                  className={cn('px-3 py-1.5 text-sm', locale === 'en' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10')}
                  onClick={() => setLocale('en')}
                >
                  English
                </button>
                <button
                  className={cn('px-3 py-1.5 text-sm', locale === 'vi' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10')}
                  onClick={() => setLocale('vi')}
                >
                  Tiếng Việt
                </button>
              </div>
            </div>

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
