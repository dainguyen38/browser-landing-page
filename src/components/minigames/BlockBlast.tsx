import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BLOCK_STYLES, ENVIRONMENTS } from '@/lib/blockblast/styles'
import { DEFAULT_VIEW, clampView, type BoardView, boardCanvasMatrix, screenToBoard } from '@/lib/blockblast/projection'
import { BlastArtwork, BlastBurst } from './BlastArtwork'
import { MAX_DEBRIS, makeDebris, advanceDebris, type Debris } from '@/lib/blockblast/effects'
import type { BlastScene, RenderBlock } from '@/lib/blockblast/scene'
import { blastLayout } from '@/lib/blockblast/layout'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, Palette, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMinigameStore } from '@/store/minigame'
import { useT } from '@/i18n/useT'
import { useGameRef, useGameSession, useGameState } from './GameSession'
import { SIZE, canPlace, initial, place, type BlastState, type Piece } from '@/lib/blockblast/game'

const THEMES = ENVIRONMENTS
type Drag = { index: number; x: number; y: number; moved: boolean; startX: number; startY: number; touch: boolean }

function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1, styleIndex = 0) {
  const profile = BLOCK_STYLES[styleIndex]
  const pad = size * 0.045
  const side = size - pad * 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = '#0008'
  ctx.shadowBlur = size * 0.12
  ctx.shadowOffsetY = size * 0.08
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.12, color)
  gradient.addColorStop(0.75, color)
  gradient.addColorStop(1, '#000000')
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.roundRect(x+pad, y+pad, side, side, size*profile.radius); ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.fillStyle = '#ffffff30'
  ctx.beginPath(); ctx.roundRect(x+size*.17, y+size*.13, size*.66, size*.12, size*.06); ctx.fill()
  ctx.strokeStyle = '#ffffff26'; ctx.lineWidth = Math.max(1, size*.025)
  ctx.beginPath(); ctx.roundRect(x+pad, y+pad, side, side, size*.14); ctx.stroke()
  if (profile.id === 'wood') {
    ctx.strokeStyle = '#64391155'; ctx.lineWidth = 1
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x+size*.12,y+size*i/7); ctx.bezierCurveTo(x+size*.4,y+size*(i+.4)/7,x+size*.6,y+size*(i-.4)/7,x+size*.88,y+size*i/7); ctx.stroke() }
  }
  if (profile.id === 'neon') { ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.stroke() }
  ctx.restore()
}
function dimensions(piece: Piece) {
  return { w: Math.max(...piece.cells.map((p) => p.x))+1, h: Math.max(...piece.cells.map((p) => p.y))+1 }
}

