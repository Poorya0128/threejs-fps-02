// SALTLINE audio.js — every sound is synthesized with WebAudio: layered gunshots per weapon class, footsteps, reloads,
// grenades, Fuse beeps and stingers. World sounds come from the noise ring buffer, panned and muffled by distance from
// the camera, with a generated-impulse reverb send and a low wind bed.
import { WEAPONS } from './config.js';

let ctx = null, out = null, verb = null, noise = null;
const buffer = (ch, len, fill) => { const b = ctx.createBuffer(ch, len, ctx.sampleRate); for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = fill(i, len); } return b; };
const chain = (...nodes) => { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes[0]; };
const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
function boot() {
	if (ctx) return ctx.state === 'running';
	try {
		ctx = new AudioContext(); out = chain(gain(.6), ctx.destination);
		noise = buffer(1, ctx.sampleRate, () => Math.random() * 2 - 1);
		verb = ctx.createConvolver(); verb.buffer = buffer(2, ctx.sampleRate * 1.6, (i, n) => (Math.random() * 2 - 1) * (1 - i / n) ** 3.2 * Math.min(1, i / 900));
		chain(verb, gain(.35), out);
		const wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter();
		wind.buffer = noise; wind.loop = true; wf.type = 'lowpass'; wf.frequency.value = 260;
		chain(wind, wf, gain(.05), out); wind.start();
	} catch { ctx = null; return false; }
	return ctx.state === 'running';
}
addEventListener('pointerdown', () => { boot(); if (ctx && ctx.state !== 'running') ctx.resume(); });

// One voice: filtered noise or an oscillator with a 4 ms attack and an exponential decay, panned, with a reverb send.
function voice(t, { f = 1000, type = 'bandpass', q = .8, osc = null, f1 = 0, dur = .1, gain: g0 = .5, pan = 0, wet = .4, lp = 20000 }) {
	let src;
	if (osc) { src = ctx.createOscillator(); src.type = osc; src.frequency.setValueAtTime(f, t); if (f1) src.frequency.exponentialRampToValueAtTime(f1, t + dur); }
	else { src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .4; }
	const filt = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
	filt.type = osc ? 'allpass' : type; filt.frequency.value = f; filt.Q.value = q; low.type = 'lowpass'; low.frequency.value = lp; p.pan.value = pan;
	g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
	chain(src, filt, low, g, p, out);
	if (wet) chain(g, gain(wet), verb);
	src.start(t, osc ? 0 : Math.random() * .5); src.stop(t + dur + .05);
}
// Gunshot layers per class: [centre Hz, decay s, gain, oscillator, end Hz] — crack, body thump, high snap.
const SHOT = {
	pistol: [[2400, .09, .6], [180, .12, .5, 'sine', 60], [5200, .03, .3]],
	smg: [[3000, .07, .5], [210, .08, .4, 'sine', 70], [6000, .025, .3]],
	shotgun: [[1300, .26, .9], [110, .25, .8, 'sine', 40], [3500, .06, .5]],
	rifle: [[1900, .14, .75], [140, .16, .7, 'sine', 45], [5600, .035, .45]],
	marksman: [[1500, .32, .95], [95, .3, .9, 'sine', 35], [4800, .05, .6]],
};
const gunshot = (cls, g, pan, lp, wet) => { for (const [f, dur, k, osc, f1] of SHOT[cls] || SHOT.rifle) voice(ctx.currentTime, { f, dur: dur * (1 + (1 - g) * .8), gain: k * g, osc, f1, pan, lp, wet }); };
const clsOfNoise = (r) => (r >= 55 ? 'marksman' : r >= 44 ? 'rifle' : r >= 40 ? 'shotgun' : r >= 34 ? 'smg' : 'pistol');
const STING = { buy: [523, 659, 784], live: [392, 587], planted: [740, 988], post: [440, 330, 262], matchEnd: [523, 392, 262, 196] };

