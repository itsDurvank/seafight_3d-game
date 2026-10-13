// Boom Boats sound. Everything is synthesized live with the Web Audio API, so there are no sound files to ship.
// Browsers only allow audio after a click or key press; main.js calls audio.init() on the first one.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let ctx = null, master = null, noiseBuf = null;
let muted = false;
let engine = null, rush = null, rev = null;
let beat = 0;
const L = { x: 0, z: 0, yaw: 0 }; // where the "ears" are (the player's boat + camera heading)
const last = {};

const ok = (key, ms) => {
  const n = performance.now();
  if (n - (last[key] || 0) < ms) return false;
  last[key] = n;
  return true;
};

// Output for one sound. With a position it gets quieter with distance and pans left/right.
function bus(x, z, base = 1, wet = 0) {
  let g = base, pan = 0;
  if (x != null) {
    const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
    if (d > 700) return null;
    g *= 1 / (1 + (d / 90) * (d / 90));
    if (d > 1) pan = (dx * -Math.cos(L.yaw) + dz * Math.sin(L.yaw)) / d; // +1 = right of the camera
  }
  if (g < 0.012) return null;
  const gn = ctx.createGain();
  gn.gain.value = g;
  if (ctx.createStereoPanner) {
    const sp = ctx.createStereoPanner();
    sp.pan.value = clamp(pan * 0.8, -1, 1);
    gn.connect(sp);
    sp.connect(master);
  } else gn.connect(master);
  if (wet > 0 && rev) { // a little room echo makes explosions feel huge
    const w = ctx.createGain();
    w.gain.value = wet;
    gn.connect(w); w.connect(rev);
  }
  return gn;
}

function tone(dest, type, f0, f1, dur, vol, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dest, type, f0, f1, dur, vol, q = 1, delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.03);
}

function loopNoise(type, freq, q) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(master);
  s.start();
  return { f, g };
}

function startLoops() {
  // gentle sea ambience that slowly swells
  const sea = loopNoise('lowpass', 380, 0.7);
  sea.g.gain.value = 0.05;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.13; lg.gain.value = 0.025;
  lfo.connect(lg); lg.connect(sea.g.gain); lfo.start();

  // engine hum (pitch follows speed) + water rush
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square';
  o1.frequency.value = 40; o2.frequency.value = 20;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 240;
  const g = ctx.createGain();
  g.gain.value = 0;
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
  o1.start(); o2.start();
  engine = { o1, o2, lp, g };
  rush = loopNoise('bandpass', 500, 0.8);
}

