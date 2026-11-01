import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/lib/boxing/game.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
const {initial,start,act,canAct,input,canInput,update,nextRound,MOVES,MAX_HP,KEYS,fighterMotion,STEP_TIME,applyHeldMovement}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const fight=(mode='versus')=>{const st=initial(mode);start(st);return st}
function advance(st,seconds,random=()=>.5){const events=[];for(let i=0;i<Math.ceil(seconds*60);i++)events.push(...update(st,1/60,random));return events}

test('the lobby and breaks reject actions and freeze clocks',()=>{
  const st=initial();const before=structuredClone(st)
  assert.equal(act(st,0,'jab'),false);assert.deepEqual(update(st,.05),[]);assert.deepEqual(st,before)
  start(st);assert.equal(st.phase,'fight');st.phase='break'
  const paused=structuredClone(st);update(st,.05);assert.deepEqual(st,paused)
})
test('punches resolve after windup; short recovery and cooldown allow repeated punches without bypassing windup',()=>{
  const st=fight();assert.equal(act(st,0,'cross'),true);assert.equal(st.fighters[0].stamina,93)
  assert.equal(act(st,0,'jab'),false);advance(st,.1);assert.equal(st.fighters[1].hp,MAX_HP)
  advance(st,.15);assert.equal(st.fighters[1].hp,MAX_HP-10)
  assert.equal(act(st,0,'cross'),false);advance(st,.4);assert.equal(canAct(st,0,'cross'),true)
  st.fighters[0].stamina=0;assert.equal(act(st,0,'power'),false)
  advance(st,1);assert.ok(st.fighters[0].stamina>0)
})
test('range and footwork matter, and fighters cannot cross or leave the ring',()=>{
  const st=fight();st.fighters[0].x=.16;st.fighters[1].x=.84
  act(st,0,'jab');assert.ok(advance(st,.2).some(e=>e.kind==='miss'));assert.equal(st.fighters[1].hp,MAX_HP)
  for(let i=0;i<100;i++){advance(st,.14);act(st,0,'advance');act(st,1,'advance')}
  assert.ok(st.fighters[1].x-st.fighters[0].x>=.169999)
  for(let i=0;i<100;i++){advance(st,.14);act(st,0,'retreat');act(st,1,'retreat')}
  assert.equal(st.fighters[0].x,.16);assert.equal(st.fighters[1].x,.84)
})
test('guard reduces head damage, body shots bypass guard and drain stamina',()=>{
  const head=fight();act(head,1,'guard');act(head,0,'jab')
  const blocked=advance(head,.2).find(e=>e.kind==='block')
  assert.ok(blocked);assert.ok(head.fighters[1].hp>MAX_HP-6)
  const body=fight();act(body,1,'guard');act(body,0,'body')
  assert.ok(advance(body,.25).some(e=>e.kind==='hit'))
  assert.equal(body.fighters[1].hp,MAX_HP-8);assert.ok(body.fighters[1].stamina<80)
})
test('an exhausted guard breaks against a power shot',()=>{
  const st=fight();st.fighters[1].stamina=8;act(st,1,'guard');act(st,0,'power')
  assert.ok(advance(st,.5).some(e=>e.kind==='hit'&&e.damage===25))
  assert.equal(st.fighters[1].hp,MAX_HP-25)
})
test('a successful dodge opens a counter window; uppercuts catch dodging opponents',()=>{
  const st=fight();act(st,1,'dodge');act(st,0,'jab')
  assert.ok(advance(st,.18).some(e=>e.kind==='dodge'))
  assert.equal(st.fighters[1].hp,MAX_HP);assert.ok(st.fighters[1].counterUntil>st.time)
  assert.equal(act(st,1,'cross'),true)
  assert.ok(advance(st,.25).some(e=>e.kind==='hit'&&e.counter&&e.damage>10))
  const upper=fight();act(upper,0,'advance');act(upper,1,'dodge');act(upper,0,'uppercut')
  assert.ok(advance(upper,.36).some(e=>e.kind==='hit'&&e.move==='uppercut'))
})
test('mixed combos build bonuses while repeating one punch is weaker',()=>{
  const st=fight('training')
  act(st,0,'jab');advance(st,.4);act(st,0,'cross');advance(st,.6)
  assert.equal(st.fighters[0].chain,2);assert.ok(st.score>16)
  const spam=fight('training');const damage=[]
  for(let i=0;i<3;i++){act(spam,0,'jab');damage.push(advance(spam,.4).find(e=>e.kind==='hit').damage)}
  assert.ok(damage[2]<damage[0])
})
test('flurry produces three timed impacts and finishers require a full meter',()=>{
  const st=fight('training');act(st,0,'flurry')
  assert.equal(advance(st,.5).filter(e=>e.kind==='hit').length,3)
  advance(st,.4);st.fighters[0].stamina=100
  assert.equal(act(st,0,'special'),false)
  st.fighters[0].meter=100;assert.equal(act(st,0,'special'),true);assert.equal(st.fighters[0].meter,0)
  assert.ok(advance(st,.5).some(e=>e.move==='special'&&e.damage>=34))
})
test('local versus accepts both players and never injects CPU input',()=>{
  const st=fight();advance(st,2)
  assert.equal(st.fighters[1].move,'idle');assert.equal(st.fighters[0].hp,MAX_HP)
  assert.equal(act(st,0,'jab'),true);assert.equal(act(st,1,'cross'),true)
  const events=advance(st,.3)
  assert.ok(events.some(e=>e.player===0&&e.kind==='hit'));assert.ok(events.some(e=>e.player===1&&e.kind==='hit'))
  const p1=new Set(Object.entries(KEYS).filter(([,v])=>v[0]===0).map(([k])=>k))
  assert.ok(Object.entries(KEYS).filter(([,v])=>v[0]===1).every(([k])=>!p1.has(k)))
})
test('KO ends the match immediately and later inputs cannot damage the loser',()=>{
  const st=fight();st.fighters[1].hp=1;act(st,0,'jab')
  assert.ok(advance(st,.2).some(e=>e.kind==='ko'));assert.equal(st.winner,0);assert.equal(st.over,true)
  const before=structuredClone(st);assert.equal(act(st,1,'power'),false);advance(st,2);assert.deepEqual(st,before)
})
test('timed rounds preserve round wins and award the best-of-three winner',()=>{
  const st=fight();st.left=.01;st.roundDamage[0]=10;update(st,1/60)
  assert.equal(st.phase,'break');assert.deepEqual(st.wins,[1,0])
  nextRound(st);assert.equal(st.round,2);assert.equal(st.phase,'fight');assert.equal(st.fighters[0].stamina,100)
  st.left=.01;st.roundDamage[0]=10;update(st,1/60)
  assert.equal(st.over,true);assert.equal(st.winner,0)
})
test('arcade finishes after three rivals; survival continues and training never times out',()=>{
  for(const mode of ['arcade','survival']) {
    const st=fight(mode)
    for(let wave=1;wave<=3;wave++) {
      st.fighters[1].hp=1;st.fighters[0].stamina=100;act(st,0,'jab');advance(st,.2)
      if(mode==='arcade'&&wave===3){assert.equal(st.over,true);break}
      assert.equal(st.phase,'break');nextRound(st);assert.equal(st.wave,wave+1)
    }
    if(mode==='survival')assert.equal(st.over,false)
  }
  const dummy=fight('training');advance(dummy,60);assert.equal(dummy.phase,'fight');assert.equal(dummy.left,45)
  act(dummy,0,'jab');advance(dummy,.2);assert.equal(dummy.fighters[1].hp,MAX_HP)
})
test('CPU uses multiple moves and deterministic simulation produces the same fight',()=>{
  function simulate(){let seed=7;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);const st=fight('survival');const seen=new Set();
    for(let i=0;i<1800;i++){st.fighters[0].hp=MAX_HP;for(const e of update(st,1/60,rand))if(e.player===1&&e.move)seen.add(e.move)}
    return{st,seen:[...seen]}}
  const first=simulate();assert.ok(first.seen.length>=4);assert.deepEqual(simulate(),first)
  assert.equal(Object.keys(MOVES).length,8)
})

