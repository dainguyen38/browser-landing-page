import { useEffect, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DraggableGrid } from '@/components/layout/DraggableGrid'
import { ClockWidget } from '@/components/widgets/ClockWidget'
import { PinnedSitesWidget } from '@/components/widgets/PinnedSitesWidget'
import { TodoWidget } from '@/components/widgets/TodoWidget'
import { WeatherWidget } from '@/components/widgets/WeatherWidget'
import { MinigameWidget } from '@/components/widgets/MinigameWidget'
import { CalculatorWidget } from '@/components/widgets/CalculatorWidget'
import { GoldPriceWidget } from '@/components/widgets/GoldPriceWidget'
import { LunarCalendarWidget } from '@/components/widgets/LunarCalendarWidget'
import { ColorPickerWidget } from '@/components/widgets/ColorPickerWidget'
import { CurrencyConverterWidget } from '@/components/widgets/CurrencyConverterWidget'
import { NotesWidget } from '@/components/widgets/NotesWidget'
import { DrawingWidget } from '@/components/widgets/DrawingWidget'
import { TreeWidget } from '@/components/widgets/TreeWidget'
import { EnglishWidget } from '@/components/widgets/EnglishWidget'
import { FootballWidget } from '@/components/widgets/FootballWidget'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { WidgetVisibilityPopover } from '@/components/layout/WidgetVisibilityPopover'
import { QuickSearchBar } from '@/components/layout/QuickSearchBar'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { AnimatedWallpaper } from '@/components/wallpapers/AnimatedWallpaper'
import { FlagBunting } from '@/components/FlagBunting'
import { useWallpaperUrl } from '@/hooks/useWallpaperUrl'
import { useSettingsStore } from '@/store/settings'
import { getAnimatedDef, isAnimatedWallpaperId } from '@/lib/wallpapers'

export default function App() {
  const wallpaper = useWallpaperUrl()
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const contentWidth = useSettingsStore((s) => s.contentWidth)
  const buntingEnabled = useSettingsStore((s) => s.buntingEnabled)
  const buntingFlags = useSettingsStore((s) => s.buntingFlags)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const animatedDef = isAnimatedWallpaperId(wallpaperId) ? getAnimatedDef(wallpaperId) : null

  useEffect(() => {
    if (animatedDef) {
      // animated wallpaper is rendered by <AnimatedWallpaper /> below
      document.body.style.backgroundImage = 'none'
      document.body.style.backgroundColor = '#0a0a0f'
      return
    }
    if (wallpaper) {
      document.body.style.backgroundImage = `url("${wallpaper}")`
      document.body.style.backgroundColor = ''
    }
  }, [wallpaper, animatedDef])

  const maxWidthStyle: React.CSSProperties = {
    ...(contentWidth === 'full' ? { maxWidth: 'none' } : { maxWidth: `${contentWidth}px` }),
    // leave clearance for the hanging flags so they don't cover the header
    ...(buntingEnabled && buntingFlags.length > 0 ? { paddingTop: 78 } : null),
  }

  return (
    <div className="min-h-full">
      {animatedDef && <AnimatedWallpaper variant={animatedDef.variant} />}
      {/* Subtle overlay for legibility on bright wallpapers */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

      {buntingEnabled && buntingFlags.length > 0 && (
        <FlagBunting key={buntingFlags.join(',')} flags={buntingFlags} />
      )}

      <main
        className="relative mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10"
        style={maxWidthStyle}
      >
        <header className="flex items-center gap-3 mb-6">
          <QuickSearchBar />
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle />
            <WidgetVisibilityPopover />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="backdrop-blur-xl"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <DraggableGrid
          widgets={[
            { id: 'clock', node: <ClockWidget /> },
            { id: 'weather', node: <WeatherWidget /> },
            { id: 'gold', node: <GoldPriceWidget /> },
            { id: 'currency', node: <CurrencyConverterWidget /> },
            { id: 'lunar', node: <LunarCalendarWidget /> },
            { id: 'pinned', node: <PinnedSitesWidget /> },
            { id: 'todo', node: <TodoWidget /> },
            { id: 'minigame', node: <MinigameWidget /> },
            { id: 'calculator', node: <CalculatorWidget /> },
            { id: 'colorpicker', node: <ColorPickerWidget /> },
            { id: 'notes', node: <NotesWidget /> },
            { id: 'drawing', node: <DrawingWidget /> },
            { id: 'tree', node: <TreeWidget /> },
            { id: 'english', node: <EnglishWidget /> },
            { id: 'football', node: <FootballWidget /> },
          ]}
        />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
