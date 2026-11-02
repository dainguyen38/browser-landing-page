import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
async function moduleAt(file){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}
const {dealProgress,DEAL_DURATION_MS,DEAL_STEP_MS,botThinkDelay,seatPosition}=await moduleAt('../src/lib/tlmn/presentation.ts')
test('52 sequential cards reach all four seats, with at most five in flight and no skipped or repeated counts',()=>{
  assert.ok(DEAL_DURATION_MS>3000&&DEAL_DURATION_MS<4000)
  for(let starter=0;starter<4;starter++){
    let previous=[0,0,0,0]
    for(let time=0;time<DEAL_DURATION_MS;time+=16){
      const frame=dealProgress(time,starter)
      assert.ok(frame.flights.length<=5)
      assert.equal(new Set(frame.flights.map(f=>f.index)).size,frame.flights.length)
      for(const f of frame.flights){assert.equal(f.seat,(starter+f.index)%4);assert.ok(f.progress>=0&&f.progress<1)}
      for(let seat=0;seat<4;seat++){assert.ok(frame.counts[seat]>=previous[seat]&&frame.counts[seat]<=13)}
      assert.equal(frame.complete,false);assert.deepEqual(dealProgress(time,starter),frame)
      previous=frame.counts
    }
    const done=dealProgress(DEAL_DURATION_MS,starter)
    assert.deepEqual(done.counts,[13,13,13,13]);assert.equal(done.flights.length,0);assert.equal(done.complete,true)
    assert.deepEqual(dealProgress(DEAL_DURATION_MS+10000,starter),done)
    assert.equal(dealProgress(0,starter).flights[0].seat,starter)
    assert.equal(dealProgress(DEAL_STEP_MS,starter).flights[1].index,1)
  }
})
test('thinking delays vary between 1.3 and 2.5 seconds and seat positions rotate around one hand anchor',()=>{
  assert.equal(botThinkDelay(()=>0),1300);assert.equal(botThinkDelay(()=>1),2500)
  assert.equal(new Set([.05,.3,.5,.8].map(n=>botThinkDelay(()=>n))).size,4)
  for(let anchor=0;anchor<4;anchor++){
    assert.equal(seatPosition(anchor,anchor),0)
    assert.deepEqual([0,1,2,3].map(i=>seatPosition((anchor+i)%4,anchor)),[0,1,2,3])
  }
})
const {createCardAudio}=await moduleAt('../src/lib/tlmn/audio.ts')
test('card audio needs a gesture, layers a short filtered deal, honors pause/mute and closes resources',()=>{
  let contexts=0,starts=0,closed=false,resumed=0,suspended=0,disconnected=0
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}})
  const node=()=>({connect(){},disconnect(){disconnected++}})
  class Audio {
    state='running';sampleRate=44100;currentTime=0;destination=node()
    constructor(){contexts++}
    createBuffer(_,length){return{getChannelData:()=>new Float32Array(length)}}
    createBufferSource(){return{...node(),playbackRate:param(),onended:null,start(){starts++},stop(){this.onended?.()}}}
    createBiquadFilter(){return{...node(),frequency:param(),Q:param()}}
    createGain(){return{...node(),gain:param()}}
    resume(){resumed++;this.state='running';return Promise.resolve()}
    suspend(){suspended++;this.state='suspended';return Promise.resolve()}
    close(){closed=true;return Promise.resolve()}
  }
  globalThis.window={AudioContext:Audio}
  try{
    const audio=createCardAudio();audio.deal(0);assert.equal(contexts,0)
    audio.unlock();assert.equal(contexts,1);audio.deal(0);assert.equal(starts,1)
    audio.setMuted(true);audio.deal(1);assert.equal(starts,1)
    audio.setMuted(false);audio.setPaused(true);audio.deal(2);assert.equal(starts,1);assert.equal(suspended,1)
    audio.setPaused(false);audio.deal(3);assert.equal(starts,2);assert.ok(resumed>=2)
    assert.ok(disconnected>=6);audio.dispose();assert.equal(closed,true)
    audio.unlock();audio.deal(4);assert.equal(contexts,1);assert.equal(starts,2)
  }finally{delete globalThis.window}
})
test('unsupported audio environments leave dealing usable',()=>{
  globalThis.window={}
  try{const audio=createCardAudio();assert.doesNotThrow(()=>{audio.unlock();audio.deal(0);audio.setPaused(true);audio.dispose()})}
  finally{delete globalThis.window}
})