const audioCode=ts.transpileModule(readFileSync(new URL('../src/lib/boxing/audio.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
const {createBoxingAudio,PUNCH_SOUNDS}=await import(`data:text/javascript;base64,${Buffer.from(audioCode).toString('base64')}`)
test('audio unlocks only on gesture, layers impacts, honors mute, and releases its context',()=>{
  let contexts=0,tones=0,bursts=0,closed=false
  const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}})
  const node=()=>({connect(){return this},disconnect(){}})
  class Audio {
    state='running';currentTime=0;sampleRate=44100;destination=node()
    constructor(){contexts++}
    createGain(){return{...node(),gain:parameter()}}
    createDynamicsCompressor(){return{...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()}}
    createBuffer(_,size){return{getChannelData:()=>new Float32Array(size)}}
    createOscillator(){tones++;return{...node(),frequency:parameter(),start(){},stop(){}}}
    createBufferSource(){bursts++;return{...node(),start(){},stop(){}}}
    createBiquadFilter(){return{...node(),frequency:parameter(),Q:parameter()}}
    resume(){this.state='running';return Promise.resolve()}
    suspend(){this.state='suspended';return Promise.resolve()}
    close(){closed=true;return Promise.resolve()}
  }
  globalThis.window={AudioContext:Audio}
  try {
    const audio=createBoxingAudio();assert.equal(contexts,0)
    audio.play({kind:'hit',player:0,damage:20});assert.equal(tones,0)
    audio.unlock();assert.equal(contexts,1)
    audio.play({kind:'hit',player:0,damage:20,counter:true});assert.equal(tones,2);assert.equal(bursts,1)
    audio.setMuted(true);audio.play({kind:'bell',player:0,damage:0});assert.equal(tones,2)
    audio.setMuted(false);audio.play({kind:'bell',player:0,damage:0});assert.equal(tones,5)
    audio.suspend();audio.play({kind:'hit',player:0,damage:20});assert.equal(tones,5)
    audio.dispose();assert.equal(closed,true)
  } finally {delete globalThis.window}
})
test('missing Web Audio support does not interrupt gameplay',()=>{
  globalThis.window={}
  try {const audio=createBoxingAudio();assert.doesNotThrow(()=>{audio.unlock();audio.play({kind:'ko',player:0,damage:0});audio.setMuted(true);audio.dispose()})}
  finally{delete globalThis.window}
})

