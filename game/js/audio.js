// WebAudio synthesis of the noise ring, panned and muffled by distance, with a generated reverb.
import { ROUND } from './config.js';

let ctx = null, out = null, verb = null, noise = null;
const buffer = (ch, len, fill) => { const b = ctx.createBuffer(ch, len, ctx.sampleRate); for (let c = 0; c < ch; c++) b.getChannelData(c).forEach((_, i, d) => { d[i] = fill(i / len); }); return b; };
const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
function boot() {
	try {
		ctx ??= new AudioContext();
		if (!out) {
			out = gain(.6, ctx.destination); verb = ctx.createConvolver(); verb.connect(gain(.35, out));
			noise = buffer(1, ctx.sampleRate, () => Math.random() * 2 - 1);
			verb.buffer = buffer(2, ctx.sampleRate * 1.6, (k) => (Math.random() * 2 - 1) * (1 - k) ** 3.2 * Math.min(1, k * 99));
		}
	} catch { return false; }
	return ctx.state === 'running';
}
addEventListener('pointerdown', () => { if (boot() === false && ctx) ctx.resume(); });

function voice(t, { f = 1000, q = .8, osc = '', f1 = 0, dur = .1, gain: g0 = .5, pan = 0, wet = .4, lp = 20000 }) {
	const src = osc ? ctx.createOscillator() : ctx.createBufferSource(), bp = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
	if (osc) { src.type = osc; src.frequency.setValueAtTime(f, t); if (f1) src.frequency.exponentialRampToValueAtTime(f1, t + dur); }
	else { src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .4; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; }
	low.type = 'lowpass'; low.frequency.value = lp; p.pan.value = pan;
	g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
	src.connect(osc ? low : bp); bp.connect(low); low.connect(g); g.connect(p); p.connect(out);
	if (wet) g.connect(gain(wet, verb));
	src.start(t, osc ? 0 : Math.random() * .5); src.stop(t + dur + .05);
}
const SHOT = [[55, 1500, .32, 95], [44, 1900, .15, 140], [40, 1300, .26, 110], [34, 3000, .07, 210], [0, 2400, .09, 180]];
function gunshot(t, r, g, pan, lp) {
	const [, f, dur, low] = SHOT.find((s) => r >= s[0]), d = dur * (1 + (1 - g) * .8), o = { pan, lp, wet: .6 - g * .15 };
	voice(t, { ...o, f, dur: d, gain: .8 * g }); voice(t, { ...o, osc: 'sine', f: low, f1: low / 3, dur: d * 1.1, gain: .7 * g }); voice(t, { ...o, f: f * 2.6, dur: d / 3, gain: .4 * g });
}

export function createAudio() {
	let seq = 0, reload = false, hit = -1, beep = 0;
	return {
		update(state, cam) {
			if (!boot()) { seq = state.noiseSeq; return; }
			const p = state.player, t = ctx.currentTime, sy = Math.sin(cam.rotation.y), cy = Math.cos(cam.rotation.y);
			for (seq = Math.max(seq, state.noiseSeq - state.noise.length); seq < state.noiseSeq; seq++) {
				const n = state.noise[seq % state.noise.length], dx = n.x - cam.position.x, dz = n.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
				const pan = (dx * cy - dz * sy) / d * .85, g = Math.min(1, 7 / (d + 3)), lp = 16000 / (1 + d * .08);
				if (n.kind === 1) gunshot(t, n.r, d < 1.5 ? 1 : g * .9, pan, d < 1.5 ? 20000 : lp);
				else if (n.kind === 0) { if (d < n.r * 1.4) voice(t, { f: 600 + Math.random() * 400, q: 1.2, dur: .06, gain: .16 * g, pan, lp, wet: .1 }); }
				else if (n.kind === 2) voice(t, { osc: 'square', f: 880, dur: .08, gain: .08 * g, pan, wet: .2 });
				else if (n.r < 20) voice(t, { osc: 'triangle', f: 2200, f1: 1500, dur: .07, gain: .12 * g, pan, wet: .3 }); // grenade bounce
				else { voice(t, { f: 180, q: .5, dur: 1.4, gain: g, pan, wet: .8 }); voice(t, { osc: 'sine', f: 70, f1: 30, dur: .9, gain: .9 * g }); } // Shard blast
			}
			if (p.reloadT > 0 && !reload) for (const [k, f] of [[0, 3200], [.35, 1800], [.75, 2600]]) voice(t + k, { f, q: 4, dur: .05, gain: .3 });
			reload = p.reloadT > 0;
			if (p.lastHit.t !== hit) voice(t, p.lastHit.head ? { osc: 'sine', f: 2100, f1: 1700, dur: .16, gain: .25, wet: 0 } : { f: 6000, q: 2, dur: .03, gain: .2, wet: 0 });
			if (state.phase === 'planted' && state.time >= beep) { beep = state.time + .15 + .85 * state.roundT / ROUND.fuseTime; voice(t, { osc: 'sine', f: 1450, dur: .07, gain: .18, wet: .2 }); }
			hit = p.lastHit.t;
		},
	};
}
