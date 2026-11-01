export const MODES = ['spar','arcade','survival','training','versus'] as const
export type Mode = typeof MODES[number]
export const MAX_HP = 1000
export const DEFENSE_COOLDOWNS = {guard:.55,dodge:.65} as const
export const MOVES = {
  jab: { damage:6, cost:4, windup:.12, recovery:.12, range:.31, cooldown:.24 },
  cross: { damage:10, cost:7, windup:.22, recovery:.14, range:.3, cooldown:.36 },
  hook: { damage:15, cost:10, windup:.3, recovery:.16, range:.26, cooldown:.46 },
  uppercut: { damage:18, cost:12, windup:.34, recovery:.18, range:.23, cooldown:.52 },
  body: { damage:8, cost:8, windup:.2, recovery:.13, range:.28, cooldown:.33 },
  power: { damage:25, cost:18, windup:.48, recovery:.2, range:.29, cooldown:.68 },
  flurry: { damage:7, cost:17, windup:.12, recovery:.38, range:.29, cooldown:.5 },
  special: { damage:34, cost:14, windup:.4, recovery:.22, range:.34, cooldown:.62 },
} as const
export type Punch = keyof typeof MOVES
export type Action = Punch | 'guard' | 'dodge' | 'advance' | 'retreat'
export type Movement = 'advance' | 'retreat'
export const ACTIONS = ['jab','cross','guard','dodge','hook','uppercut','body','power','flurry','special'] as const
export const KEYS: Record<string, [number,Action]> = {
  a:[0,'retreat'],d:[0,'advance'],q:[0,'jab'],w:[0,'cross'],e:[0,'hook'],r:[0,'uppercut'],t:[0,'body'],y:[0,'power'],f:[0,'flurry'],g:[0,'special'],s:[0,'guard'],x:[0,'dodge'],
  ArrowLeft:[1,'advance'],ArrowRight:[1,'retreat'],u:[1,'jab'],i:[1,'cross'],o:[1,'hook'],p:[1,'uppercut'],'[':[1,'body'],']':[1,'power'],l:[1,'flurry'],';':[1,'special'],k:[1,'guard'],j:[1,'dodge'],
}
export type Fighter = {
  hp:number; stamina:number; meter:number; x:number; guardUntil:number; dodgeUntil:number; counterUntil:number
  busyUntil:number; stunUntil:number; move:Action | 'idle'; moveAt:number; moveUntil:number; hurtAt:number
  lastPunch:Punch | null; lastPunchAt:number; chain:number; repeats:number; damage:number
  queued?:{action:Action;expires:number}|null; soundPending?:boolean; fromX?:number; stepAt?:number; stepVelocity?:number
  hurtMove?:Punch; hurtPower?:number
  cooldowns:Record<string,number>; pending:{at:number; punch:Punch}[]
}
export const STEP_TIME=.18
export function fighterMotion(f:Fighter,time:number) {
  if(f.fromX===undefined||f.stepAt===undefined)return {x:f.x,velocity:0}
  const t=Math.max(0,Math.min(1,(time-f.stepAt)/STEP_TIME)),distance=f.x-f.fromX
  const tangent=distance===0?0:Math.max(0,Math.min(3,(f.stepVelocity??0)*STEP_TIME/distance))
  const progress=(-2*t*t*t+3*t*t)+(t*t*t-2*t*t+t)*tangent
  return {x:f.fromX+distance*progress,velocity:t>=1?0:distance*((-6*t*t+6*t)+(3*t*t-4*t+1)*tangent)/STEP_TIME}
}
export type FightEvent = { kind:'hit'|'block'|'dodge'|'miss'|'bell'|'ko'|'win'|'swing'|'guard'|'slip'|'step'; player:number; move?:Punch; damage:number; counter?:boolean }
export type BoxingState = {
  mode:Mode; difficulty:number; phase:'ready'|'fight'|'break'|'over'; fighters:[Fighter,Fighter]
  time:number; left:number; round:number; wins:[number,number]; roundDamage:[number,number]
  wave:number; aiAt:number; score:number; over:boolean; winner:number | null
}
function fighter(x:number):Fighter {
  return { hp:MAX_HP,stamina:100,meter:0,x,guardUntil:0,dodgeUntil:0,counterUntil:0,busyUntil:0,stunUntil:0,
    move:'idle',moveAt:0,moveUntil:0,hurtAt:-10,lastPunch:null,lastPunchAt:-10,chain:0,repeats:0,damage:0,cooldowns:{},pending:[] }
}
export function initial(mode:Mode='spar',difficulty=1):BoxingState {
  return {mode,difficulty,phase:'ready',fighters:[fighter(.37),fighter(.63)],time:0,left:45,round:1,wins:[0,0],roundDamage:[0,0],wave:1,aiAt:.7,score:0,over:false,winner:null}
}
export function start(st:BoxingState) { if(st.phase==='ready') st.phase='fight' }
export function nextRound(st:BoxingState) {
  if(st.phase!=='break') return
  if(st.mode==='arcade' || st.mode==='survival') {
    st.wave++; st.round=1; st.wins=[0,0]
    st.fighters[0].hp=Math.min(MAX_HP,st.fighters[0].hp+300)
    st.fighters[1]=fighter(.63)
  } else { st.round++; for(const f of st.fighters) f.hp=Math.min(MAX_HP,f.hp+160) }
  for(const [i,f] of st.fighters.entries()) {
    delete f.fromX; delete f.stepAt; delete f.stepVelocity; delete f.hurtMove; delete f.hurtPower
    f.x=i ? .63 : .37; f.stamina=100; f.busyUntil=st.time; f.stunUntil=st.time
    f.pending=[]; f.guardUntil=0; f.dodgeUntil=0; f.counterUntil=0; f.cooldowns={}; f.move='idle'
    f.queued=null; f.soundPending=false; f.fromX=f.x; f.stepAt=st.time-1
    f.hurtAt=st.time-1; f.lastPunchAt=st.time-10; f.chain=0; f.repeats=0
  }
  st.left=45; st.phase='fight'; st.winner=null; st.roundDamage=[0,0]; st.aiAt=st.time+.8
}
export function canAct(st:BoxingState,player:number,action:Action) {
  const f=st.fighters[player]
  if(!f || st.phase!=='fight' || st.over || st.time<f.stunUntil || st.time<(f.cooldowns[action]??0)) return false
  if(action==='advance' || action==='retreat') return st.time>=f.busyUntil
  if(st.time<f.busyUntil) return false
  if(action==='guard') return f.stamina>=7
  if(action==='dodge') return f.stamina>=13
  return f.stamina>=MOVES[action].cost && (action!=='special' || f.meter>=100)
}
export function act(st:BoxingState,player:number,action:Action) {
  if(!canAct(st,player,action)) return false
  const f=st.fighters[player],other=st.fighters[1-player]
  f.move=action; f.moveAt=st.time; f.soundPending=true; f.queued=null
  if(action==='advance' || action==='retreat') {
    const direction=player===0 ? 1 : -1
    const motion=fighterMotion(f,st.time)
    f.fromX=motion.x; f.stepVelocity=motion.velocity; f.stepAt=st.time
    const target=f.x+direction*(action==='advance' ? .055 : -.07)
    f.x=player===0 ? Math.max(.16,Math.min(other.x-.17,target)) : Math.min(.84,Math.max(other.x+.17,target))
    f.cooldowns[action]=st.time+.13; f.moveUntil=st.time+.15
  } else if(action==='guard') {
    f.stamina-=7; f.guardUntil=st.time+.75; f.busyUntil=st.time+.13; f.cooldowns.guard=st.time+DEFENSE_COOLDOWNS.guard; f.moveUntil=f.guardUntil
  } else if(action==='dodge') {
    f.stamina-=13; f.dodgeUntil=st.time+.4; f.busyUntil=st.time+.16; f.cooldowns.dodge=st.time+DEFENSE_COOLDOWNS.dodge; f.moveUntil=f.dodgeUntil
  } else {
    const move=MOVES[action]
    const gap=Math.abs(f.x-other.x)
    if(gap>move.range && gap<move.range+.07) {
      const motion=fighterMotion(f,st.time)
      f.fromX=motion.x; f.stepVelocity=motion.velocity; f.stepAt=st.time
      f.x+=(player===0?1:-1)*(gap-move.range+.005)
    }
    f.stamina-=move.cost; f.guardUntil=0; f.dodgeUntil=0
    if(action==='special') f.meter=0
    f.repeats=f.lastPunch===action ? f.repeats+1 : 0
    f.chain=st.time-f.lastPunchAt<1.4 && f.lastPunch!==action ? Math.min(5,f.chain+1) : 1
    f.lastPunch=action; f.lastPunchAt=st.time
    f.busyUntil=st.time+move.windup+move.recovery; f.moveUntil=f.busyUntil
    f.cooldowns[action]=st.time+move.cooldown
    for(let i=0;i<(action==='flurry' ? 3 : 1);i++) f.pending.push({at:st.time+move.windup+i*.13,punch:action})
  }
  return true
}
export function canInput(st:BoxingState,player:number,action:Action) {
  const f=st.fighters[player]
  if(!f || st.phase!=='fight' || st.over || st.time<(f.cooldowns[action]??0)) return false
  const cost=action==='guard'?7:action==='dodge'?13:action==='advance'||action==='retreat'?0:MOVES[action].cost
  return f.stamina>=cost && (action!=='special'||f.meter>=100)
}
export function input(st:BoxingState,player:number,action:Action) {
  if(!canInput(st,player,action)) return false
  const f=st.fighters[player]
  if((action==='guard'||action==='dodge') && !f.pending.length && st.time>=f.stunUntil) f.busyUntil=st.time
  if(act(st,player,action)) return true
  f.queued={action,expires:Math.max(st.time,f.busyUntil,f.stunUntil)+.2}
  return true
}
export function applyHeldMovement(st:BoxingState,held:Iterable<readonly [number,Movement]>) {
  const latest=new Map<number,Movement>()
  for(const [player,action] of held)if(player===0||player===1&&st.mode==='versus')latest.set(player,action)
  for(const [player,action] of latest)if(!st.fighters[player].queued)act(st,player,action)
}
function endRound(st:BoxingState,winner:number|null,ko:boolean,events:FightEvent[]) {
  st.winner=winner
  for(const f of st.fighters) {f.pending=[];f.queued=null;f.soundPending=false}
  if(st.mode==='training') return
  if(winner!==null) st.wins[winner]++
  if((st.mode==='arcade' || st.mode==='survival') && winner===0 && (st.mode==='survival' || st.wave<3)) {
    st.score+=200+st.wave*50; st.phase='break'; events.push({kind:'win',player:0,damage:0}); return
  }
  if(ko || st.round>=3 || st.wins.some(w=>w>=2) || st.mode==='arcade' || st.mode==='survival') {
    st.over=true; st.phase='over'
    if(!ko && st.mode!=='arcade' && st.mode!=='survival') st.winner=st.wins[0]===st.wins[1] ? null : st.wins[0]>st.wins[1] ? 0 : 1
    if(st.winner===0) st.score+=350
    events.push({kind:ko?'ko':'win',player:st.winner??-1,damage:0})
  } else { st.phase='break'; events.push({kind:'bell',player:winner??-1,damage:0}) }
}
function hit(st:BoxingState,player:number,punch:Punch,events:FightEvent[]) {
  const attacker=st.fighters[player],defender=st.fighters[1-player],move=MOVES[punch]
  if(Math.abs(attacker.x-defender.x)>move.range) {
    attacker.stamina=Math.max(0,attacker.stamina-move.cost*.25)
    if(punch==='power'||punch==='special') attacker.busyUntil+=.15
    defender.counterUntil=st.time+.4
    events.push({kind:'miss',player,move:punch,damage:0}); return
  }
  if(st.time<defender.dodgeUntil && punch!=='uppercut' && punch!=='body') {
    defender.counterUntil=st.time+.65; defender.meter=Math.min(100,defender.meter+9)
    events.push({kind:'dodge',player:1-player,damage:0}); return
  }
  const counter=st.time<attacker.counterUntil
  let damage=move.damage*(1+(attacker.chain-1)*.08)*(attacker.repeats>=2 ? .65 : 1)*(counter ? 1.4 : 1)
  attacker.counterUntil=0
  const blocked=st.time<defender.guardUntil && punch!=='body' && punch!=='special' && defender.stamina>=damage*.9
  if(blocked) {
    defender.stamina=Math.max(0,defender.stamina-damage*.9); damage*=.15
    if(st.time-defender.moveAt<.2) defender.counterUntil=st.time+.35
    if(punch==='power') attacker.busyUntil+=.1
  }
  else {
    defender.stunUntil=Math.max(defender.stunUntil,st.time+(punch==='power' || punch==='special' ? .22 : .07))
    defender.hurtAt=st.time
    defender.hurtMove=punch; defender.hurtPower=Math.round(damage)
    if(punch==='body') defender.stamina=Math.max(0,defender.stamina-23)
  }
  damage=Math.round(damage)
  defender.hp=Math.max(0,defender.hp-damage); attacker.damage+=damage; st.roundDamage[player]+=damage
  attacker.meter=Math.min(100,attacker.meter+(blocked ? 3 : 10)); defender.meter=Math.min(100,defender.meter+damage*.3)
  if(player===0) st.score+=damage+(counter ? 10 : 0)+(attacker.chain>1 && !blocked ? attacker.chain*2 : 0)
  events.push({kind:blocked?'block':'hit',player,move:punch,damage,counter})
  if(st.mode==='training') defender.hp=MAX_HP
  else if(defender.hp<=0) endRound(st,player,true,events)
}
function ai(st:BoxingState,random:()=>number) {
  if(st.mode==='versus' || st.mode==='training' || st.time<st.aiAt) return
  const f=st.fighters[1],enemy=st.fighters[0]
  const level=Math.min(3,st.difficulty+(st.wave-1)*.35)
  st.aiAt=st.time+.24+(2-level)*.1+random()*.3
  if(Math.abs(f.x-enemy.x)>.28) { act(st,1,'advance'); return }
  if(f.stamina<22) { act(st,1,random()<.6?'retreat':'guard'); return }
  if(enemy.pending.length && random()<.2+level*.14) { act(st,1,random()<.5?'dodge':'guard'); return }
  const style=(st.wave-1)%3
  const pool:Punch[]=style===1 ? ['hook','power','body','uppercut','cross'] : style===2 ? ['jab','cross','body','uppercut','flurry'] : ['jab','jab','cross','hook','body','uppercut','flurry']
  act(st,1,f.meter>=100 && random()<.5?'special':pool[Math.floor(random()*pool.length)])
}
export function update(st:BoxingState,delta:number,random=Math.random):FightEvent[] {
  const events:FightEvent[]=[]
  if(st.phase!=='fight' || st.over) return events
  const dt=Math.max(0,Math.min(.05,delta))
  st.time+=dt
  if(st.mode!=='training') st.left=Math.max(0,st.left-dt)
  for(const f of st.fighters) {
    const resting=st.time>=f.busyUntil && st.time>=f.guardUntil
    f.stamina=Math.min(100,f.stamina+dt*(resting ? 32 : 18))
    if(st.time>=f.moveUntil) f.move='idle'
  }
  for(const [player,f] of st.fighters.entries()) {
    if(f.queued && st.time>f.queued.expires) f.queued=null
    if(f.queued && st.time>=f.busyUntil && st.time>=f.stunUntil) {
      const action=f.queued.action
      if(!act(st,player,action)) f.queued=null
    }
  }
  ai(st,random)
  for(const [player,f] of st.fighters.entries()) if(f.soundPending) {
    const punch=f.move in MOVES ? f.move as Punch : undefined
    events.push({kind:punch?'swing':f.move==='guard'?'guard':f.move==='dodge'?'slip':'step',player,move:punch,damage:0})
    f.soundPending=false
  }
  const due=st.fighters.flatMap((f,player)=>f.pending.filter(p=>p.at<=st.time).map(p=>({...p,player}))).sort((a,b)=>a.at-b.at)
  for(const f of st.fighters) f.pending=f.pending.filter(p=>p.at>st.time)
  for(const attack of due) { if(st.over || st.phase!=='fight') break; hit(st,attack.player,attack.punch,events) }
  if(st.left<=0 && st.phase==='fight') endRound(st,st.roundDamage[0]===st.roundDamage[1]?null:st.roundDamage[0]>st.roundDamage[1]?0:1,false,events)
  return events
}
