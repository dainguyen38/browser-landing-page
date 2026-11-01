import type { FightEvent } from './game'

// Distinct transient, low-frequency body and air sweep for each punch.
export const PUNCH_SOUNDS = {
  jab: { thump:165,end:75,tail:.075,crack:2800,air:3400,swing:.07,gain:.38 },
  cross: { thump:135,end:48,tail:.12,crack:2100,air:2600,swing:.105,gain:.52 },
  hook: { thump:105,end:36,tail:.17,crack:1400,air:1800,swing:.16,gain:.65 },
  uppercut: { thump:88,end:30,tail:.2,crack:1100,air:1000,swing:.19,gain:.7 },
  body: { thump:72,end:26,tail:.14,crack:350,air:1400,swing:.1,gain:.58 },
  power: { thump:115,end:27,tail:.25,crack:900,air:850,swing:.27,gain:.8 },
  flurry: { thump:185,end:65,tail:.065,crack:3200,air:3900,swing:.055,gain:.36 },
  special: { thump:95,end:22,tail:.32,crack:1700,air:650,swing:.3,gain:.9 },
} as const
export function createBoxingAudio() {
  let ctx:AudioContext|null=null,master:GainNode|null=null,noise:AudioBuffer|null=null
  let muted=false
  function unlock() {
    if(typeof window==='undefined') return
    try {
      if(!ctx) {
        const Constructor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext
        if(!Constructor) return
        ctx=new Constructor();master=ctx.createGain();master.gain.value=muted?0:.55
        const limiter=ctx.createDynamicsCompressor()
        limiter.threshold.value=-18;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12
        master.connect(limiter).connect(ctx.destination)
        if(ctx.createDelay) {
          const room=ctx.createGain(),delay=ctx.createDelay(.3),filter=ctx.createBiquadFilter()
          room.gain.value=.13;delay.delayTime.value=.085;filter.type='lowpass';filter.frequency.value=1900
          master.connect(room).connect(delay).connect(filter).connect(limiter)
        }
        noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.5),ctx.sampleRate)
        const values=noise.getChannelData(0)
        for(let i=0;i<values.length;i++) values[i]=(Math.random()*2-1)*Math.pow(1-i/values.length,1.3)
      }
      if(ctx.state==='suspended') void ctx.resume().catch(()=>{})
    } catch { /* Unsupported audio must not interrupt the fight. */ }
  }
  function connect(source:AudioNode,pan:number) {
    if(!ctx||!master) return ()=>{}
    if(ctx.createStereoPanner) {
      const spatial=ctx.createStereoPanner();spatial.pan.value=pan
      source.connect(spatial).connect(master)
      return ()=>{source.disconnect();spatial.disconnect()}
    }
    source.connect(master);return()=>source.disconnect()
  }
  function tone(frequency:number,end:number,duration:number,gain:number,type:OscillatorType='sine',delay=0,pan=0) {
    if(!ctx||!master) return
    const start=ctx.currentTime+delay,osc=ctx.createOscillator(),envelope=ctx.createGain()
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(end,start+duration)
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(gain,start+.004)
    envelope.gain.exponentialRampToValueAtTime(.0001,start+duration)
    osc.connect(envelope);const release=connect(envelope,pan)
    osc.onended=()=>{osc.disconnect();release()};osc.start(start);osc.stop(start+duration+.02)
  }
  function burst(frequency:number,duration:number,gain:number,pan=0,sweep=1,delay=0) {
    if(!ctx||!master||!noise) return
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain(),start=ctx.currentTime+delay
    source.buffer=noise;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,start)
    filter.frequency.exponentialRampToValueAtTime(frequency*sweep,start+duration);filter.Q.value=.7
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(gain,start+.005)
    envelope.gain.exponentialRampToValueAtTime(.0001,start+duration)
    source.connect(filter).connect(envelope);const release=connect(envelope,pan)
    source.onended=()=>{source.disconnect();filter.disconnect();release()};source.start(start);source.stop(start+duration)
  }
  return {
    unlock,
    setMuted(value:boolean){muted=value;if(ctx&&master)master.gain.setTargetAtTime(value?0:.55,ctx.currentTime,.015)},
    play(event:FightEvent){
      if(!ctx||muted||ctx.state!=='running') return
      try {
        const profile=PUNCH_SOUNDS[event.move??'jab'],pan=event.player===0?-.28:.28
        const variation=.97+Math.random()*.06
        if(event.kind==='swing') {
          burst(profile.air,profile.swing,.13,pan,.35)
          if(event.move==='flurry') {burst(3200,.06,.09,pan,.5,.13);burst(3700,.055,.1,pan,.4,.26)}
          if(event.move==='special') {tone(65,180,.3,.13,'triangle',0,pan);tone(600,1200,.25,.035,'sine',0,pan)}
          if(event.move==='power'||event.move==='uppercut') tone(155,110,.09,.035,'triangle',0,pan)
        } else if(event.kind==='hit') {
          tone(profile.thump*variation,profile.end,profile.tail,profile.gain,'sine',0,pan)
          burst(profile.crack*variation,profile.tail*.7,profile.gain*.85,pan,.6)
          if(event.move==='hook'||event.move==='power'||event.move==='special') burst(3500,.035,.22,pan)
          if(event.move==='special') {tone(45,24,.4,.4,'sine',.035,pan);tone(260,75,.18,.08,'triangle',0,pan)}
          if(event.counter) tone(920,440,.16,.11,'triangle',0,pan)
        } else if(event.kind==='block') {burst(850,.075,.32,pan,.7);tone(190,130,.07,.2,'triangle',0,pan)}
        else if(event.kind==='guard') burst(450,.08,.11,pan,.8)
        else if(event.kind==='slip') burst(2800,.17,.12,pan,.25)
        else if(event.kind==='step') burst(250,.06,.08,pan,.8)
        else if(event.kind==='miss') burst(profile.air*.7,.07,.06,pan,.5)
        else if(event.kind==='dodge') tone(480,850,.08,.035,'sine',0,pan)
        else if(event.kind==='bell'||event.kind==='win') for(const f of [540,810,1280]) tone(f,f*.98,.9,.1)
        else if(event.kind==='ko'){tone(75,23,.5,.65);burst(460,.3,.65);for(const delay of [.15,.4,.65])tone(540,530,.8,.12,'sine',delay)}
      } catch { /* Audio devices can disappear while a match is active. */ }
    },
    suspend(){if(ctx?.state==='running')void ctx.suspend().catch(()=>{})},
    dispose(){if(ctx)void ctx.close().catch(()=>{});ctx=null;master=null;noise=null},
  }
}
