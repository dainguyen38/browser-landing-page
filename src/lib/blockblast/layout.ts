import { BOARD_SCALE, BOARD_TILT, DEFAULT_VIEW, clampView, type BoardView } from './projection'

export function blastLayout(width: number, height: number, view: BoardView = DEFAULT_VIEW) {
  const { yaw, tilt, zoom } = clampView(view)
  const landscape = width > height
  const margin = 16, top = height < 420 ? 72 : 88, footer = 68
  const trayWidth = Math.min(260, Math.max(112, width*.18))
  const trayHeight = Math.min(190, Math.max(96, height*.2))
  const tray = landscape
    ? { x: Math.max(margin,width-margin-trayWidth), y: top, width: trayWidth, height: Math.max(0,height-top-footer-12) }
    : { x: margin, y: Math.max(top,height-footer-12-trayHeight), width: Math.max(0,width-margin*2), height: trayHeight }
  const map = {
    x: margin, y: top,
    width: Math.max(0,landscape ? tray.x-margin*2 : width-margin*2),
    height: Math.max(0,landscape ? height-top-footer-12 : tray.y-top-margin),
  }
  const lift = BOARD_SCALE*Math.sin(BOARD_TILT)
  // Fit the complete rotation once; dragging must never resize the map or move its center.
  const radius = Math.max(Math.hypot(4,.8*lift),4*Math.cos(BOARD_TILT)+.8*lift)
  const fitCell = Math.max(0,(Math.min(map.width,map.height)-24)/(2*radius))
  const cell = fitCell*zoom
  const cx = map.x+map.width/2, cy = map.y+map.height/2
  const slots = Array.from({ length: 3 }, (_,i) => landscape
    ? { x:tray.x+tray.width/2, y:tray.y+(i+.5)*tray.height/3, width:Math.max(0,tray.width-16), height:Math.max(0,tray.height/3-12) }
    : { x:tray.x+(i+.5)*tray.width/3, y:tray.y+tray.height/2, width:Math.max(0,tray.width/3-10), height:Math.max(0,tray.height-16) })
  const trayCell = Math.max(0,Math.min(slots[0].width/5,slots[0].height/5,cell*.85)*.9)
  return { width,height,cell,x:cx-cell*4,y:cy-cell*4,trayCell,slots,landscape,map,tray,yaw,tilt,zoom }
}
