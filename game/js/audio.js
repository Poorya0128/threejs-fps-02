// SALTLINE audio.js — WebAudio synth, no files (§12b). Buffers are
import { WEAPONS } from './config.js';
let ctx = null, master = null, noiseBuf = null;
const seen = { reload: 0, dry: 0, hitT: -1, boom: 0, ring: 0, bounce: Array(8).fill(false), noiseIdx: 0, round: 1, phase: 'live', planted: false, beepT: 0 };

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const amb = ctx.createBufferSource(); amb.buffer = noiseBuf; amb.loop = true;
    const af = ctx.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 320;
    const ag = ctx.createGain(); ag.gain.value = 0.035;
    amb.connect(af); af.connect(ag); ag.connect(master);
    amb.start();
  } catch { return false; }
  return true;
}

function burst(t0, dur, filterFreq, gain, type = 'lowpass') {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

function thump(t0, freq, dur, gain) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function shot(cls, gain = 1, muffle = 1) {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime;
  if (cls === 'pistol') { burst(t, 0.09, 3200 * muffle, 0.5 * gain); thump(t, 180, 0.09, 0.35 * gain); }
  else if (cls === 'smg') { burst(t, 0.07, 4200 * muffle, 0.4 * gain); thump(t, 200, 0.07, 0.3 * gain); }
  else if (cls === 'shotgun') { burst(t, 0.22, 1800 * muffle, 0.7 * gain); thump(t, 120, 0.2, 0.6 * gain); }
  else if (cls === 'marksman') { burst(t, 0.25, 2400 * muffle, 0.8 * gain); thump(t, 110, 0.25, 0.65 * gain); }
  else { burst(t, 0.11, 2800 * muffle, 0.55 * gain); thump(t, 150, 0.11, 0.4 * gain); }
}

function tone(t0, freq, dur, gain, type = 'square') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function click(t0, freq, gain) { tone(t0, freq, 0.03, gain); }

export function createAudio() {
  return {
    update(state) {
      const p = state.player;
      const nz = state.noise;
      let start = seen.noiseIdx;
      if (start > nz.length) start = Math.max(0, nz.length - 3);
      for (let i = start; i < nz.length; i++) {
        const n = nz[i];
        const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z);
        if (n.r >= 30 && n.r <= 50) {
          const own = d < 2;
          const cls = own ? (WEAPONS[p.weapons[p.active]] || {}).cls || 'rifle' : 'rifle';
          shot(cls, own ? 1 : Math.max(0.08, 1 - d / 45), own ? 1 : 0.55);
        } else if (n.r <= 12 && d < 2.5) {
          if (ensure()) tone(ctx.currentTime, 300 + Math.random() * 80, 0.04, 0.12);
        }
      }
      seen.noiseIdx = nz.length;
      if (p.reloadT > 0 && seen.reload === 0) {
        if (ensure()) { const t = ctx.currentTime; click(t, 1400, 0.2); click(t + 0.15, 900, 0.2); }
      }
      seen.reload = p.reloadT > 0 || p.reloadShell > 0 ? 1 : 0;
      if (p.dryT && p.dryT !== seen.dry) {
        seen.dry = p.dryT;
        if (ensure()) click(ctx.currentTime, 2200, 0.25);
      }
      if (state.fxBoom > seen.boom) {
        seen.boom = state.fxBoom;
        if (ensure()) { const t = ctx.currentTime; burst(t, 0.7, 900, 0.9); thump(t, 90, 0.6, 0.8); }
      }
      if (state.fxRing > seen.ring) {
        seen.ring = state.fxRing;
        if (ensure()) click(ctx.currentTime, 3200, 0.3);
      }
      for (let i = 0; i < 8; i++) {
        const g = state.nades[i];
        if (g.bounced && !seen.bounce[i]) { seen.bounce[i] = true; if (ensure()) click(ctx.currentTime, 800, 0.15); }
        else if (!g.active) seen.bounce[i] = false;
      }
      if (p.lastHit && p.lastHit.t !== seen.hitT) {
        seen.hitT = p.lastHit.t;
        if (ensure() && p.lastHit.head) tone(ctx.currentTime, 1900, 0.12, 0.25, 'sine');
      }
      if (state.phase === 'planted' && state.fuse && state.fuse.planted) {
        const iv = 0.25 + state.roundT / 40 * 0.75;
        if (state.time >= seen.beepT) { seen.beepT = state.time + iv; if (ensure()) tone(ctx.currentTime, 1200, 0.05, 0.2, 'sine'); }
      } else seen.beepT = 0;
      if (state.round !== seen.round || state.phase !== seen.phase) {
        if (ensure()) {
          const t = ctx.currentTime;
          if (state.phase === 'buy') { tone(t, 660, 0.09, 0.2, 'sine'); tone(t + 0.12, 880, 0.12, 0.2, 'sine'); }
          else if (state.phase === 'post') { tone(t, 440, 0.12, 0.2, 'sine'); tone(t + 0.14, 330, 0.18, 0.2, 'sine'); }
          else if (state.phase === 'planted' && !seen.planted) { tone(t, 990, 0.1, 0.25, 'sine'); tone(t + 0.12, 1320, 0.14, 0.25, 'sine'); }
        }
        seen.round = state.round; seen.phase = state.phase;
      }
      seen.planted = !!(state.fuse && state.fuse.planted);
    },
    setVolume(v) { if (master) master.gain.value = v; },
  };
}
