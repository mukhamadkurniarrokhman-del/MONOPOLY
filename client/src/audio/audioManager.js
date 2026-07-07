// Manajer audio: seluruh SFX disintesis Web Audio API — tanpa file aset.
// Konteks dibuat malas & di-unlock oleh gestur pengguna pertama (kebijakan autoplay).

let ctx = null;
let master = null;
let ambienceStarted = false;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('antariksa_muted') === '1';
const lastPlayed = {}; // rate-limit per nama sfx

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlock() {
  try {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (!ambienceStarted && ctx.state !== 'closed') {
      ambienceStarted = true;
      startAmbience();
    }
  } catch {}
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  localStorage.setItem('antariksa_muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 1;
}

function limited(name, ms) {
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < ms) return true;
  lastPlayed[name] = now;
  return false;
}

// ---------- blok pembangun sintesis ----------

function tone({ freq, type = 'sine', dur = 0.15, vol = 0.2, sweepTo = 0, delay = 0 }) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuffer = null;
function getNoiseBuffer() {
  if (!noiseBuffer) {
    const len = ctx.sampleRate * 1.5;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseHit({ dur = 0.2, vol = 0.2, freq = 1000, q = 1, sweepTo = 0, type = 'bandpass', delay = 0 }) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// ---------- ambience luar angkasa ----------

function startAmbience() {
  if (!ctx) return;
  // desis kosmik: noise -> lowpass yang berayun pelan
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer();
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(lp.frequency);
  const g1 = ctx.createGain();
  g1.gain.value = 0.035;
  src.connect(lp).connect(g1).connect(master);
  src.start();
  lfo.start();
  // dengung dalam: dua sinus nyaris selaras
  for (const f of [55, 55.6]) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.018;
    o.connect(g).connect(master);
    o.start();
  }
}

// ---------- SFX ----------

export const sfx = {
  click() {
    if (limited('click', 60)) return;
    tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.06 });
  },
  diceThrow() {
    noiseHit({ dur: 0.3, vol: 0.12, freq: 2400, sweepTo: 700, q: 0.8 });
  },
  diceHit() {
    if (limited('diceHit', 70)) return;
    noiseHit({ dur: 0.07, vol: 0.18, freq: 1800 + Math.random() * 800, q: 2 });
    tone({ freq: 160 + Math.random() * 60, type: 'sine', dur: 0.08, vol: 0.12 });
  },
  thrust() {
    if (limited('thrust', 140)) return;
    noiseHit({ dur: 0.28, vol: 0.14, freq: 500, sweepTo: 1800, q: 1.2 });
  },
  land() {
    tone({ freq: 220, type: 'sine', dur: 0.14, vol: 0.14, sweepTo: 90 });
  },
  card() {
    noiseHit({ dur: 0.18, vol: 0.08, freq: 3200, sweepTo: 5200, q: 3, type: 'highpass' });
    tone({ freq: 1240, type: 'triangle', dur: 0.16, vol: 0.08, sweepTo: 1860, delay: 0.03 });
  },
  money() {
    tone({ freq: 1318, type: 'sine', dur: 0.1, vol: 0.14 });
    tone({ freq: 1760, type: 'sine', dur: 0.16, vol: 0.14, delay: 0.08 });
  },
  pay() {
    tone({ freq: 520, type: 'triangle', dur: 0.12, vol: 0.12, sweepTo: 320 });
  },
  gavel() {
    tone({ freq: 200, type: 'square', dur: 0.09, vol: 0.16, sweepTo: 120 });
    noiseHit({ dur: 0.08, vol: 0.12, freq: 1200, q: 1.5, delay: 0.01 });
  },
  bid() {
    if (limited('bid', 150)) return;
    tone({ freq: 990, type: 'sine', dur: 0.07, vol: 0.1 });
  },
  trade() {
    tone({ freq: 740, type: 'sine', dur: 0.1, vol: 0.1 });
    tone({ freq: 988, type: 'sine', dur: 0.12, vol: 0.1, delay: 0.09 });
  },
  deny() {
    tone({ freq: 180, type: 'sawtooth', dur: 0.18, vol: 0.1 });
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.14, delay: i * 0.13 })
    );
  },
};

// Pasang sekali: unlock via gestur + blip untuk semua klik tombol UI.
let initialized = false;
export function initAudio() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('button')) sfx.click();
  });
}
