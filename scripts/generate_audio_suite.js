const fs = require('fs');
const path = require('path');

const PUBLIC_AUDIO = path.join(__dirname, '..', 'public', 'audio');
const ROOT_AUDIO = path.join(__dirname, '..', 'audio');

if (!fs.existsSync(PUBLIC_AUDIO)) fs.mkdirSync(PUBLIC_AUDIO, { recursive: true });
if (!fs.existsSync(ROOT_AUDIO)) fs.mkdirSync(ROOT_AUDIO, { recursive: true });

// Helper to write standard 16-bit mono WAV file
function writeWav(filePath, samples, sampleRate = 44100) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * numChannels * bitsPerSample/8)
  buffer.writeUInt16LE(2, 32); // block align (numChannels * bitsPerSample/8)
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // samples
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  // Also copy to root audio folder
  const baseName = path.basename(filePath);
  fs.writeFileSync(path.join(ROOT_AUDIO, baseName), buffer);
}

// Read raw PCM samples from existing TTS WAV
function readWav(filePath) {
  const buf = fs.readFileSync(filePath);
  const sampleRate = buf.readUInt32LE(24);
  const channels = buf.readUInt16LE(22);
  const bitsPerSample = buf.readUInt16LE(34);

  let dataOffset = 12;
  while (dataOffset < buf.length) {
    const id = buf.toString('ascii', dataOffset, dataOffset + 4);
    const size = buf.readUInt32LE(dataOffset + 4);
    if (id === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + size;
  }

  const numSamples = Math.floor((buf.length - dataOffset) / (2 * channels));
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const s = buf.readInt16LE(dataOffset + i * 2 * channels);
    samples[i] = s / 32768.0;
  }

  return { samples, sampleRate };
}

// Resample audio to 44100 Hz
function resample(samples, oldRate, newRate = 44100) {
  if (oldRate === newRate) return samples;
  const ratio = oldRate / newRate;
  const newLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(samples.length - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    out[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }
  return out;
}

// DSP: Bandpass filter (simple biquad approximation)
function bandpass(samples, sampleRate, fLow = 400, fHigh = 3200) {
  const out = new Float32Array(samples.length);
  const dt = 1 / sampleRate;
  // High pass filter
  const rcHigh = 1 / (2 * Math.PI * fLow);
  const alphaHigh = rcHigh / (rcHigh + dt);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < samples.length; i++) {
    const hp = alphaHigh * (prevOut + samples[i] - prevIn);
    prevIn = samples[i];
    prevOut = hp;
    out[i] = hp;
  }
  // Low pass filter
  const rcLow = 1 / (2 * Math.PI * fHigh);
  const alphaLow = dt / (rcLow + dt);
  let lpPrev = 0;
  for (let i = 0; i < out.length; i++) {
    lpPrev += alphaLow * (out[i] - lpPrev);
    out[i] = lpPrev;
  }
  return out;
}

// DSP: Apply naval military radio distortion & comms effect
function makeRadioVoice(rawSamples, sampleRate = 44100) {
  // 1. Resample to 44100 if needed
  let s = resample(rawSamples, sampleRate, 44100);
  const sr = 44100;

  // 2. Bandpass 380 Hz to 3300 Hz
  s = bandpass(s, sr, 380, 3300);

  // 3. Radio mic chirp at start (35 ms dual tone)
  const chirpLen = Math.floor(sr * 0.045);
  const clickLen = Math.floor(sr * 0.035);
  const totalLen = chirpLen + s.length + clickLen + Math.floor(sr * 0.05);
  const out = new Float32Array(totalLen);

  // Lead-in radio squelch burst + dual chirp
  for (let i = 0; i < chirpLen; i++) {
    const t = i / sr;
    const tone1 = Math.sin(2 * Math.PI * 1850 * t);
    const tone2 = Math.sin(2 * Math.PI * 1200 * t);
    const burstNoise = (Math.random() * 2 - 1) * 0.15;
    const env = Math.sin((i / chirpLen) * Math.PI);
    out[i] = (tone1 * 0.2 + tone2 * 0.15 + burstNoise) * env * 0.7;
  }

  // Voice body with mild radio overdrive / saturation and faint static
  for (let i = 0; i < s.length; i++) {
    let v = s[i] * 1.5; // drive
    // Soft saturation curve: tanh-like
    v = Math.tanh(v * 1.35);
    // Tiny background white noise floor typical of VHF naval radio
    const radioNoise = (Math.random() * 2 - 1) * 0.015;
    out[chirpLen + i] = v * 0.85 + radioNoise;
  }

  // Tail mic release click
  const tailOffset = chirpLen + s.length;
  for (let i = 0; i < clickLen; i++) {
    const t = i / sr;
    const click = Math.sin(2 * Math.PI * 920 * t) * Math.exp(-t * 90);
    const squelch = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.25;
    out[tailOffset + i] = (click * 0.4 + squelch) * 0.8;
  }

  return out;
}

