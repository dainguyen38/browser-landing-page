import { useEffect, useRef, useState } from 'react'
import { useElementSize } from '@/hooks/useElementSize'
import { useT } from '@/i18n/useT'
import { DEFAULT_ROSTER, fighterLook } from '@/lib/boxing/characters'
import { boxingPose, fighterX } from '@/lib/boxing/pose'
import type { BoxingState, FightEvent } from '@/lib/boxing/game'
import type { createBoxingScene } from '@/lib/boxing/scene'

type Props={state:BoxingState;event:FightEvent|null;eventAt:number;reducedMotion:boolean;roster?:[string,string];paused?:boolean}
export function BoxingArena({state,event,eventAt,reducedMotion,roster=DEFAULT_ROSTER,paused=false}:Props) {
  const {t}=useT(),{ref,size}=useElementSize<HTMLDivElement>(),canvas=useRef<HTMLCanvasElement>(null)
  const scene=useRef<ReturnType<typeof createBoxingScene>|null>(null)
  const [ready,setReady]=useState(false),[fallback,setFallback]=useState(false)
  const previewTime=useRef(0)
  const latest=useRef({state,event,eventAt,reducedMotion,roster,motionTime:state.time})
  latest.current={state,event,eventAt,reducedMotion,roster,motionTime:state.phase==='ready'?previewTime.current:state.time}
  const enabled=size.width>0&&size.height>0
  useEffect(()=>{
    if(!enabled)return
    setReady(false)
    let cancelled=false
    const fail=()=>{if(!cancelled){setReady(false);setFallback(true);scene.current?.dispose();scene.current=null}}
    const element=canvas.current!
    const lost=(e:Event)=>{e.preventDefault();fail()}
    element.addEventListener('webglcontextlost',lost)
    import('@/lib/boxing/scene').then(({createBoxingScene})=>{
      if(cancelled)return
      try {
        scene.current=createBoxingScene(element,()=>{if(!cancelled)setReady(true)},fail)
        const parent=element.parentElement!
        scene.current.resize(parent.clientWidth,parent.clientHeight);scene.current.render(latest.current)
      } catch {fail()}
    }).catch(fail)
    return()=>{cancelled=true;element.removeEventListener('webglcontextlost',lost);scene.current?.dispose();scene.current=null}
  },[enabled])
  useEffect(()=>{scene.current?.resize(size.width,size.height);scene.current?.render(latest.current)},[size.width,size.height,state,state.time,event,eventAt,roster,reducedMotion])
  useEffect(()=>{
    if(!ready||!enabled||paused||reducedMotion||state.phase!=='ready')return
    let raf=0,last=performance.now(),paint=last
    const frame=(now:number)=>{
      const delta=Math.min(.05,(now-last)/1000);last=now
      if(!document.hidden){
        previewTime.current+=delta
        if(now-paint>=1000/30){scene.current?.render({...latest.current,motionTime:previewTime.current});paint=now}
      }
      raf=requestAnimationFrame(frame)
    }
    raf=requestAnimationFrame(frame)
    return()=>cancelAnimationFrame(raf)
  },[ready,enabled,paused,reducedMotion,state.phase])
  const recent=event&&state.time-eventAt>=0&&state.time-eventAt<.4
  const impact=recent&&['hit','block','ko'].includes(event.kind)
  const target=event?.player===0?1:0
  return <div ref={ref} className="ringside-arena ringside-arena-3d" role="img" aria-label={t('minigame.boxing.arena')}>
    {!ready&&<div className="ringside-flat-arena" aria-hidden="true">
      <div className="ringside-flat-mat">RINGSIDE</div><div className="ringside-flat-ropes"/>
      {[0,1].map(i=>{
        const p=boxingPose(state.fighters[i],state.time,150,reducedMotion)
        return <img key={i} src={`/assets/boxing/${fighterLook(roster[i]).id}.png`} alt="" draggable={false} className={`ringside-flat-fighter ${!reducedMotion&&['ready','fight'].includes(state.phase)?'is-alive':''}`} style={{left:`${50+(fighterX(state.fighters[i],state.time)-.5)*85}%`,animationDelay:`-${i*.31}s,-${i*.9}s`,animationPlayState:paused||!enabled?'paused':'running',transform:`translateX(-50%) scaleX(${i===0?1:-1}) translateX(${p.lean}px) rotate(${state.over&&state.winner===1-i?-65:0}deg)`}}/>
      })}
    </div>}
    <canvas ref={canvas} aria-hidden="true" className={ready?'is-ready':''}/>
    {impact&&<div key={`${eventAt}-${event.kind}`} className={`ringside-hit-label ${event.counter?'is-counter':''}`} style={{left:target===0?'36%':'64%'}}>
      <strong>{event.kind==='ko'?'KO':event.counter?'COUNTER':`−${event.damage}`}</strong>
      {event.counter&&<small>−{event.damage}</small>}
    </div>}
    {!ready&&<span className="ringside-render-status">{t(fallback?'minigame.boxing.fallback':'minigame.boxing.loading')}</span>}
  </div>
}
