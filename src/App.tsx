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
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { WidgetVisibilityPopover } from '@/components/layout/WidgetVisibilityPopover'
import { useWallpaperUrl } from '@/hooks/useWallpaperUrl'
import { useSettingsStore } from '@/store/settings'

export default function App() {
  const wallpaper = useWallpaperUrl()
  const contentWidth = useSettingsStore((s) => s.contentWidth)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (wallpaper) {
      document.body.style.backgroundImage = `url("${wallpaper}")`
    }
  }, [wallpaper])

  const maxWidthStyle: React.CSSProperties =
    contentWidth === 'full' ? { maxWidth: 'none' } : { maxWidth: `${contentWidth}px` }

  return (
    <div className="min-h-full">
      {/* Subtle overlay for legibility on bright wallpapers */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

      <main
        className="relative mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10"
        style={maxWidthStyle}
      >
        <header className="flex items-center justify-end gap-2 mb-6">
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
        </header>

        <DraggableGrid
          widgets={[
            { id: 'clock', node: <ClockWidget /> },
            { id: 'weather', node: <WeatherWidget /> },
            { id: 'pinned', node: <PinnedSitesWidget /> },
            { id: 'todo', node: <TodoWidget /> },
            { id: 'minigame', node: <MinigameWidget /> },
            { id: 'calculator', node: <CalculatorWidget /> },
          ]}
        />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
