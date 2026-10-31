export const BOARD_TILT = Math.PI * 55 / 180
export const BOARD_SCALE = Math.SQRT1_2
export const DEFAULT_VIEW = { yaw: -Math.PI / 4, tilt: BOARD_TILT, zoom: 1 }
export type BoardView = typeof DEFAULT_VIEW
export function clampView(view: BoardView): BoardView {
  return {
    yaw: Math.max(-Math.PI * 1.25, Math.min(Math.PI * .75, view.yaw)),
    tilt: BOARD_TILT,
    zoom: Math.max(.6, Math.min(1, view.zoom)),
  }
}
type BoardLayout = { x: number; y: number; cell: number; yaw?: number; tilt?: number }
function axes(layout: BoardLayout) {
  const angle = (layout.yaw ?? DEFAULT_VIEW.yaw)-DEFAULT_VIEW.yaw
  const c = Math.cos(angle), s = Math.sin(angle), slope = Math.cos(BOARD_TILT)
  const lift = BOARD_SCALE*Math.sin(BOARD_TILT)
  // Rotate the entire tilted board rigidly around the viewing axis, without re-tilting its grid.
  return { a: (c+s*slope)/2, b: (-s+c*slope)/2,
    c: (-c+s*slope)/2, d: (s+c*slope)/2, liftX: -s*lift, liftY: -c*lift }
}
// Rendering, dragging and hit testing share this projection at every view angle.
export function boardToScreen(layout: BoardLayout, x: number, y: number, z = 0) {
  const cx = layout.x + layout.cell*4, cy = layout.y + layout.cell*4
  const u = x-cx, v = y-cy, m = axes(layout)
  return { x: cx+m.a*u+m.c*v+z*m.liftX, y: cy+m.b*u+m.d*v+z*m.liftY }
}
export function screenToBoard(layout: BoardLayout, x: number, y: number, z = 0) {
  const cx = layout.x + layout.cell*4, cy = layout.y + layout.cell*4
  const m = axes(layout), dx = x-cx-z*m.liftX, dy = y-cy-z*m.liftY, det = m.a*m.d-m.b*m.c
  return { x: cx+(m.d*dx-m.c*dy)/det, y: cy+(m.a*dy-m.b*dx)/det }
}
export function boardCanvasMatrix(layout: BoardLayout, z = 0): [number, number, number, number, number, number] {
  const m = axes(layout), origin = boardToScreen(layout,0,0,z)
  return [m.a,m.b,m.c,m.d,origin.x,origin.y]
}