export const audio = {
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    // reverb: a decaying burst of noise
    const len = Math.floor(ctx.sampleRate * 1.8);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = imp.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    rev = ctx.createConvolver();
    rev.buffer = imp;
    const rg = ctx.createGain();
    rg.gain.value = 0.6;
    rev.connect(rg); rg.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startLoops();
  },

  toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05);
    return muted;
  },

  setListener(x, z, yaw) { L.x = x; L.z = z; L.yaw = yaw; },

  // called every frame: engine pitch, water rush, low-health heartbeat
  update(dt, st) {
    if (!ctx || !engine) return;
    const t = ctx.currentTime;
    const sp = st.alive ? Math.abs(st.speed) : 0;
    const f = clamp(sp / 160, 0, 1);
    const b = st.boosting ? 1 : 0;
    engine.o1.frequency.setTargetAtTime(38 + sp * 0.9 + b * 18, t, 0.1);
    engine.o2.frequency.setTargetAtTime((38 + sp * 0.9) / 2, t, 0.1);
    engine.lp.frequency.setTargetAtTime(220 + f * 500 + b * 300, t, 0.15);
    engine.g.gain.setTargetAtTime(st.alive ? 0.035 + f * 0.06 + b * 0.03 : 0, t, 0.15);
    rush.f.frequency.setTargetAtTime(500 + sp * 9, t, 0.12);
    rush.g.gain.setTargetAtTime(st.alive ? f * f * 0.12 + b * 0.05 : 0, t, 0.12);

    if (st.alive && st.hpFrac < 0.25 && !muted) {
      beat -= dt;
      if (beat <= 0) {
        beat = 0.6 + st.hpFrac * 2;
        const d = bus(null, null, 0.8);
        tone(d, 'sine', 75, 45, 0.14, 0.55);
        tone(d, 'sine', 70, 42, 0.12, 0.4, 0.17);
      }
    } else beat = 0;
  },

  gun(x, z, mine) {
    if (!ctx || muted) return;
    if (!mine && !ok('ge', 45)) return;
    const d = bus(x, z, mine ? 0.5 : 0.35);
    if (!d) return;
    const j = 0.85 + Math.random() * 0.3;
    noise(d, 'bandpass', 2200 * j, 900 * j, 0.06, 0.55, 1.2);
    tone(d, 'square', 260 * j, 90, 0.07, 0.22);
  },

  // rocket launch: pressurised "thoomp", latch snap, motor ignition roaring up into a hiss as it flies off, sparks
  missile(x, z, mine) {
    if (!ctx || muted) return;
    const d = bus(x, z, mine ? 0.95 : 0.7, 0.25);
    if (!d) return;
    // launch tube thoomp
    tone(d, 'sine', 210, 38, 0.3, 0.9);
    noise(d, 'lowpass', 1800, 140, 0.22, 0.9, 0.7);
    // release latch: a sharp snap with a metallic ring
    noise(d, 'bandpass', 3400, 2400, 0.03, 0.55, 3);
    tone(d, 'triangle', 2600, 1500, 0.06, 0.15);
    // motor ignites: a rising roar that thins to a hiss while the missile flies away
    tone(d, 'sawtooth', 55, 200, 0.55, 0.22, 0.04);
    noise(d, 'bandpass', 380, 2800, 0.5, 0.95, 0.8, 0.03);
    noise(d, 'highpass', 1800, 5600, 1.0, 0.4, 0.5, 0.14);
    noise(d, 'lowpass', 700, 220, 1.1, 0.45, 0.8, 0.1);
    for (let k = 0; k < 5; k++) noise(d, 'highpass', 3500, 3000, 0.03, 0.22, 1, 0.1 + k * 0.1 + Math.random() * 0.05);
  },

  // fighter-jet lock tone when you fire: a rising double chirp when a target is locked, a dull blip when it is not
  lock(locked) {
    if (!ctx || muted) return;
    const d = bus(null, null, 0.4);
    if (locked) {
      tone(d, 'sine', 1100, 1500, 0.07, 0.3);
      tone(d, 'sine', 1500, 1900, 0.09, 0.3, 0.1);
    } else {
      tone(d, 'triangle', 300, 220, 0.12, 0.25);
    }
  },

  // a missile going off: sharp crack, punchy thump, deep sub boom, rolling shockwave tail, debris and a splash,
  // and on a direct boat hit a crunch of tearing metal with a clang
  missileHit(x, z, direct) {
    if (!ctx || muted || !ok('mhit', 70)) return;
    const d = bus(x, z, 1.0, 0.4);
    if (!d) return;
    noise(d, 'highpass', 5000, 2500, 0.04, 1.0, 0.8); // crack
    tone(d, 'sine', 230, 28, 0.5, 1.0); // punch
    tone(d, 'sine', 70, 22, 1.3, 0.85, 0.03); // sub boom
    noise(d, 'lowpass', 2600, 80, 1.0, 1.0, 0.7); // body of the blast
    noise(d, 'bandpass', 900, 200, 0.35, 0.6, 0.9, 0.05); // mid-range punch
    noise(d, 'lowpass', 300, 40, 1.7, 0.45, 0.8, 0.15); // shockwave rolling away
    noise(d, 'bandpass', 1800, 600, 0.5, 0.35, 0.6, 0.25); // water splash
    for (let k = 0; k < 8; k++) noise(d, 'highpass', 3000, 1800, 0.06, 0.18, 1, 0.2 + Math.random() * 0.9); // debris
    if (direct) {
      for (const [f, dl] of [[1100, 0], [1700, 0.04], [2600, 0.09], [800, 0.14]]) noise(d, 'bandpass', f, f * 0.7, 0.16, 0.6, 10, dl);
      tone(d, 'square', 500, 90, 0.25, 0.22, 0.02);
      tone(d, 'sawtooth', 260, 50, 0.45, 0.2, 0.06);
      tone(d, 'triangle', 1400, 500, 0.35, 0.14, 0.05); // hull clang
    }
  },

  // a bullet pinging off a hull
  clank(x, z) {
    if (!ctx || muted || !ok('clank', 35)) return;
    const d = bus(x, z, 0.4);
    if (!d) return;
    noise(d, 'bandpass', 2800, 1800, 0.05, 0.6, 6);
    tone(d, 'square', 1300, 900, 0.05, 0.12);
    tone(d, 'sine', 180, 70, 0.07, 0.3);
  },

  // every explosion, sized by its radius: bullet tick, medium bang or a missile blast
  blast(x, z, radius) {
    if (!ctx || muted) return;
    if (radius < 3) {
      if (!ok('tick', 30)) return;
      const d = bus(x, z, 0.35);
      if (!d) return;
      noise(d, 'bandpass', 1500, 500, 0.07, 0.5, 1);
      tone(d, 'sine', 150, 60, 0.08, 0.3);
    } else if (radius < 8) {
      if (!ok('bang', 60)) return;
      const d = bus(x, z, 0.7);
      if (!d) return;
      noise(d, 'lowpass', 1400, 200, 0.35, 0.8);
      tone(d, 'sine', 130, 40, 0.3, 0.7);
    } else {
      if (!ok('blast', 80)) return;
      const d = bus(x, z, 0.9);
      if (!d) return;
      noise(d, 'lowpass', 1000, 120, 0.6, 0.9);
      tone(d, 'sine', 100, 30, 0.6, 0.9);
    }
  },

  // a boat blowing up: huge boom, tearing metal, secondary pops, debris raining down
  boom(x, z, size = 1) {
    if (!ctx || muted) return;
    const d = bus(x, z, 0.85 + 0.2 * size, 0.4);
    if (!d) return;
    noise(d, 'lowpass', 1500, 55, 1.3, 1);
    tone(d, 'sine', 90, 22, 1.2, 1);
    tone(d, 'sine', 55, 20, 1.4, 0.8, 0.05);
    noise(d, 'bandpass', 3500, 600, 0.5, 0.5, 1, 0.04);
    for (const [f, dl] of [[900, 0.05], [1600, 0.1], [2600, 0.16], [650, 0.22]]) noise(d, 'bandpass', f, f * 0.65, 0.18, 0.55, 9, dl);
    tone(d, 'sawtooth', 260, 55, 0.6, 0.2, 0.1);
    tone(d, 'sine', 140, 50, 0.25, 0.6, 0.35); // secondary pop
    noise(d, 'lowpass', 400, 50, 1.8, 0.45, 0.8, 0.2);
    for (let k = 0; k < 10; k++) noise(d, 'highpass', 2500, 1700, 0.05, 0.18, 1, 0.3 + Math.random() * 1.1);
  },

  // boost whoosh: yours (no position) or an enemy's (heard from where it is)
  boost(on, x, z) {
    if (!ctx || muted) return;
    const d = bus(x, z, x == null ? 0.55 : 0.4);
    if (!d) return;
    if (on) {
      noise(d, 'bandpass', 300, 3500, 0.55, 0.9, 1.2);
      tone(d, 'sawtooth', 80, 280, 0.5, 0.25);
    } else {
      noise(d, 'bandpass', 2500, 250, 0.45, 0.6, 1.2);
      tone(d, 'sawtooth', 240, 70, 0.4, 0.2);
    }
  },

  hurt() {
    if (!ctx || muted || !ok('hurt', 90)) return;
    const d = bus(null, null, 0.7);
    tone(d, 'sawtooth', 170, 80, 0.2, 0.45);
    noise(d, 'lowpass', 900, 200, 0.15, 0.6);
  },

  kill() {
    if (!ctx || muted) return;
    const d = bus(null, null, 0.5);
    [523, 659, 784, 1047].forEach((f, i) => tone(d, 'sine', f, f, 0.25, 0.35, i * 0.07));
  },

  sink() {
    if (!ctx || muted) return;
    tone(bus(null, null, 0.5), 'sawtooth', 300, 40, 1.0, 0.35);
  },

  respawn() {
    if (!ctx || muted) return;
    const d = bus(null, null, 0.5);
    tone(d, 'sine', 330, 660, 0.4, 0.3);
    tone(d, 'sine', 660, 990, 0.4, 0.3, 0.15);
  },

  // grabbing a health potion: a bubbly rising chime
  potion() {
    if (!ctx || muted) return;
    const d = bus(null, null, 0.5);
    [392, 523, 659, 784].forEach((f, i) => tone(d, 'sine', f, f * 1.04, 0.22, 0.3, i * 0.06));
  },

  // Space: water scrubbing off speed
  brake() {
    if (!ctx || muted || !ok('brake', 300)) return;
    const d = bus(null, null, 0.45);
    noise(d, 'highpass', 3000, 900, 0.4, 0.35, 0.7);
    tone(d, 'sawtooth', 300, 120, 0.25, 0.1);
  },

  // an enemy missile has locked onto you: two sharp beeps
  warn() {
    if (!ctx || muted || !ok('warn', 600)) return;
    const d = bus(null, null, 0.4);
    tone(d, 'square', 960, 960, 0.1, 0.3);
    tone(d, 'square', 960, 960, 0.1, 0.3, 0.16);
  },

  click() {
    if (!ctx || muted) return;
    tone(bus(null, null, 0.4), 'square', 900, 700, 0.04, 0.15);
  },

  ready() {
    if (!ctx || muted) return;
    tone(bus(null, null, 0.35), 'sine', 880, 1200, 0.08, 0.2);
  },
};