test('buffered input links different punches and defense can cancel recovery after contact',()=>{
  const st=fight('training')
  assert.equal(input(st,0,'jab'),true)
  assert.equal(input(st,0,'cross'),true)
  assert.equal(st.fighters[0].queued.action,'cross')
  const events=advance(st,.65)
  assert.deepEqual(events.filter(e=>e.kind==='swing').map(e=>e.move),['jab','cross'])
  assert.ok(events.some(e=>e.kind==='hit'&&e.move==='cross'))
  assert.equal(st.fighters[0].chain,2)
  const defense=fight();input(defense,0,'cross');advance(defense,.25)
  assert.ok(defense.time<defense.fighters[0].busyUntil)
  assert.equal(input(defense,0,'dodge'),true)
  assert.ok(defense.fighters[0].dodgeUntil>defense.time)
})
test('missed heavy punches cost stamina and leave a counter opening',()=>{
  const st=fight();st.fighters[0].x=.16;st.fighters[1].x=.84
  act(st,0,'power');const recovery=st.fighters[0].busyUntil
  const events=advance(st,.5)
  assert.ok(events.some(e=>e.kind==='swing'&&e.move==='power'))
  assert.ok(events.some(e=>e.kind==='miss'&&e.move==='power'))
  assert.ok(st.fighters[0].stamina<100)
  assert.ok(st.fighters[0].busyUntil>recovery)
  assert.ok(st.fighters[1].counterUntil>st.time)
})
test('buffered commands are discarded at KO and never execute after a restart',()=>{
  const st=fight();st.fighters[1].hp=1
  input(st,0,'jab');input(st,0,'power');advance(st,.2)
  assert.equal(st.fighters[0].queued,null)
  assert.equal(st.over,true)
  assert.equal(canInput(st,0,'jab'),false)
})
test('all eight punch voices have distinct impact and air-sweep signatures',()=>{
  const voices=Object.values(PUNCH_SOUNDS)
  assert.equal(voices.length,8)
  assert.equal(new Set(voices.map(v=>[v.thump,v.end,v.tail,v.crack,v.air,v.swing,v.gain].join(','))).size,8)
  for(const voice of voices){assert.ok(voice.thump>voice.end);assert.ok(voice.swing>0&&voice.tail>0);assert.ok(voice.gain>0&&voice.gain<=1)}
})