export function BlockBlast() {
  const session = useGameSession()
  const { t } = useT()
  const engine = useGameRef<BlastState>('engine', initial)
  const [score, setScore] = useGameState('score', 0)
  const [over, setOver] = useGameState('over', false)
  const [, setRunning] = useGameState('running', true)
  const [theme, setTheme] = useGameState('theme', 0)
  const [blockStyle, setBlockStyle] = useGameState('blockStyle', 0)
  const [view, setView] = useGameState<BoardView>('view', DEFAULT_VIEW)
  const viewRef = useRef(view)
  viewRef.current = view
  const highScore = useMinigameStore((s) => s.highScores.blockblast)
  const recordScore = useMinigameStore((s) => s.recordScore)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layout = useRef(blastLayout(0, 0))
  const [viewport, setViewport] = useState(blastLayout(0, 0))
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BlastScene | null>(null)
  const [gpuReady, setGpuReady] = useState(false)
  const [burst, setBurst] = useState(0)
  const drag = useRef<Drag | null>(null)
  const pointers = useRef(new Map<number, {x: number; y: number}>())
  const orbit = useRef<{startX:number; startY:number; x:number; y:number; moved:boolean} | null>(null)
  const pinch = useRef(0)
  const selected = useRef<number | null>(null)
  const cursor = useRef({ x: 0, y: 0 })
  const particles = useRef<Debris[]>([])
  const flash = useRef({ life: 0, text: '' })
  const [announcement, setAnnouncement] = useState('')
  const changeView = useCallback((patch: Partial<BoardView>) => {
    const next = clampView({ ...viewRef.current, ...patch })
    viewRef.current = next
    setView(next)
    layout.current = blastLayout(layout.current.width, layout.current.height, next)
    setViewport(layout.current)
  }, [setView])
  const cancelGesture = (id: number) => {
    pointers.current.delete(id)
    drag.current = null; orbit.current = null; pinch.current = 0
  }

  const commit = (index: number, x: number, y: number) => session.guard(() => {
    if (session.paused) return
    const result = place(engine.current, index, x, y)
    if (!result) return
    const st = engine.current
    selected.current = null
    setScore(st.score); setOver(st.over); setRunning(!st.over)
    recordScore('blockblast', st.score)
    setAnnouncement(`${t('minigame.score')}: ${st.score}${st.over ? ` · ${t('minigame.gameOver')}` : ''}`)
    flash.current = { life: 1, text: result.lines ? `${result.lines > 1 ? 'BLAST! ' : ''}+${result.gained}${st.combo > 1 ? ` ×${st.combo}` : ''}` : '' }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      particles.current = [...particles.current, ...makeDebris(result.cleared, layout.current, THEMES[theme].colors)].slice(-MAX_DEBRIS)
      if (result.lines) setBurst((value) => value + 1)
    }
  })
  const restart = () => {
    engine.current = initial(); setScore(0); setOver(false); setRunning(true)
    particles.current = []; selected.current = null; drag.current = null; flash.current.life = 0
  }
  const anchor = (d: Drag) => {
    const piece = engine.current.pieces[d.index]
    if (!piece) return { x: -10, y: -10 }
    const l = layout.current
    const { w, h } = dimensions(piece)
    const point = screenToBoard(l, d.x, d.y - (d.touch ? l.cell * 1.3 : 0))
    return { x: Math.round((point.x-l.x)/l.cell-w/2), y: Math.round((point.y-l.y)/l.cell-h/2) }
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr)
      layout.current = blastLayout(width, height, viewRef.current)
      setViewport(layout.current)
    }
    const observer = new ResizeObserver(fit); observer.observe(canvas); fit()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const zoom = (event: WheelEvent) => {
      event.preventDefault()
      if (!session.paused) changeView({ zoom: viewRef.current.zoom * Math.exp(-event.deltaY * .001) })
    }
    canvas.addEventListener('wheel', zoom, { passive: false })
    return () => canvas.removeEventListener('wheel', zoom)
  }, [changeView, session])

  useEffect(() => {
    const canvas = webglCanvasRef.current!
    let cancelled = false
    let instance: BlastScene | null = null
    const fallback = () => {
      if (cancelled) return
      sceneRef.current = null
      canvas.style.visibility = 'hidden'
      setGpuReady(false)
    }
    void import('@/lib/blockblast/scene').then(({ createBlastScene }) => {
      if (cancelled) return
      try {
        instance = createBlastScene(canvas, fallback)
        sceneRef.current = instance
        canvas.style.visibility = 'visible'
        setGpuReady(true)
      } catch { fallback() }
    }).catch(fallback)
    return () => {
      cancelled = true
      sceneRef.current = null
      instance?.dispose()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0, last = performance.now(), paintedPauseVersion = -1
    const draw = (now: number) => session.guard(() => {
      const dt = document.hidden || session.paused ? 0 : Math.min(.04, (now-last)/1000)
      last = now
      if (document.hidden || (session.paused && paintedPauseVersion === session.pauseVersion)) {
        raf = requestAnimationFrame(draw)
        return
      }
      paintedPauseVersion = session.paused ? session.pauseVersion : -1
      if (session.paused) { drag.current = null; orbit.current = null; pointers.current.clear(); pinch.current = 0 }
      const l = layout.current, st = engine.current, palette = THEMES[theme]
      const scale = l.width ? canvas.width/l.width : 1
      ctx.setTransform(scale,0,0,scale,0,0)
      ctx.clearRect(0, 0, l.width, l.height)
      const webgl = sceneRef.current
      const blocks: RenderBlock[] = []
      const paint = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1, space: 'board' | 'screen' = 'screen') => {
        if (webgl) blocks.push({ x, y, size, color, alpha, space })
        else {
          ctx.save()
          if (space === 'board') ctx.transform(...boardCanvasMatrix(l, size * (alpha === .9 ? .8 : BLOCK_STYLES[blockStyle].depth/2+.02)))
          block(ctx, x, y, size, color, alpha, blockStyle)
          ctx.restore()
        }
      }
      if (!webgl) {
        const bg = ctx.createLinearGradient(0,0,l.width,l.height)
        bg.addColorStop(0,palette.bg[0]); bg.addColorStop(1,palette.bg[1])
        ctx.fillStyle = bg; ctx.fillRect(0,0,l.width,l.height)
        ctx.fillStyle = '#ffffff03'
        for (let i=0;i<18;i++) { ctx.beginPath(); ctx.arc((i*137.5)%l.width,(i*89.7)%l.height,2+i%3,0,Math.PI*2); ctx.fill() }
        ctx.save()
        ctx.transform(...boardCanvasMatrix(l))
        ctx.fillStyle = '#00000070'
        ctx.shadowColor = '#0008'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10
        ctx.beginPath(); ctx.roundRect(l.x-7,l.y-7,l.cell*8+14,l.cell*8+14,14); ctx.fill()
        ctx.restore()
      }
      for (let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) {
        const color = st.board[y][x]
        if (color) paint(ctx,l.x+x*l.cell,l.y+y*l.cell,l.cell,palette.colors[color-1],1,'board')
        else if (!webgl) { ctx.save(); ctx.transform(...boardCanvasMatrix(l)); ctx.fillStyle = (x+y)%2 ? '#ffffff09' : '#ffffff0e'; ctx.beginPath(); ctx.roundRect(l.x+x*l.cell+2,l.y+y*l.cell+2,Math.max(0,l.cell-4),Math.max(0,l.cell-4),4); ctx.fill(); ctx.restore() }
      }
      st.pieces.forEach((piece,i) => {
        if (!piece) return
        const {w,h} = dimensions(piece)
        const x = l.slots[i].x-w*l.trayCell/2
        const y = l.slots[i].y-h*l.trayCell/2
        if (selected.current === i) { ctx.strokeStyle='#ffffff99'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(x-6,y-6,w*l.trayCell+12,h*l.trayCell+12,8); ctx.stroke() }
        for (const p of piece.cells) paint(ctx,x+p.x*l.trayCell,y+p.y*l.trayCell,l.trayCell,palette.colors[piece.color-1],drag.current?.index===i ? .25 : 1)
      })
      const d = drag.current
      const index = d?.index ?? selected.current
      const piece = index === null || index === undefined ? null : st.pieces[index]
      if (piece) {
        const pos = d ? anchor(d) : cursor.current
        const valid = canPlace(st.board,piece,pos.x,pos.y)
        for (const p of piece.cells) {
          const x = pos.x+p.x, y = pos.y+p.y
          if(x>=0 && x<8 && y>=0 && y<8) paint(ctx,l.x+x*l.cell,l.y+y*l.cell,l.cell,valid ? palette.colors[piece.color-1] : '#ff687d',.55,'board')
        }
        if(d) {
          const {w,h} = dimensions(piece)
          const point = screenToBoard(l, d.x, d.y - (d.touch ? l.cell * 1.3 : 0))
          for (const p of piece.cells) paint(ctx,point.x+(p.x-w/2)*l.cell,point.y+(p.y-h/2)*l.cell,l.cell,palette.colors[piece.color-1],.9,'board')
        }
      }
      particles.current = advanceDebris(particles.current, dt, l.cell)
      if (webgl) {
        try { webgl.draw(l, blocks, particles.current, blockStyle, theme) }
        catch {
          sceneRef.current = null
          webglCanvasRef.current!.style.visibility = 'hidden'
          setGpuReady(false)
        }
      } else for (const p of particles.current) {
        ctx.save(); ctx.transform(...boardCanvasMatrix(l, p.z)); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.angle)
        ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore()
      }
      flash.current.life=Math.max(0,flash.current.life-dt)
      if(flash.current.life && flash.current.text) {
        ctx.save(); ctx.globalAlpha=Math.min(1,flash.current.life*3); ctx.fillStyle='#fff4bd'; ctx.shadowColor='#ffb72d'; ctx.shadowBlur=20
        ctx.textAlign='center'; ctx.font=`900 ${Math.min(42,l.cell*.9)}px system-ui`
        ctx.fillText(flash.current.text,l.width/2,l.y+l.cell*4-(1-flash.current.life)*40); ctx.restore()
      }
      raf=requestAnimationFrame(draw)
    })
    raf=requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [theme, blockStyle])

  return <div data-paused={session.paused} className="blockblast-root relative h-full min-h-0 w-full overflow-hidden bg-slate-950 text-white" style={{ background: `linear-gradient(140deg, ${THEMES[theme].bg[0]}, ${THEMES[theme].bg[1]})` }}>
    <BlastArtwork colors={THEMES[theme].colors} environment={theme} />
    <canvas ref={webglCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    <BlastBurst colors={THEMES[theme].colors} layout={viewport} burst={burst} />
    <canvas ref={canvasRef} tabIndex={0} role="application" aria-label={t('minigame.blockBlast.controls')}
      className="absolute inset-0 h-full w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300"
      onPointerDown={(e) => {
        if (e.button !== 0 || session.paused || over) return
        e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId)
        const rect=e.currentTarget.getBoundingClientRect(), x=e.clientX-rect.left, y=e.clientY-rect.top, l=layout.current
        pointers.current.set(e.pointerId,{x,y})
        if (pointers.current.size > 1) {
          drag.current=null; orbit.current=null; selected.current=null
          const [a,b]=[...pointers.current.values()]
          pinch.current=Math.hypot(a.x-b.x,a.y-b.y)
          return
        }
        const i=l.slots.findIndex(slot=>Math.abs(x-slot.x)<=slot.width/2 && Math.abs(y-slot.y)<=slot.height/2)
        if (i>=0 && engine.current.pieces[i]) {
          selected.current=i; drag.current={index:i,x,y,moved:false,startX:x,startY:y,touch:e.pointerType==='touch'}
        } else if (x>=l.map.x && x<=l.map.x+l.map.width && y>=l.map.y && y<=l.map.y+l.map.height) {
          orbit.current={startX:x,startY:y,x,y,moved:false}
        } else selected.current=null
      }}
      onPointerMove={(e) => {
        if (session.paused || !pointers.current.has(e.pointerId)) return
        const rect=e.currentTarget.getBoundingClientRect(), x=e.clientX-rect.left, y=e.clientY-rect.top
        pointers.current.set(e.pointerId,{x,y})
        if (pointers.current.size>1) {
          const [a,b]=[...pointers.current.values()]
          const distance=Math.hypot(a.x-b.x,a.y-b.y)
          if (pinch.current>0) changeView({zoom:viewRef.current.zoom*distance/pinch.current})
          pinch.current=distance
          return
        }
        const d=drag.current
        if (d) { d.x=x; d.y=y; d.moved ||= Math.hypot(x-d.startX,y-d.startY)>6; return }
        const g=orbit.current
        if (!g) return
        g.moved ||= Math.hypot(x-g.startX,y-g.startY)>6
        if (g.moved) changeView({yaw:viewRef.current.yaw+(x-g.x)*.008})
        g.x=x; g.y=y
      }}
      onPointerUp={(e) => {
        if (pointers.current.size>1 || pinch.current>0) { cancelGesture(e.pointerId); return }
        const rect=e.currentTarget.getBoundingClientRect(), x=e.clientX-rect.left, y=e.clientY-rect.top
        const d=drag.current, g=orbit.current
        if (d?.moved) { d.x=x; d.y=y; const p=anchor(d); commit(d.index,p.x,p.y) }
        else if (g && !g.moved && selected.current!==null) {
          const l=layout.current, p=screenToBoard(l,x,y)
          commit(selected.current,Math.floor((p.x-l.x)/l.cell),Math.floor((p.y-l.y)/l.cell))
        }
        cancelGesture(e.pointerId)
      }}
      onPointerCancel={(e)=>cancelGesture(e.pointerId)} onLostPointerCapture={(e)=>cancelGesture(e.pointerId)}
      onKeyDown={(e) => {
        if(session.paused || over) return
        if(e.key==='+' || e.key==='=') { e.preventDefault(); changeView({zoom:viewRef.current.zoom+.05}); return }
        if(e.key==='-') { e.preventDefault(); changeView({zoom:viewRef.current.zoom-.05}); return }
        if(e.key==='[' || e.key===']') { e.preventDefault(); changeView({yaw:viewRef.current.yaw+(e.key===']' ? .1 : -.1)}); return }
        if(['1','2','3'].includes(e.key)) { selected.current=Number(e.key)-1; e.preventDefault() }
        const steps: Record<string, number[]> = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}
        if(steps[e.key]) { e.preventDefault(); cursor.current={x:Math.max(0,Math.min(7,cursor.current.x+steps[e.key][0])),y:Math.max(0,Math.min(7,cursor.current.y+steps[e.key][1]))} }
        if((e.key==='Enter' || e.key===' ') && selected.current!==null) { e.preventDefault(); commit(selected.current,cursor.current.x,cursor.current.y) }
      }} />
    <div className="pointer-events-none absolute left-4 top-5 text-xs font-black uppercase tracking-[.18em] sm:text-sm">Block Blast <span className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[8px] tracking-wider text-white/50">{gpuReady ? '3D' : '2D'}</span></div>
    <div className="pointer-events-none absolute text-center font-black tabular-nums drop-shadow-lg left-1/2 top-12 -translate-x-1/2 text-3xl sm:top-3 sm:text-5xl" aria-label={t('minigame.score')}>{score}</div>
    <div className="pointer-events-none absolute right-14 top-2 sm:top-3 flex items-center gap-1 sm:gap-2 rounded-2xl border border-amber-100/20 bg-slate-950/35 px-2 py-1 sm:px-3 sm:py-2 text-amber-100 backdrop-blur-md">
      <Trophy className="h-4 w-4 text-amber-300 sm:h-5 sm:w-5" /><div className="text-right leading-tight"><div className="text-[9px] uppercase tracking-widest">{t('minigame.best')}</div><div className="text-base sm:text-xl font-black tabular-nums">{highScore}</div></div>
    </div>
    <Popover>
      <PopoverTrigger asChild><Button variant="secondary" size="icon" aria-label={t('minigame.blockBlast.theme')} className="absolute bottom-3 left-3 h-11 w-11 rounded-full border border-white/20 bg-slate-950/70"><Palette className="h-5 w-5" /></Button></PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(90vw,480px)] max-h-[60dvh] space-y-4 rounded-2xl p-4">
        <div><p className="mb-2 text-sm font-semibold">{t('minigame.blockBlast.blockStyle')}</p>
          <div className="grid grid-cols-3 gap-2">{BLOCK_STYLES.map((style,i)=><button key={style.id} type="button" aria-pressed={blockStyle===i} onClick={()=>setBlockStyle(i)} className="flex min-h-20 flex-col items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-2 text-xs aria-pressed:border-sky-300 aria-pressed:bg-sky-300/15">
            <span aria-hidden="true" className={`blast-style-preview blast-style-${style.id}`} style={{background:THEMES[theme].colors[i%7]}} />
            {t(`minigame.blockBlast.styles.${style.id}`)}
          </button>)}</div>
        </div>
        <div><p className="mb-2 text-sm font-semibold">{t('minigame.blockBlast.environment')}</p>
          <div className="grid grid-cols-3 gap-2">{THEMES.map((environment,i)=><button key={environment.id} type="button" aria-pressed={theme===i} onClick={()=>setTheme(i)} className="flex min-h-20 flex-col justify-end rounded-xl border border-white/20 p-2 text-xs font-medium shadow-inner aria-pressed:border-sky-300 aria-pressed:ring-1 aria-pressed:ring-sky-300" style={{background:`linear-gradient(140deg,${environment.bg[0]},${environment.bg[1]})`}}>
            <span className="mb-2 text-xl" aria-hidden="true">{['✦','〰','◉','☀','♠','❄'][i]}</span>{t(`minigame.blockBlast.environments.${environment.id}`)}
          </button>)}</div>
        </div>
      </PopoverContent>
    </Popover>
    <div role="group" aria-label={t('minigame.blockBlast.view')} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-slate-950/75 p-1 backdrop-blur-md">
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={t('minigame.blockBlast.zoomOut')} disabled={view.zoom<=.6} onClick={()=>changeView({zoom:view.zoom-.1})}><Minus className="h-4 w-4" /></Button>
      <Button variant="ghost" className="h-10 gap-1 rounded-full px-2 text-xs tabular-nums" aria-label={t('minigame.blockBlast.resetView')} title={t('minigame.blockBlast.resetView')} onClick={()=>changeView(DEFAULT_VIEW)}><RotateCcw className="h-3.5 w-3.5" />{Math.round(view.zoom*100)}%</Button>
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={t('minigame.blockBlast.zoomIn')} disabled={view.zoom>=1} onClick={()=>changeView({zoom:view.zoom+.1})}><Plus className="h-4 w-4" /></Button>
    </div>
    <p className="pointer-events-none absolute inset-x-4 bottom-16 text-center text-[10px] text-white/65 sm:text-xs">{t('minigame.blockBlast.viewHint')}</p>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    {over && <div className="absolute inset-0 flex items-center justify-center overflow-auto bg-slate-950/65 p-4 backdrop-blur-sm"><div className="m-auto flex max-w-sm flex-col items-center gap-5 rounded-3xl border border-white/20 bg-slate-900/90 p-8 text-center shadow-2xl"><Trophy className="h-10 w-10 text-amber-300" /><h3 className="text-2xl font-black">{t('minigame.gameOver')}</h3><p className="text-5xl font-black">{score}</p><Button onClick={restart} className="h-12 rounded-xl px-8"><RotateCcw className="h-4 w-4" />{t('minigame.playAgain')}</Button></div></div>}
  </div>
}
