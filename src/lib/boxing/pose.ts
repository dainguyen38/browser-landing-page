import { MOVES, STEP_TIME, fighterMotion, type Fighter, type Punch } from './game'
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)}
export function fighterX(f:Fighter,time:number) {return fighterMotion(f,time).x}
export function boxingIdle(time:number,phase=0,strength=1) {
  const step=time*5.2+phase,breath=Math.sin(time*2.1+phase*.7)*strength
  return {breath,bounce:(1-Math.cos(step*2))*.024*strength,
    sway:-Math.sin(step)*.028*strength,lateral:Math.sin(step*.5)*.012*strength,
    heels:[Math.max(0,Math.sin(step))**2*.07*strength,Math.max(0,-Math.sin(step))**2*.07*strength]}
}
export function boxingFootwork(f:Fighter,time:number,footIndex:number,facing:number) {
  const elapsed=f.stepAt===undefined?STEP_TIME:time-f.stepAt
  const t=Math.max(0,Math.min(1,elapsed/STEP_TIME)),distance=(f.x-(f.fromX??f.x))*4.4*facing
  const body=distance===0?1:(fighterX(f,time)-(f.fromX??f.x))*4.4*facing/distance
  const first=distance>=0?0:1,phase=footIndex===first?Math.min(1,t/.46):Math.max(0,(t-.48)/.52)
  return {offset:distance*(smooth(phase)-body),lift:Math.sin(phase*Math.PI)*.055,
    drive:Math.sin(t*Math.PI),active:elapsed>=0&&elapsed<STEP_TIME&&Math.abs(distance)>.001}
}
function cycle(elapsed:number,hitAt:number,strike:number,recovery:number,flurry:boolean) {
  const start=flurry?Math.max(0,hitAt-strike-.035):0
  const returning=smooth((elapsed-hitAt-.018)/recovery)
  const extension=elapsed<=hitAt?Math.max(0,Math.min(1,(elapsed-hitAt+strike)/strike))**2:1-returning
  const charge=elapsed<hitAt?smooth((elapsed-start)/Math.max(.025,hitAt-strike-start))*(1-extension):0
  return {extension,charge,blend:smooth((elapsed-start)/.06)*(1-returning),hitAt}
}
export function boxingPose(f:Fighter,time:number,distance:number,reducedMotion=false) {
  const punch=f.move in MOVES?f.move as Punch:null,elapsed=time-f.moveAt
  const arms=[{extension:0,charge:0,blend:0,hitAt:0},{extension:0,charge:0,blend:0,hitAt:0}]
  const rear=punch==='cross'||punch==='power'||punch==='special'
  if(punch){
    const strike=punch==='flurry'?.07:punch==='jab'?.075:punch==='power'?.20:punch==='special'||punch==='uppercut'?.18:punch==='hook'?.17:punch==='cross'?.13:.11
    const recovery=punch==='flurry'?.095:Math.min(.30,MOVES[punch].recovery*.8)
    for(let i=0;i<(punch==='flurry'?3:1);i++){
      const arm=punch==='flurry'?i%2:rear?1:0,c=cycle(elapsed,MOVES[punch].windup+i*.13,strike,recovery,punch==='flurry')
      if(c.extension+c.charge+c.blend*.01>arms[arm].extension+arms[arm].charge+arms[arm].blend*.01)arms[arm]=c
    }
  }
  const index=arms[1].extension+arms[1].charge*.1>arms[0].extension+arms[0].charge*.1?1:0
  const extension=Math.max(arms[0].extension,arms[1].extension),charge=Math.max(arms[0].charge,arms[1].charge),active=index===1?'rear':'lead'
  const guard=time<f.guardUntil,dodge=time<f.dodgeUntil,hitAge=time-f.hurtAt
  const guardBlend=f.guardUntil>0?smooth((time-f.guardUntil+.75)/.07)*(1-smooth((time-f.guardUntil)/.1)):0
  const dodgeBlend=f.dodgeUntil>0?smooth((time-f.dodgeUntil+.4)/.055)*(1-smooth((time-f.dodgeUntil+.13)/.13)):0
  const hurt=hitAge<0?0:smooth(hitAge/.028)*(1-smooth((hitAge-.028)/.28))
  const weight=Math.min(1,Math.max(.35,(f.hurtPower??12)/28)),bodyHit=f.hurtMove==='body',upperHit=f.hurtMove==='uppercut'
  const reach=punch?Math.max(70,Math.min(distance-18,MOVES[punch].range*580)):68
  const wrist={x:68+(reach-68)*extension-charge*18,y:-235}
  if(punch==='hook'){wrist.x+=Math.sin(extension*Math.PI)*18;wrist.y=-231-Math.sin(extension*Math.PI)*18}
  if(punch==='uppercut')wrist.y=-150-extension*100
  if(punch==='body')wrist.y=-168
  const heavy=punch==='power'||punch==='special'
  const turn=punch==='hook'?26:punch==='uppercut'?18:heavy?29:punch==='cross'?22:punch==='body'?14:8
  const twist=arms.reduce((sum,arm,i)=>sum+(i===1?1:-1)*(smooth(Math.sqrt(arm.extension))*turn-arm.charge*(heavy?16:9)),0)
  const hipYaw=arms.reduce((sum,arm,i)=>sum+(i===1?1:-1)*(smooth(Math.min(1,Math.sqrt(arm.extension)*1.4))*turn*.008-arm.charge*.085),0)
  const lean=-27*dodgeBlend+(1-dodgeBlend)*(hurt?hurt*(bodyHit?22:-18*weight):extension*(rear?14:8)-charge*(heavy?14:rear?8:4))
  const crouch=24*dodgeBlend+(1-dodgeBlend)*((punch==='body'?extension*18:punch==='uppercut'?charge*17:heavy?charge*9:0)+hurt*(bodyHit?15:0))
  return {punch,extension,charge,arms,guard,dodge,guardBlend,dodgeBlend,hurt,hurtWeight:weight,bodyHit,upperHit,active,wrist,lean,crouch,twist,hipYaw,
    recoil:reducedMotion?0:hurt*weight*(upperHit?.025:-.06),bob:reducedMotion?0:Math.sin(time*6)*1.5}
}