// -------------------------------------------------------------
// PURE CINEMATIC SOUND EFFECTS SYNTHESIS
// -------------------------------------------------------------

// Synthesize Missile Launch SFX (Pneumatic Thoomp + Ignition Roar + Rocket Whoosh)
function synthMissileLaunch(sr = 44100) {
  const dur = 1.8;
  const num = Math.floor(sr * dur);
  const out = new Float32Array(num);

  for (let i = 0; i < num; i++) {
    const t = i / sr;
    let s = 0;

    // 1. Launch tube pneumatic thoomp (0.0 to 0.25s)
    if (t < 0.3) {
      const thoompFreq = 220 * Math.exp(-t * 18) + 38;
      const thoompEnv = Math.exp(-t * 14);
      const thoomp = Math.sin(2 * Math.PI * thoompFreq * t) * thoompEnv;
      const tubeNoise = (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.4;
      s += (thoomp * 0.9 + tubeNoise) * 0.8;
    }

    // 2. Rocket motor ignition & solid fuel roar (starts at 0.08s)
    if (t >= 0.06) {
      const rt = t - 0.06;
      const ignEnv = Math.min(1, rt * 8) * Math.exp(-rt * 1.8);
      // Rising pitch roar
      const motorFreq = 65 + Math.min(180, rt * 160);
      const motorSaw = (2 * ((motorFreq * rt) % 1) - 1) * 0.3;
      // Filtered rushing fire noise
      const fireNoise = (Math.random() * 2 - 1) * 0.65;
      // High speed thrust hiss
      const hiss = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 4500 * rt) * 0.25;
      s += (motorSaw * 0.35 + fireNoise * 0.5 + hiss * 0.25) * ignEnv * 0.85;
    }

    // 3. Supersonic air rip & flyoff whoosh (peaks at 0.3s)
    if (t >= 0.12) {
      const wt = t - 0.12;
      const whooshEnv = Math.sin(Math.min(Math.PI, wt * 2.2));
      const whooshNoise = (Math.random() * 2 - 1) * whooshEnv * 0.4;
      s += whooshNoise * 0.5;
    }

    out[i] = Math.tanh(s * 1.2) * 0.95;
  }

  return out;
}

// Synthesize Missile Impact SFX (Detonation Punch + Sub Boom + Debris & Sea Splash)
function synthMissileImpact(sr = 44100) {
  const dur = 2.4;
  const num = Math.floor(sr * dur);
  const out = new Float32Array(num);

  for (let i = 0; i < num; i++) {
    const t = i / sr;
    let s = 0;

    // 1. Initial shockwave crack (0 to 0.08s)
    if (t < 0.15) {
      const crackEnv = Math.exp(-t * 45);
      const crackNoise = (Math.random() * 2 - 1) * crackEnv * 0.9;
      const crackTone = Math.sin(2 * Math.PI * (1200 * Math.exp(-t * 60)) * t) * crackEnv;
      s += (crackNoise * 0.6 + crackTone * 0.5);
    }

    // 2. Punchy sub-bass explosion thump (0 to 0.9s)
    const boomFreq = 160 * Math.exp(-t * 7) + 26;
    const boomEnv = Math.exp(-t * 2.4);
    const subBoom = Math.sin(2 * Math.PI * boomFreq * t) * boomEnv;

    // 3. Hull metal tearing & blast rumble (0.02 to 1.5s)
    const rumbleNoise = (Math.random() * 2 - 1) * Math.exp(-t * 1.6);
    const metalTear = Math.sin(2 * Math.PI * 480 * Math.exp(-t * 3) * t) * Math.exp(-t * 4) * 0.4;

    // 4. Distant blast tail & shockwave rolling over water
    const tailEnv = Math.exp(-t * 1.2) * Math.max(0, 1 - Math.exp(-t * 5));
    const tailNoise = (Math.random() * 2 - 1) * tailEnv * 0.35;

    s += subBoom * 0.75 + rumbleNoise * 0.4 + metalTear * 0.3 + tailNoise * 0.3;

    out[i] = Math.tanh(s * 1.15) * 0.95;
  }

  return out;
}

