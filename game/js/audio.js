// SALTLINE audio.js — every sound is synthesized with WebAudio (no files): layered gunshots per weapon class,
// footsteps, reloads, grenades, Fuse beeps and stingers. World sounds come from the noise ring buffer and are
// panned and attenuated by their position relative to the camera, with a generated-impulse reverb send.
import { WEAPONS } from './config.js';

let ctx = null, out = null, verb = null, noise = null;
function boot() {
	if (ctx) return ctx.state === 'running';
	try {
		ctx = new AudioContext();
		out = ctx.createGain(); out.gain.value = .6; out.connect(ctx.destination);
		noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		const ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
		for (let c = 0; c < 2; c++) { const b = ir.getChannelData(c); for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2) * (i < 900 ? i / 900 : 1); }
		verb = ctx.createConvolver(); verb.buffer = ir;
		const vg = ctx.createGain(); vg.gain.value = .35; verb.connect(vg); vg.connect(out);
		const wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
		wind.buffer = noise; wind.loop = true; wf.type = 'lowpass'; wf.frequency.value = 260; wg.gain.value = .05;
		wind.connect(wf); wf.connect(wg); wg.connect(out); wind.start();
	} catch { ctx = null; return false; }
	return ctx.state === 'running';
}
addEventListener('pointerdown', () => { boot(); if (ctx && ctx.state !== 'running') ctx.resume(); });

// One voice: filtered noise or an oscillator with an attack/decay envelope, sent to a panner (+ reverb).
function voice(t, { f = 1000, type = 'bandpass', q = .8, osc = null, f1 = 0, dur = .1, gain = .5, pan = 0, wet = .4, lp = 20000 }) {
	let src;
	if (osc) { src = ctx.createOscillator(); src.type = osc; src.frequency.setValueAtTime(f, t); if (f1) src.frequency.exponentialRampToValueAtTime(f1, t + dur); }
	else { src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .4; }
	const filt = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
	filt.type = osc ? 'allpass' : type; filt.frequency.value = f; filt.Q.value = q; low.type = 'lowpass'; low.frequency.value = lp;
	g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
	p.pan.value = pan;
	src.connect(filt); filt.connect(low); low.connect(g); g.connect(p); p.connect(out);
	if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(verb); }
	src.start(t, osc ? 0 : Math.random() * .5); src.stop(t + dur + .05);
}
const SHOT = {
	pistol: [[2400,.09,.6], [180,.12,.5, 'sine', 60], [5200,.03,.3]],
	smg: [[3000,.07,.5], [210,.08,.4, 'sine', 70], [6000,.025,.3]],
	shotgun: [[1300,.26,.9], [110,.25,.8, 'sine', 40], [3500,.06,.5]],
	rifle: [[1900,.14,.75], [140,.16,.7, 'sine', 45], [5600,.035,.45]],
	marksman: [[1500,.32,.95], [95,.3,.9, 'sine', 35], [4800,.05,.6]],
};
function gunshot(cls, gain, pan, lp, wet) {
	const t = ctx.currentTime;
	for (const [f, dur, g, osc, f1] of SHOT[cls] || SHOT.rifle) voice(t, { f, dur: dur * (1 + (1 - gain) * .8), gain: g * gain, osc, f1, pan, lp, wet });
}
const clsOfNoise = (r) => (r >= 55 ? 'marksman' : r >= 44 ? 'rifle' : r >= 40 ? 'shotgun' : r >= 34 ? 'smg' : 'pistol');

