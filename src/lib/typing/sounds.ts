// Procedural sound effects via Web Audio API — no asset files needed.
// AudioContext must be initialized from a user gesture; we lazy-init on the
// first call to play() and gracefully no-op if the browser blocks it.

type SfxName = 'correct' | 'wrong' | 'lifeLost' | 'levelClear' | 'gameOver' | 'start' | 'tick'

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

function envTone(
  c: AudioContext,
  freq: number,
  startAt: number,
  durMs: number,
  type: OscillatorType = 'sine',
  peakGain = 0.18,
  freqEnd?: number,
) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + durMs / 1000)
  }
  // ADSR — short attack, exponential decay
  g.gain.setValueAtTime(0.0001, startAt)
  g.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + durMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + durMs / 1000 + 0.02)
}

function noiseBurst(c: AudioContext, startAt: number, durMs: number, gain = 0.12) {
  const buf = c.createBuffer(1, Math.floor((c.sampleRate * durMs) / 1000), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = gain
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1800
  src.connect(filter).connect(g).connect(c.destination)
  src.start(startAt)
}

export function setMuted(v: boolean) {
  muted = v
}
export function isMuted(): boolean {
  return muted
}

export function play(name: SfxName) {
  if (muted) return
  const c = getCtx()
  if (!c) return
  // Resume if suspended (Chrome autoplay policy)
  if (c.state === 'suspended') c.resume().catch(() => {})
  const now = c.currentTime
  switch (name) {
    case 'correct':
      // Short chirp 660 → 990 Hz
      envTone(c, 660, now, 80, 'triangle', 0.15, 990)
      break
    case 'wrong':
      // Buzz, low square
      envTone(c, 220, now, 130, 'square', 0.12, 110)
      noiseBurst(c, now, 80, 0.06)
      break
    case 'lifeLost':
      // Descending sad swoop
      envTone(c, 420, now, 320, 'sawtooth', 0.16, 130)
      envTone(c, 220, now + 0.07, 260, 'sine', 0.1, 90)
      break
    case 'levelClear':
      // Ascending 3-note arpeggio
      envTone(c, 523, now, 130, 'triangle', 0.16) // C5
      envTone(c, 659, now + 0.1, 130, 'triangle', 0.16) // E5
      envTone(c, 784, now + 0.2, 200, 'triangle', 0.18) // G5
      envTone(c, 1047, now + 0.32, 320, 'triangle', 0.2) // C6
      break
    case 'gameOver':
      // Descending minor arpeggio
      envTone(c, 392, now, 220, 'sawtooth', 0.15) // G4
      envTone(c, 311, now + 0.18, 220, 'sawtooth', 0.15) // Eb4
      envTone(c, 261, now + 0.36, 260, 'sawtooth', 0.15) // C4
      envTone(c, 196, now + 0.56, 420, 'sawtooth', 0.18, 150) // G3 → drop
      break
    case 'start':
      envTone(c, 392, now, 90, 'triangle', 0.14)
      envTone(c, 523, now + 0.07, 120, 'triangle', 0.16)
      break
    case 'tick':
      envTone(c, 1200, now, 28, 'square', 0.06)
      break
  }
}

/** Call once on user gesture to prime AudioContext (no audible sound). */
export function prime() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
}
