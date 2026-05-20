import * as React from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import { GripVertical } from 'lucide-react'
import { useLayoutStore, type GridItem, type WidgetId, DEFAULT_LAYOUT } from '@/store/layout'

const Responsive = WidthProvider(GridLayout)

type WidgetChild = { id: WidgetId; node: React.ReactNode }

export function DraggableGrid({ widgets }: { widgets: WidgetChild[] }) {
  const layout = useLayoutStore((s) => s.layout)
  const hidden = useLayoutStore((s) => s.hidden)
  const setLayout = useLayoutStore((s) => s.setLayout)

  const visibleIds = widgets.map((w) => w.id).filter((id) => !hidden.includes(id))
  const byId = new Map(widgets.map((w) => [w.id, w.node]))

  // Only include layout entries for currently visible widgets.
  // Override min/max bounds from DEFAULT_LAYOUT so changes to bounds take effect for existing users.
  const currentLayout: GridItem[] = visibleIds
    .map((id) => {
      const stored = layout.find((l) => l.i === id)
      const def = DEFAULT_LAYOUT.find((l) => l.i === id)
      if (!stored) return def
      return {
        ...stored,
        minW: def?.minW,
        minH: def?.minH,
        maxW: def?.maxW,
        maxH: def?.maxH,
      }
    })
    .filter((x): x is GridItem => !!x)

  const handleChange = (next: Layout[]) => {
    // Merge into stored layout: keep hidden widgets' coords intact, update visible ones.
    // For widgets that don't have a stored entry yet (e.g. newly added since last visit),
    // capture their current position so they don't keep falling back to defaults.
    const map = new Map(layout.map((l) => [l.i, l]))
    let changed = false
    for (const item of next) {
      const id = item.i as WidgetId
      const prev = map.get(id)
      if (prev) {
        if (prev.x === item.x && prev.y === item.y && prev.w === item.w && prev.h === item.h) {
          continue
        }
        map.set(id, { ...prev, x: item.x, y: item.y, w: item.w, h: item.h })
        changed = true
      } else {
        const def = DEFAULT_LAYOUT.find((d) => d.i === id)
        if (!def) continue
        map.set(id, {
          i: id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: def.minW,
          minH: def.minH,
          maxW: def.maxW,
          maxH: def.maxH,
        })
        changed = true
      }
    }
    if (changed) setLayout(Array.from(map.values()))
  }

  return (
    <Responsive
      className="layout"
      layout={currentLayout}
      cols={12}
      rowHeight={32}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      draggableHandle=".drag-handle"
      resizeHandles={['se']}
      onLayoutChange={handleChange}
      compactType={null}
      preventCollision={true}
      allowOverlap={false}
    >
      {visibleIds.map((id) => (
        <div key={id} className="group/widget relative">
          <button
            type="button"
            aria-label="Drag widget"
            className="drag-handle absolute top-2 right-2 z-20 inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/5 text-white/60 hover:text-white hover:bg-white/15 opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="h-full w-full">{byId.get(id)}</div>
        </div>
      ))}
    </Responsive>
  )
}