const poseCode=ts.transpileModule(readFileSync(new URL('../src/lib/boxing/pose.ts',import.meta.url),'utf8').replace("'./game'",JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
const {boxingPose,fighterX,boxingFootwork}=await import(`data:text/javascript;base64,${Buffer.from(poseCode).toString('base64')}`)
test('punch choreography is distinct, contacts head/body at different heights and returns to guard',()=>{
  const signatures=new Set()
  for(const [move,config] of Object.entries(MOVES)) {
    const st=fight('training');st.fighters[0].meter=100;act(st,0,move)
    const f=st.fighters[0]
    signatures.add([.04,.12,.22,.34,.48,.65].map(time=>{const p=boxingPose(f,time,150);return [p.active,p.wrist.x.toFixed(1),p.wrist.y.toFixed(1),p.lean.toFixed(1)].join(',')}).join('|'))
    const contact=boxingPose(f,config.windup,150)
    assert.ok(contact.extension>.99)
    assert.ok(Number.isFinite(contact.wrist.x)&&Number.isFinite(contact.wrist.y))
    if(move==='body')assert.ok(contact.wrist.y>-190)
    else assert.ok(contact.wrist.y<-210)
    const recovered=boxingPose(f,config.windup+.5,150)
    assert.equal(recovered.charge,0)
  }
  assert.equal(signatures.size,8)
  const st=fight();act(st,0,'advance')
  assert.ok(fighterX(st.fighters[0],.05)>st.fighters[0].fromX)
  assert.ok(fighterX(st.fighters[0],.05)<st.fighters[0].x)
  assert.equal(fighterX(st.fighters[0],1),st.fighters[0].x)
})

test('repeated steps and reversing direction preserve the visible position without overshoot',()=>{
  const st=fight();act(st,0,'advance');advance(st,.13)
  const f=st.fighters[0],before=fighterMotion(f,st.time)
  act(st,0,'advance');const after=fighterMotion(f,st.time)
  assert.ok(Math.abs(before.x-after.x)<1e-12);assert.ok(Math.abs(before.velocity-after.velocity)<1e-12)
  advance(st,.13);const reversing=fighterMotion(f,st.time)
  act(st,0,'retreat');assert.ok(Math.abs(fighterMotion(f,st.time).x-reversing.x)<1e-12)
  for(let i=0;i<=30;i++){
    const motion=fighterMotion(f,st.time+i/100)
    assert.ok(motion.x>=Math.min(f.fromX,f.x)-1e-12&&motion.x<=Math.max(f.fromX,f.x)+1e-12)
    assert.ok(Number.isFinite(motion.velocity))
  }
})
test('shuffle footwork plants one foot while the other travels, including backward steps',()=>{
  for(const action of ['advance','retreat']){
    const st=fight();act(st,0,action);const f=st.fighters[0],first=action==='advance'?0:1
    for(let i=0;i<=100;i++){
      const time=STEP_TIME*i/100,feet=[boxingFootwork(f,time,0,1),boxingFootwork(f,time,1,1)]
      assert.ok(feet.some(foot=>Math.abs(foot.lift)<1e-10))
      const body=(fighterX(f,time)-f.fromX)*4.4
      if(i<48)assert.ok(Math.abs(body+feet[1-first].offset)<1e-10)
      if(i>46)assert.ok(Math.abs(body+feet[first].offset-(f.x-f.fromX)*4.4)<1e-10)
    }
  }
})
test('punches blend from guard, contact on time, alternate flurry hands and recoil after contact',()=>{
  for(const [move,config] of Object.entries(MOVES)){
    const st=fight();st.fighters[0].meter=100;act(st,0,move)
    const f=st.fighters[0]
    assert.ok(boxingPose(f,0,150).arms.every(a=>a.blend===0))
    assert.ok(boxingPose(f,config.windup,150).extension>.999)
    assert.ok(boxingPose(f,config.windup+config.recovery,150).arms.every(a=>a.blend===0))
    if(move==='flurry')for(let i=0;i<3;i++)assert.ok(boxingPose(f,config.windup+i*.13,150).arms[i%2].extension>.999)
  }
  const f=fight().fighters[0];f.hurtAt=1;f.hurtMove='body';f.hurtPower=25
  assert.equal(boxingPose(f,1,150).hurt,0)
  const recoil=boxingPose(f,1.03,150);assert.ok(recoil.hurt>.9&&recoil.crouch>10)
  assert.equal(boxingPose(f,1.4,150).hurt,0)
})

test('holding movement repeats both players, prioritizes the latest direction and preserves queued combos',()=>{
  const st=fight(),held=new Map([['p1',[0,'advance']],['p2',[1,'retreat']]])
  for(let i=0;i<24;i++){applyHeldMovement(st,held.values());update(st,1/60)}
  assert.ok(st.fighters[0].x>.45&&st.fighters[1].x>.7)
  held.clear();const stopped=st.fighters.map(f=>f.x)
  for(let i=0;i<24;i++){applyHeldMovement(st,held.values());update(st,1/60)}
  assert.deepEqual(st.fighters.map(f=>f.x),stopped)
  const direction=fight();applyHeldMovement(direction,[[0,'advance'],[0,'retreat']]);assert.ok(direction.fighters[0].x<.37)
  const combo=fight();input(combo,0,'jab');input(combo,0,'cross')
  for(let i=0;i<28;i++){applyHeldMovement(combo,[[0,'advance']]);update(combo,1/60)}
  assert.equal(combo.fighters[0].lastPunch,'cross');assert.equal(combo.fighters[0].chain,2)
  const cpu=fight('training');applyHeldMovement(cpu,[[1,'advance']]);assert.equal(cpu.fighters[1].x,.63)
})


test('1000 HP applies to new rivals, healing and training without multiplying punch damage',()=>{
  assert.equal(MAX_HP,1000)
  const st=fight('survival');assert.deepEqual(st.fighters.map(f=>f.hp),[1000,1000])
  st.fighters[0].hp=600;st.fighters[1].hp=1;act(st,0,'jab');advance(st,.2);nextRound(st)
  assert.deepEqual(st.fighters.map(f=>f.hp),[900,1000])
  const rounds=fight();rounds.fighters[0].hp=950;rounds.fighters[1].hp=500;rounds.phase='break';nextRound(rounds)
  assert.deepEqual(rounds.fighters.map(f=>f.hp),[1000,660])
  const dummy=fight('training');act(dummy,0,'power')
  const hit=advance(dummy,.5).find(e=>e.kind==='hit');assert.equal(hit.damage,25);assert.equal(dummy.fighters[1].hp,1000)
})
test('rapid light punches stay sustainable and every heavy skill can repeat sooner',()=>{
  const st=fight('training');let hits=0
  for(let i=0;i<600;i++){input(st,0,'jab');hits+=update(st,1/60).filter(e=>e.kind==='hit').length}
  assert.ok(hits>=35,`expected sustained punches, got ${hits}`)
  assert.ok(st.fighters[0].stamina>50)
  for(const [move,limit] of [['cross',.4],['hook',.5],['uppercut',.56],['body',.37],['power',.72],['flurry',.54],['special',.66]]){
    const round=fight('training');round.fighters[0].meter=100;act(round,0,move);advance(round,limit)
    round.fighters[0].meter=100
    assert.equal(act(round,0,move),true,`${move} should be ready within ${limit}s`)
  }
})
