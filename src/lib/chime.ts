// The lesson's sounds, made on the spot with WebAudio: a soft "goed zo" and a short tune at the end.
// No files, no library. Off when he switched sound off in Instellingen (kept on this computer).

export const SOUND_KEY = 'cockpit-sound'

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

let ctx: AudioContext | null = null

function tone(audio: AudioContext, freq: number, at: number, length = 0.14, volume = 0.08) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, audio.currentTime + at)
  gain.gain.linearRampToValueAtTime(volume, audio.currentTime + at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + length)
  osc.connect(gain).connect(audio.destination)
  osc.start(audio.currentTime + at)
  osc.stop(audio.currentTime + at + length + 0.02)
}

/** "good": two rising notes. "done": a short tune for the end of the lesson. */
export function chime(kind: 'good' | 'done'): void {
  if (typeof window === 'undefined' || !soundOn()) return
  try {
    ctx ??= new AudioContext()
    const notes = kind === 'good' ? [660, 880] : [523, 659, 784, 1047]
    notes.forEach((f, i) => tone(ctx!, f, i * (kind === 'good' ? 0.09 : 0.11)))
  } catch {
    // No sound is fine.
  }
}
