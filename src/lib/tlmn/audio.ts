export function createCardAudio() {
  let context:AudioContext|null=null,noise:AudioBuffer|null=null,muted=false,paused=false,disposed=false
  const playing=new Set<AudioBufferSourceNode>()
  function unlock() {
    if(disposed)return
    try {
      if(!context){
        const Audio=window.AudioContext??(window as any).webkitAudioContext
        if(!Audio)return
        context=new Audio()
        noise=context!.createBuffer(1,Math.floor(context!.sampleRate*.075),context!.sampleRate)
        const data=noise.getChannelData(0)
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)
      }
      if(!paused)void context!.resume().catch(()=>{})
    }catch{}
  }
  return {
    unlock,
    deal(index:number) {
      if(!context||!noise||context.state!=='running'||muted||paused||disposed)return
      try{
        const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),now=context.currentTime
        source.buffer=noise;source.playbackRate.value=.85+(index%4)*.08
        filter.type='bandpass';filter.frequency.value=2100+(index%7)*140;filter.Q.value=.7
        gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.18,now+.006)
        gain.gain.exponentialRampToValueAtTime(.0001,now+.065)
        source.connect(filter);filter.connect(gain);gain.connect(context.destination);playing.add(source)
        source.onended=()=>{playing.delete(source);source.disconnect();filter.disconnect();gain.disconnect()}
        source.start(now);source.stop(now+.075)
      }catch{}
    },
    setMuted(value:boolean){muted=value},
    setPaused(value:boolean){paused=value;if(context){if(value)void context.suspend().catch(()=>{});else void context.resume().catch(()=>{})}},
    dispose(){disposed=true;for(const source of playing){try{source.stop()}catch{}}playing.clear();if(context)void context.close().catch(()=>{});context=null;noise=null},
  }
}