export function createAudio() {
	let seq = 0, reload = false, dry = 0, hit = -1, boom = 0, beep = 0, phase = '', round = 0, kills = 0, shots = 0, step = 0;
	return {
		setVolume(v) { if (out) out.gain.value = v; },
		update(state, cam) {
			if (!boot()) { seq = state.noiseSeq; return; }
			const p = state.player, t = ctx.currentTime, fx = Math.sin(cam.rotation.y), fz = Math.cos(cam.rotation.y);
			for (; seq < state.noiseSeq; seq++) { // world sounds since the last frame
				const n = state.noise[seq % state.noise.length];
				if (state.noiseSeq - seq > state.noise.length) continue;
				const dx = n.x - cam.position.x, dz = n.z - cam.position.z, d = Math.hypot(dx, dz) || 1, pan = (dx * fz - dz * fx) / d * .85;
				const own = d < 1.5 && n.team === p.team, g = own ? 1 : Math.min(1, 7 / (d + 3)), lp = own ? 20000 : 16000 / (1 + d * .08);
				if (n.kind === 1) { if (!own) gunshot(clsOfNoise(n.r), g * .9, pan, lp, .6); }
				else if (n.kind === 0 && !own && d < n.r * 1.4) voice(t, { f: 700 + Math.random() * 300, q: 1.2, dur: .06, gain: .25 * g, pan, lp, wet: .1 });
				else if (n.kind === 2) voice(t, { osc: 'square', f: 880, dur: .08, gain: .08 * g, pan, wet: .2 });
				else if (n.kind === 3 && n.r < 20) voice(t, { osc: 'triangle', f: 2200, f1: 1500, dur: .07, gain: .12 * g, pan, wet: .3 });
			}
			if (state.shots.fired !== shots) { shots = state.shots.fired; if (p.shotsFired > 0 && state.time - p.lastShotT < .02) gunshot(WEAPONS[p.weapons[p.active]].cls, 1, .05, 20000, .45); }
			if (p.alive && p.onGround && Math.hypot(p.vel.x, p.vel.z) > 3 && (step += 1 / 60) > .36) { step = 0; voice(t, { f: 500 + Math.random() * 200, q: 1, dur: .07, gain: .12, wet: .05 }); }
			const rl = p.reloadT > 0 || p.reloadShell > 0;
			if (rl && !reload) for (const [dt, f, q, d] of [[0, 3200, 4, .04], [.35, 1800, 3, .06], [.75, 2600, 5, .05]]) voice(t + dt, { f, q, dur: d, gain: .3 });
			reload = rl;
			if (p.dryT !== dry) { dry = p.dryT; voice(t, { f: 4200, q: 6, dur: .03, gain: .25, wet: 0 }); }
			if (p.lastHit.t !== hit) { hit = p.lastHit.t; voice(t, p.lastHit.head ? { osc: 'sine', f: 2100, f1: 1700, dur: .16, gain: .25, wet: 0 } : { f: 6000, q: 2, dur: .03, gain: .2, wet: 0 }); }
			if (p.kills !== kills) { kills = p.kills; voice(t + .05, { osc: 'triangle', f: 660, f1: 990, dur: .12, gain: .12, wet: 0 }); }
			if (state.fxBoom !== boom) { boom = state.fxBoom; voice(t, { f: 180, type: 'lowpass', dur: 1.4, gain: 1, wet: .8 }); voice(t, { osc: 'sine', f: 70, f1: 30, dur: .9, gain: .9 }); }
			if (state.phase === 'planted' && state.time >= beep) { beep = state.time + .15 + .85 * state.roundT / 40; voice(t, { osc: 'sine', f: 1450, dur: .07, gain: .18, wet: .2 }); }
			if (state.phase !== phase || state.round !== round) { // round stingers
				(STING[state.phase] || []).forEach((f, i) => voice(t + i * .09, { osc: 'triangle', f, dur: .5, gain: .09, wet: .5 }));
				phase = state.phase; round = state.round;
			}
		},
	};
}
