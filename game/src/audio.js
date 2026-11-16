// Sparkhollow sound: every effect is synthesised with WebAudio, so the game
// ships no audio files. A single lazy context wakes on the first gesture that
// starts a run; a master gain keeps the mix tame and M mutes it.

let context = null;
let master = null;
let noiseBuffer = null;
let muted = false;

/** Create the context on first use; safe to call before any gesture. */
function wake() {
  if (context !== null) return context;
  const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
  if (AudioCtor === undefined) return null;
  context = new AudioCtor();
  master = context.createGain();
  master.gain.value = muted ? 0 : 0.42;
  master.connect(context.destination);
  const length = context.sampleRate * 0.5;
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  return context;
}

/** Resume a context the browser suspended; called on start gestures. */
export function unlockAudio() {
  const ctx = wake();
  if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(value) {
  muted = value;
  if (master !== null && context !== null) {
    master.gain.setTargetAtTime(muted ? 0 : 0.42, context.currentTime, 0.01);
  }
}

export function isMuted() {
  return muted;
}

/** One oscillator blip: frequency glides from `from` to `to` over `seconds`. */
function blip(type, from, to, seconds, volume, delay = 0) {
  const ctx = wake();
  if (ctx === null || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, to), start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

/** One filtered noise burst, for deaths, hits and the nova. */
function burst(seconds, volume, filterFrom, filterTo, delay = 0) {
  const ctx = wake();
  if (ctx === null || muted) return;
  const start = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrom, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
  source.connect(filter).connect(gain).connect(master);
  source.start(start);
  source.stop(start + seconds + 0.02);
}

export const sfx = {
  shoot() {
    blip('square', 880 + Math.random() * 120, 340, 0.07, 0.05);
  },
  hit() {
    blip('square', 300, 190, 0.05, 0.07);
  },
  die(big) {
    burst(big ? 0.34 : 0.2, big ? 0.3 : 0.18, 2600, 160);
    blip('triangle', big ? 220 : 330, 55, big ? 0.32 : 0.2, 0.16);
  },
  pickup() {
    blip('sine', 660, 660, 0.07, 0.12);
    blip('sine', 990, 990, 0.1, 0.12, 0.06);
  },
  heart() {
    blip('sine', 523, 523, 0.09, 0.14);
    blip('sine', 659, 659, 0.09, 0.14, 0.08);
    blip('sine', 784, 784, 0.16, 0.14, 0.16);
  },
  hurt() {
    blip('sawtooth', 200, 60, 0.28, 0.22);
    burst(0.2, 0.16, 1200, 200);
  },
  nova() {
    blip('sine', 180, 1400, 0.4, 0.2);
    burst(0.45, 0.26, 3600, 120);
  },
  chargeReady() {
    blip('sine', 1046, 1046, 0.08, 0.1);
    blip('sine', 1568, 1568, 0.14, 0.1, 0.07);
  },
  wave() {
    blip('triangle', 392, 392, 0.1, 0.14);
    blip('triangle', 523, 523, 0.1, 0.14, 0.09);
    blip('triangle', 659, 659, 0.18, 0.14, 0.18);
  },
  clear() {
    blip('sine', 587, 587, 0.09, 0.12);
    blip('sine', 880, 880, 0.2, 0.12, 0.08);
  },
  win() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((note, index) => blip('triangle', note, note, 0.24, 0.15, index * 0.11));
  },
  lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((note, index) => blip('triangle', note, note * 0.97, 0.3, 0.14, index * 0.16));
  },
  click() {
    blip('sine', 740, 740, 0.05, 0.08);
  },
};
