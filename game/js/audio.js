// SALTLINE audio.js — WebAudio synth, no files (PLAN.md §12b).
// Buffers are generated once at boot; shots differ per weapon class.
// update(state) polls sim state each frame and plays what changed.
let ctx = null, master = null, noiseBuf = null;
const seen = { shots: 0, reload: 0, dry: 0, hitT: -1 };

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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

// Shot per weapon class: noise crack + low thump + filtered tail.
function shot(cls) {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime;
  if (cls === 'pistol') { burst(t, 0.09, 3200, 0.5); thump(t, 180, 0.09, 0.35); }
  else if (cls === 'smg') { burst(t, 0.07, 4200, 0.4); thump(t, 200, 0.07, 0.3); }
  else if (cls === 'shotgun') { burst(t, 0.22, 1800, 0.7); thump(t, 120, 0.2, 0.6); }
  else if (cls === 'marksman') { burst(t, 0.25, 2400, 0.8); thump(t, 110, 0.25, 0.65); }
  else { burst(t, 0.11, 2800, 0.55); thump(t, 150, 0.11, 0.4); } // rifle
}

function click(t0, freq, gain) {
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + 0.05);
}

export function createAudio() {
  return {
    // Called every frame; plays sounds for sim changes since last frame.
    update(state) {
      const p = state.player;
      if (state.shots.fired > seen.shots) {
        const id = p.weapons[p.active];
        shot({ wren: 'pistol', mako: 'pistol', hornet: 'smg', breaker: 'shotgun', talon: 'rifle', gavel: 'rifle', longbow: 'marksman', cutlass: 'knife' }[id] || 'rifle');
      }
      seen.shots = state.shots.fired;
      if (p.reloadT > 0 && seen.reload === 0) { // reload started
        if (ensure()) { const t = ctx.currentTime; click(t, 1400, 0.2); click(t + 0.15, 900, 0.2); }
      }
      seen.reload = p.reloadT > 0 || p.reloadShell > 0 ? 1 : 0;
      if (p.dryT && p.dryT !== seen.dry) {
        seen.dry = p.dryT;
        if (ensure()) click(ctx.currentTime, 2200, 0.25);
      }
      if (p.lastHit && p.lastHit.t !== seen.hitT) {
        seen.hitT = p.lastHit.t;
        if (ensure() && p.lastHit.head) {
          const t = ctx.currentTime;
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1900;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.14);
        }
      }
    },
  };
}