export function createAudio() {
	let seq = 0, reload = 0, dry = 0, hit = -1, boom = 0, beep = 0, phase = '', round = 0, kills = 0, shots = 0;
	const steps = new Float32Array(16);
	return {
		setVolume(v) { if (out) out.gain.value = v; },
		update(state, cam) {
			if (!boot()) { seq = state.noiseSeq; return; }
			const p = state.player, fx = Math.sin(cam.rotation.y), fz = Math.cos(cam.rotation.y);
			const place = (x, z) => { const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1; return [d, ((dx * fz - dz * fx) / d) * .85]; };
			for (; seq < state.noiseSeq; seq++) {
				const n = state.noise[seq % state.noise.length];
				if (state.noiseSeq - seq > state.noise.length) continue;
				const [d, pan] = place(n.x, n.z), own = d < 1.5 && n.team === p.team;
				const g = own ? 1 : Math.min(1,7 / (d + 3)), lp = own ? 20000 : 16000 / (1 + d * .08);
				if (n.kind === 1) { if (!own) gunshot(clsOfNoise(n.r), g * .9, pan, lp, .6); }
				else if (n.kind === 0 && !own && d < n.r * 1.4) voice(ctx.currentTime, { f: 700 + Math.random() * 300, q: 1.2, dur: .06, gain: .25 * g, pan, lp, wet: .1 });
				else if (n.kind === 2) voice(ctx.currentTime, { osc: 'square', f: 880, dur: .08, gain: .08 * g, pan, wet: .2 });
				else if (n.kind === 3 && n.r < 20) voice(ctx.currentTime, { osc: 'triangle', f: 2200, f1: 1500, dur: .07, gain: .12 * g, pan, wet: .3 });
			}
			if (state.shots.fired !== shots) {
				const mine = p.shotsFired > 0 && state.time - p.lastShotT < .02;
				if (mine) gunshot(WEAPONS[p.weapons[p.active]].cls, 1,.05,20000,.45);
				shots = state.shots.fired;
			}
			const t = ctx.currentTime;
			if (p.alive && Math.hypot(p.vel.x, p.vel.z) > 3 && p.onGround) { steps[0] += 1 / 60; if (steps[0] > .36) { steps[0] = 0; voice(t, { f: 500 + Math.random() * 200, q: 1, dur: .07, gain: .12, wet: .05 }); } }
			const rl = p.reloadT > 0 || p.reloadShell > 0;
			if (rl && !reload) { voice(t, { f: 3200, q: 4, dur: .04, gain: .25 }); voice(t + .35, { f: 1800, q: 3, dur: .06, gain: .3 }); voice(t + .75, { f: 2600, q: 5, dur: .05, gain: .3 }); }
			reload = rl;
			if (p.dryT !== dry) { dry = p.dryT; voice(t, { f: 4200, q: 6, dur: .03, gain: .25, wet: 0 }); }
			if (p.lastHit.t !== hit) { hit = p.lastHit.t; voice(t, p.lastHit.head ? { osc: 'sine', f: 2100, f1: 1700, dur: .16, gain: .25, wet: 0 } : { f: 6000, q: 2, dur: .03, gain: .2, wet: 0 }); }
			if (p.kills !== kills) { kills = p.kills; voice(t + .05, { osc: 'triangle', f: 660, f1: 990, dur: .12, gain: .12, wet: 0 }); }
			if (state.fxBoom !== boom) { boom = state.fxBoom; voice(t, { f: 180, type: 'lowpass', dur: 1.4, gain: 1, wet: .8 }); voice(t, { osc: 'sine', f: 70, f1: 30, dur: .9, gain: .9 }); }
			if (state.phase === 'planted' && state.time >= beep) { beep = state.time + .15 + .85 * state.roundT / 40; voice(t, { osc: 'sine', f: 1450, dur: .07, gain: .18, wet: .2 }); }
			if (state.phase !== phase || state.round !== round) {
				const chord = { buy: [523,659,784], live: [392,587], planted: [740,988], post: [440,330,262], matchEnd: [523,392,262,196] }[state.phase] || [];
				chord.forEach((f, i) => voice(t + i * .09, { osc: 'triangle', f, dur: .5, gain: .09, wet: .5 }));
				phase = state.phase; round = state.round;
			}
		},
	};
}