// Combine SFX + Voice for Hybrid Action Movie Experience
function combineHybrid(sfx, voice, voiceDelaySec = 0.25, sr = 44100) {
  const delaySamples = Math.floor(voiceDelaySec * sr);
  const totalLen = Math.max(sfx.length, delaySamples + voice.length);
  const out = new Float32Array(totalLen);

  for (let i = 0; i < totalLen; i++) {
    const s = (i < sfx.length ? sfx[i] * 0.75 : 0);
    const vIdx = i - delaySamples;
    const v = (vIdx >= 0 && vIdx < voice.length ? voice[vIdx] * 0.8 : 0);
    out[i] = Math.tanh((s + v) * 0.95);
  }

  return out;
}

// -------------------------------------------------------------
// MAIN GENERATION SUITE
// -------------------------------------------------------------
console.log('--- Processing Audio Suite ---');

const voiceMap = {
  launch_fox_two_david: 'launch_fox_two_david.wav',
  launch_fox_two_zira: 'launch_fox_two_zira.wav',
  launch_missile_away_david: 'launch_missile_away_david.wav',
  launch_missile_away_zira: 'launch_missile_away_zira.wav',
  launch_firing_david: 'launch_firing_david.wav',
  launch_firing_zira: 'launch_firing_zira.wav',
  impact_direct_hit_david: 'impact_direct_hit_david.wav',
  impact_direct_hit_zira: 'impact_direct_hit_zira.wav',
  impact_destroyed_david: 'impact_destroyed_david.wav',
  impact_destroyed_zira: 'impact_destroyed_zira.wav',
  impact_confirmed_david: 'impact_confirmed_david.wav',
  impact_confirmed_zira: 'impact_confirmed_zira.wav',
};

const processedVoices = {};

for (const [key, filename] of Object.entries(voiceMap)) {
  const fullPath = path.join(PUBLIC_AUDIO, filename);
  if (fs.existsSync(fullPath)) {
    const { samples, sampleRate } = readWav(fullPath);
    const radioSamples = makeRadioVoice(samples, sampleRate);
    const outName = `radio_${filename}`;
    const outPath = path.join(PUBLIC_AUDIO, outName);
    writeWav(outPath, radioSamples, 44100);
    processedVoices[key] = radioSamples;
    console.log(`Generated: ${outName}`);
  }
}

// Generate Pure SFX
const launchSfx = synthMissileLaunch(44100);
writeWav(path.join(PUBLIC_AUDIO, 'sfx_missile_launch.wav'), launchSfx, 44100);
console.log('Generated: sfx_missile_launch.wav');

const impactSfx = synthMissileImpact(44100);
writeWav(path.join(PUBLIC_AUDIO, 'sfx_missile_impact.wav'), impactSfx, 44100);
console.log('Generated: sfx_missile_impact.wav');

// Generate Combined Hybrids
if (processedVoices.launch_fox_two_david) {
  const hybridLaunch1 = combineHybrid(launchSfx, processedVoices.launch_fox_two_david, 0.22, 44100);
  writeWav(path.join(PUBLIC_AUDIO, 'hybrid_missile_launch_fox2.wav'), hybridLaunch1, 44100);
  console.log('Generated: hybrid_missile_launch_fox2.wav');
}

if (processedVoices.launch_missile_away_zira) {
  const hybridLaunch2 = combineHybrid(launchSfx, processedVoices.launch_missile_away_zira, 0.20, 44100);
  writeWav(path.join(PUBLIC_AUDIO, 'hybrid_missile_launch_zira.wav'), hybridLaunch2, 44100);
  console.log('Generated: hybrid_missile_launch_zira.wav');
}

if (processedVoices.impact_direct_hit_david) {
  const hybridImpact1 = combineHybrid(impactSfx, processedVoices.impact_direct_hit_david, 0.32, 44100);
  writeWav(path.join(PUBLIC_AUDIO, 'hybrid_missile_impact_direct_hit.wav'), hybridImpact1, 44100);
  console.log('Generated: hybrid_missile_impact_direct_hit.wav');
}

if (processedVoices.impact_destroyed_zira) {
  const hybridImpact2 = combineHybrid(impactSfx, processedVoices.impact_destroyed_zira, 0.30, 44100);
  writeWav(path.join(PUBLIC_AUDIO, 'hybrid_missile_impact_zira.wav'), hybridImpact2, 44100);
  console.log('Generated: hybrid_missile_impact_zira.wav');
}

console.log('Audio processing complete! All files saved in public/audio/ and audio/');
