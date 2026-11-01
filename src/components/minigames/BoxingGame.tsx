import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Flame, Swords, Target, Trophy, Users, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/useT'
import { useMinigameStore } from '@/store/minigame'
import { createBoxingAudio } from '@/lib/boxing/audio'
import { DEFAULT_ROSTER, FIGHTERS, fighterLook } from '@/lib/boxing/characters'
import { ACTIONS, KEYS, MODES, MOVES, MAX_HP, DEFENSE_COOLDOWNS, input, applyHeldMovement, canInput, initial, nextRound, start, update, type Action, type BoxingState, type FightEvent, type Mode, type Movement, type Punch } from '@/lib/boxing/game'
import { useGameRef, useGameSession, useGameState } from './GameSession'
import { BoxingArena } from './BoxingArena'
import { BoxingGlyph } from './BoxingGlyph'

export function BoxingGame() {
  const session=useGameSession(), {t}=useT()
  const engine=useGameRef<BoxingState>('engine',initial)
  const held=useRef(new Map<string,readonly [number,Movement]>())
  const [score,setScore]=useGameState('score',0), [over,setOver]=useGameState('over',false), [,setRunning]=useGameState('running',false)
  const [mode,setMode]=useGameState<Mode>('mode','spar'), [difficulty,setDifficulty]=useGameState('difficulty',1), [muted,setMuted]=useGameState('muted',false)
  const [roster,setRoster]=useGameState<[string,string]>('roster',()=>[...DEFAULT_ROSTER])
  const [selecting,setSelecting]=useState<0|1|null>(null)
  const lastSelected=useRef(0)
  if(selecting!==null)lastSelected.current=selecting
  const [,redraw]=useState(0), [lastEvent,setLastEvent]=useState<FightEvent|null>(null)
  const eventAt=useRef(0), audio=useRef<ReturnType<typeof createBoxingAudio>|null>(null)
  if(!audio.current) audio.current=createBoxingAudio()
  const high=useMinigameStore(s=>s.highScores.boxing), record=useMinigameStore(s=>s.recordScore)
  const [reducedMotion,setReducedMotion]=useState(false)
  const state=engine.current
  const [announcement,setAnnouncement]=useState('')
  const sync=useCallback(()=>{
    const st=engine.current
    setScore(st.score); setOver(st.over); setRunning(st.phase==='fight')
    redraw(v=>v+1)
  },[engine,setScore,setOver,setRunning])
  const dispatch=useCallback((player:number,action:Action)=>{
    if(session.paused || (player===1 && engine.current.mode!=='versus')) return
    audio.current?.unlock()
    session.guard(()=>{if(input(engine.current,player,action)) redraw(v=>v+1)})
  },[engine,session])
  const releaseMovement=useCallback((source:string)=>{
    const binding=held.current.get(source);held.current.delete(source)
    if(binding&&engine.current.fighters[binding[0]].queued?.action===binding[1])engine.current.fighters[binding[0]].queued=null
  },[engine])
  const clearMovement=useCallback(()=>{
    held.current.clear()
    for(const f of engine.current.fighters)if(f.queued?.action==='advance'||f.queued?.action==='retreat')f.queued=null
  },[engine])
  const holdMovement=useCallback((source:string,player:number,action:Movement)=>{
    if(session.paused||!session.visible||engine.current.phase!=='fight'||held.current.has(source))return
    held.current.set(source,[player,action]);dispatch(player,action)
  },[dispatch,engine,session])
  const begin=()=>{
    clearMovement()
    audio.current?.unlock()
    engine.current=initial(mode,difficulty); start(engine.current)
    audio.current?.play({kind:'bell',player:0,damage:0}); setLastEvent(null); sync()
  }
  const continueFight=()=>{clearMovement();audio.current?.unlock(); nextRound(engine.current); audio.current?.play({kind:'bell',player:0,damage:0}); sync()}
  const menu=()=>{clearMovement();engine.current=initial(mode,difficulty); setLastEvent(null); sync()}

  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>setReducedMotion(media.matches)
    media.addEventListener('change',change); change()
    return()=>media.removeEventListener('change',change)
  },[])
  useEffect(()=>{audio.current?.setMuted(muted)},[muted])
  useEffect(()=>{
    if(session.paused) audio.current?.suspend()
    else if(engine.current.phase==='fight') audio.current?.unlock()
  },[session.paused,engine])
  useEffect(()=>()=>audio.current?.dispose(),[])
  useEffect(()=>{if(session.paused||!session.visible||state.phase!=='fight'||selecting!==null)clearMovement()},[session.paused,session.visible,state.phase,selecting,clearMovement])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null
      if(session.paused || !session.visible || selecting!==null || e.ctrlKey || e.metaKey || e.altKey || target?.closest('input,textarea,select,[role=combobox],[contenteditable=true]')) return
      const binding=KEYS[e.key]??KEYS[e.key.toLowerCase()]
      if(!binding || (e.repeat && binding[1]!=='advance' && binding[1]!=='retreat')) return
      if(binding[0]===1 && engine.current.mode!=='versus') return
      e.preventDefault()
      if(binding[1]==='advance'||binding[1]==='retreat')holdMovement(`key:${e.code||e.key.toLowerCase()}`,binding[0],binding[1])
      else dispatch(...binding as [number,Action])
    }
    const up=(e:KeyboardEvent)=>releaseMovement(`key:${e.code||e.key.toLowerCase()}`)
    const hidden=()=>{if(document.hidden)clearMovement()}
    window.addEventListener('keydown',key)
    window.addEventListener('keyup',up);window.addEventListener('blur',clearMovement);document.addEventListener('visibilitychange',hidden)
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearMovement);document.removeEventListener('visibilitychange',hidden);clearMovement()}
  },[dispatch,engine,session,selecting,holdMovement,releaseMovement,clearMovement])
  useEffect(()=>{
    let raf=0,last=performance.now(),accumulated=0,lastPaint=0
    const frame=(now:number)=>session.guard(()=>{
      const delta=Math.min(.1,(now-last)/1000); last=now
      if(session.paused || document.hidden || engine.current.phase!=='fight') {accumulated=0; raf=requestAnimationFrame(frame); return}
      accumulated+=delta
      const events:FightEvent[]=[]
      while(accumulated>=1/60) {applyHeldMovement(engine.current,held.current.values());events.push(...update(engine.current,1/60)); accumulated-=1/60}
      const st=engine.current
      for(const event of events) audio.current?.play(event)
      if(events.length) {
        const impacts=events.filter(e=>['hit','block','dodge','miss','ko','win'].includes(e.kind))
        const visible=impacts.filter(e=>e.kind!=='miss').slice(-1)[0]??impacts.slice(-1)[0]
        if(visible) {setLastEvent(visible); eventAt.current=st.time}
      }
      if(st.score!==session.snapshot.state.score) {setScore(st.score); record('boxing',st.score)}
      if(st.over || st.phase==='break') {
        setOver(st.over); setRunning(false)
        setAnnouncement(st.winner===null?t('minigame.boxing.draw'):t('minigame.boxing.winner').replace('{player}',st.winner===0?'P1':st.mode==='versus'?'P2':`CPU ${st.wave}`))
        redraw(v=>v+1)
      } else if(now-lastPaint>(reducedMotion?32:15)) {redraw(v=>v+1); lastPaint=now}
      raf=requestAnimationFrame(frame)
    })
    raf=requestAnimationFrame(frame)
    return()=>cancelAnimationFrame(raf)
  },[engine,record,session,setScore,setOver,setRunning,t,reducedMotion,roster])

  const playerName=(player:number)=>`${player===0?'P1':state.mode==='versus'?'P2':state.mode==='training'?t('minigame.boxing.dummy'):`CPU ${state.wave}`} · ${fighterLook(roster[player]).name}`
  const modeIcons={spar:Swords,arcade:Trophy,survival:Flame,training:Target,versus:Users}
  const controls=(player:number)=><section className={`ringside-controls ${player===0?'blue-corner':'red-corner'}`} aria-label={playerName(player)}>
    <div className="ringside-control-heading"><span><i/>{playerName(player)}</span><span>{state.fighters[player].queued?t('minigame.boxing.queued'):state.fighters[player].chain>1?`COMBO ×${state.fighters[player].chain}`:t('minigame.boxing.yourCorner')}</span></div>
    <div className="ringside-actions">
      {ACTIONS.map(action=>{
        const f=state.fighters[player],available=canInput(state,player,action),queued=f.queued?.action===action
        const remaining=Math.max(0,(f.cooldowns[action]??0)-state.time)
        const cooldown=action==='guard'||action==='dodge'?DEFENSE_COOLDOWNS[action]:MOVES[action].cooldown
        const binding=Object.entries(KEYS).find(([,b])=>b[0]===player&&b[1]===action)?.[0]??''
        const category=action==='guard'||action==='dodge'?'defense':action==='special'?'ultimate':['power','flurry'].includes(action)?'heavy':'attack'
        return <button key={action} type="button" disabled={!available} onPointerDown={e=>{if(e.button===0){e.preventDefault();dispatch(player,action)}}} onClick={e=>{if(e.detail===0)dispatch(player,action)}}
          aria-label={`${playerName(player)} · ${t(`minigame.boxing.moves.${action}`)}`} title={binding.toUpperCase()}
          className={`ringside-action ${category} ${queued?'is-queued':''}`}>
          <kbd>{binding.toUpperCase()}</kbd><BoxingGlyph move={action}/>
          <strong>{t(`minigame.boxing.moves.${action}`)}</strong>
          <small>{queued?t('minigame.boxing.queued'):remaining>0?`${remaining.toFixed(1)}s`:action==='special'?`${Math.floor(f.meter)}%`:' '}</small>
          {remaining>0&&<span className="ringside-cooldown" style={{width:`${Math.min(1,remaining/cooldown)*100}%`}}/>}
        </button>
      })}
    </div>
    <div className="ringside-footwork">
      {(['retreat','advance'] as const).map(action=><button key={action} type="button" disabled={state.phase!=='fight'||session.paused}
        onPointerDown={e=>{if(e.button===0){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);holdMovement(`pointer:${e.pointerId}`,player,action)}}}
        onPointerUp={e=>releaseMovement(`pointer:${e.pointerId}`)} onPointerCancel={e=>releaseMovement(`pointer:${e.pointerId}`)} onLostPointerCapture={e=>releaseMovement(`pointer:${e.pointerId}`)}
        onClick={e=>{if(e.detail===0)dispatch(player,action)}}>
        {action==='retreat'&&(player===0?<ArrowLeft/>:<ArrowRight/>)}{t(`minigame.boxing.${action}`)}{action==='advance'&&(player===0?<ArrowRight/>:<ArrowLeft/>)}
      </button>)}
      <span>{Math.abs(state.fighters[0].x-state.fighters[1].x)<=.31?t('minigame.boxing.inRange'):t('minigame.boxing.outRange')}</span>
    </div>
  </section>

  return <div className="ringside-game">
    <header className="ringside-header">
      <div className="ringside-brand"><b>RS</b><div><strong>RINGSIDE</strong><small>{t(`minigame.boxing.modes.${mode}`)}</small></div></div>
      <div className="ringside-header-stats"><span><small>{t('minigame.score')}</small><b>{score.toLocaleString()}</b></span><span className="ringside-record"><Trophy/><b>{high.toLocaleString()}</b></span>
        {state.phase!=='ready'&&<button type="button" className="ringside-menu" onClick={menu}>{t('minigame.boxing.changeMode')}</button>}
        <Button variant="ghost" size="icon" aria-label={t(muted?'minigame.boxing.unmute':'minigame.boxing.mute')} onClick={()=>{audio.current?.unlock();setMuted(!muted)}}>{muted?<VolumeX/>:<Volume2/>}</Button>
      </div>
    </header>
    {state.phase==='ready'?<div className="ringside-lobby">
      <div className="ringside-poster">
        <div className="ringside-poster-label">FIGHT NIGHT / VOL. 01</div>
        <div className="ringside-poster-title">RING<span>SIDE.</span></div>
        <div className="ringside-poster-arena"><BoxingArena state={state} event={null} eventAt={0} reducedMotion={reducedMotion} roster={roster} paused={session.paused||!session.visible}/></div>
        <div className="ringside-poster-footer"><span>{fighterLook(roster[0]).name.toUpperCase()}</span><b>VS</b><span>{fighterLook(roster[1]).name.toUpperCase()}</span></div>
      </div>
      <div className="ringside-fight-card">
        <div className="ringside-eyebrow">THE FIGHT CARD</div><h2>{t('minigame.boxing.chooseFight')}</h2>
        <div className="ringside-corner-select">{([0,1] as const).map(player=>{
          const look=fighterLook(roster[player])
          return <button key={player} type="button" onClick={()=>setSelecting(player)} aria-label={`${t('minigame.boxing.chooseFighter')} · ${player===0?'P1':mode==='versus'?'P2':'CPU'}`} style={{'--fighter-accent':look.glove} as CSSProperties}>
            <img src={`/assets/boxing/${look.id}-portrait.png`} alt=""/><span><small>{player===0?'P1':mode==='versus'?'P2':'CPU'}</small><strong>{look.name}</strong><em>{t('minigame.boxing.chooseFighter')}</em></span><ArrowRight/>
          </button>
        })}</div>
        <div className="ringside-modes">{MODES.map((value,i)=>{
          const Icon=modeIcons[value]
          return <button type="button" key={value} aria-pressed={mode===value} onClick={()=>{setMode(value);engine.current=initial(value,difficulty);sync()}} className="ringside-mode">
            <span className="ringside-mode-number">0{i+1}</span><Icon/><div><strong>{t(`minigame.boxing.modes.${value}`)}</strong><small>{t(`minigame.boxing.modeHints.${value}`)}</small></div><ArrowRight/>
          </button>
        })}</div>
        {mode!=='versus'&&mode!=='training'&&<div className="ringside-difficulty">{[0,1,2].map(level=><button type="button" key={level} aria-pressed={difficulty===level} onClick={()=>{setDifficulty(level);engine.current=initial(mode,level);sync()}}>{t(['minigame.diffEasy','minigame.diffMedium','minigame.diffHard'][level])}</button>)}</div>}
        <button type="button" className="ringside-start" onClick={begin}>{t('minigame.boxing.enterRing')}<ArrowRight/></button>
      </div>
    </div>:<>
      <div className="ringside-scoreboard">
        {[0,1].map(player=><div key={player} className={`ringside-fighter-hud ${player===0?'blue-corner':'red-corner'}`}>
          <div className="ringside-fighter-name"><span>{playerName(player)}<small>{player===0?t('minigame.boxing.contender'):t(`minigame.boxing.rivals.${state.mode==='training'?'dummy':state.mode==='versus'?'challenger':['boxer','brawler','counter'][(state.wave-1)%3]}`)}</small></span><b>{Math.ceil(state.fighters[player].hp)}</b></div>
          <div role="meter" aria-label={`${playerName(player)} HP`} aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={state.fighters[player].hp} className={`ringside-health ${state.fighters[player].hp<MAX_HP*.25?'danger':''}`}><span style={{width:`${state.fighters[player].hp/MAX_HP*100}%`}}/></div>
          <div className="ringside-energy"><span style={{width:`${state.fighters[player].stamina}%`}}/></div>
          <div className="ringside-fighter-meta"><span>⚡ {Math.floor(state.fighters[player].stamina)}</span><span className={state.fighters[player].meter>=100?'is-charged':''}>{t('minigame.boxing.focus')} {Math.floor(state.fighters[player].meter)}%</span><span>{'●'.repeat(state.wins[player])}</span></div>
        </div>)}
        <div className="ringside-clock"><small>{state.mode==='arcade'||state.mode==='survival'?`BOUT ${state.wave}`:`ROUND ${state.round}/3`}</small><strong>{state.mode==='training'?'∞':String(Math.ceil(state.left)).padStart(2,'0')}</strong></div>
      </div>
      <div className={`ringside-play ${state.mode==='versus'?'is-versus':''}`}>
        <div className="ringside-stage"><BoxingArena state={state} event={lastEvent} eventAt={eventAt.current} reducedMotion={reducedMotion} roster={roster} paused={session.paused||!session.visible}/>
          {lastEvent&&state.time-eventAt.current<.45&&['miss','block','dodge'].includes(lastEvent.kind)&&<div className="ringside-feedback" role="status">{t(`minigame.boxing.feedback.${lastEvent.kind}`)}</div>}
          {(state.phase==='break'||over)&&<div className="ringside-result"><div>
            <small>{over?'FINAL DECISION':'BETWEEN ROUNDS'}</small><h2>{state.winner===null?t('minigame.boxing.draw'):t('minigame.boxing.winner').replace('{player}',playerName(state.winner))}</h2>
            <p>{state.winner===0?`${score.toLocaleString()} ${t('minigame.score')}`:t(over?'minigame.gameOver':'minigame.boxing.break')}</p>
            <button type="button" className="ringside-start" onClick={over?begin:continueFight}>{t(over?'minigame.playAgain':'minigame.next')}<ArrowRight/></button><button type="button" className="ringside-menu" onClick={menu}>{t('minigame.boxing.changeMode')}</button>
          </div></div>}
        </div>
        <div className="ringside-dock">{controls(0)}{state.mode==='versus'&&controls(1)}</div>
      </div>
    </>}
    <Dialog open={selecting!==null} onOpenChange={open=>{if(!open)setSelecting(null)}}>
      <DialogContent className="ringside-roster-dialog" onCloseAutoFocus={event=>{event.preventDefault();document.querySelector<HTMLButtonElement>(`.ringside-corner-select>button:nth-child(${lastSelected.current+1})`)?.focus()}}>
        <DialogHeader><DialogTitle>{t('minigame.boxing.chooseFighter')}</DialogTitle><DialogDescription>{t('minigame.boxing.rosterHint')}</DialogDescription></DialogHeader>
        <div className="ringside-roster-tabs">{([0,1] as const).map(player=><button type="button" key={player} aria-pressed={selecting===player} onClick={()=>setSelecting(player)}>{player===0?'P1':mode==='versus'?'P2':'CPU'} <strong>{fighterLook(roster[player]).name}</strong></button>)}</div>
        <div className="ringside-roster-body">
          <div className="ringside-roster-preview" style={{'--fighter-accent':fighterLook(roster[selecting??0]).glove} as CSSProperties}><img src={`/assets/boxing/${fighterLook(roster[selecting??0]).id}.png`} alt=""/><strong>{fighterLook(roster[selecting??0]).name}</strong></div>
          <div className="ringside-roster-grid">{FIGHTERS.map(look=><button type="button" key={look.id} aria-pressed={roster[selecting??0]===look.id} style={{'--fighter-accent':look.glove} as CSSProperties} onClick={()=>setRoster(current=>{const next:[string,string]=[...current];next[selecting??0]=look.id;return next})}>
            <img src={`/assets/boxing/${look.id}-portrait.png`} alt=""/><strong>{look.name}</strong><span style={{background:look.glove}}/>
          </button>)}</div>
        </div>
        <button type="button" className="ringside-start" onClick={()=>setSelecting(null)}>{t('minigame.boxing.ready')}<ArrowRight/></button>
      </DialogContent>
    </Dialog>
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </div>
}
