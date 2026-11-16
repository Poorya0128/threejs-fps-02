// SALTLINE hud.js — HUD and menus (PLAN.md §12). Every field is dirty-checked so the DOM is written only when a
// value changes. Crosshair gap comes from computeSpread(), the radar rotates with the view and names the nearest
// callout, the buy menu calls economy.buyItem().
import { ROUND, BUY, GRENADES, WEAPONS } from './config.js';
import { computeSpread, activeWeapon, activeId } from './weapons.js';
import { buyItem, priceOf } from './economy.js';

const $ = (id) => document.getElementById(id);
const PX = 2.6;

export function createHud(map) {
	const E = {};
	for (const id of ['hp', 'hpbar', 'ar', 'arm', 'helm', 'money', 'ammo', 'wname', 'nS', 'nV', 'nG', 'kit', 'timer', 'rnd', 'scS', 'scB', 'pipS', 'pipB',
		'feed', 'cross', 'hit', 'hurt', 'banner', 'bT', 'bS', 'prompt', 'prog', 'progL', 'progB', 'spec', 'buy', 'board', 'scope', 'flash', 'loc', 'radar', 'vig']) E[id] = $(id);
	const last = {};
	const text = (k, v) => { if (last[k] !== v) { last[k] = v; E[k].textContent = v; } };
	const html = (k, v) => { if (last[k] !== v) { last[k] = v; E[k].innerHTML = v; } };
	const show = (k, v) => { if (last['s' + k] !== v) { last['s' + k] = v; E[k].hidden = !v; } return v; };
	const style = (k, prop, v) => { const key = k + prop; if (last[key] !== v) { last[key] = v; E[k].style.setProperty(prop, v); } };
	const width = (k, v) => { if (last['w' + k] !== v) { last['w' + k] = v; (E[k].firstChild || E[k]).style.width = `${v}%`; } };
	const cls = (k, c, on) => { const key = k + c; if (last[key] !== on) { last[key] = on; E[k].classList.toggle(c, on); } };

	// Radar background: map boxes drawn once at PX pixels per metre, tall walls brighter than low cover.
	const bg = document.createElement('canvas'), B = map.bounds;
	bg.width = (B.x1 - B.x0) * PX; bg.height = (B.z1 - B.z0) * PX;
	const g = bg.getContext('2d');
	g.fillStyle = 'rgba(70,74,78,.55)'; g.fillRect(0, 0, bg.width, bg.height);
	for (const b of map.boxes) if (b[4] > 0.4 && b[6] !== 12) { g.fillStyle = b[4] > 2.5 ? 'rgba(236,230,218,.75)' : 'rgba(236,230,218,.35)'; g.fillRect((b[0] - B.x0) * PX, (b[2] - B.z0) * PX, (b[3] - b[0]) * PX, (b[5] - b[2]) * PX); }
	g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(240,160,60,.9)';
	for (const [z, l] of [[map.zones.sitePans, 'A'], [map.zones.siteBoiler, 'B']]) g.fillText(l, (z.cx - B.x0) * PX, (z.cz - B.z0) * PX);
	const rc = E.radar.getContext('2d');
	const dot = (x, z, r, c) => { rc.fillStyle = c; rc.beginPath(); rc.arc((x - B.x0) * PX, (z - B.z0) * PX, r, 0, 7); rc.fill(); };
	function drawRadar(state, v) {
		const R = 88;
		rc.clearRect(0, 0, 176, 176);
		rc.save(); rc.beginPath(); rc.arc(R, R, R - 1, 0, 7); rc.clip();
		rc.translate(R, R); rc.rotate(v.yaw); rc.translate(-(v.pos.x - B.x0) * PX, -(v.pos.z - B.z0) * PX);
		rc.drawImage(bg, 0, 0);
		const f = state.fuse;
		if (f.planted || f.dropped) dot(f.x, f.z, 5 + Math.sin(state.time * 8) * 2, '#f0a03c');
		for (const a of state.agents) {
			if (!a.alive || a === v) continue;
			if (a.team === v.team) dot(a.pos.x, a.pos.z, 4, a.team === 'strand' ? '#f0a03c' : '#3fb0a4');
			else if (state.time - state.spottedT[a.id] < 2.5) dot(a.pos.x, a.pos.z, 4.5, '#ff5a4a');
			if (a.hasFuse && a.team === v.team) { rc.strokeStyle = '#fff'; rc.lineWidth = 1.5; rc.beginPath(); rc.arc((a.pos.x - B.x0) * PX, (a.pos.z - B.z0) * PX, 7, 0, 7); rc.stroke(); }
		}
		rc.restore();
		rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(R, R - 7); rc.lineTo(R + 5, R + 5); rc.lineTo(R, R + 2); rc.lineTo(R - 5, R + 5); rc.fill();
		rc.fillStyle = 'rgba(236,230,218,.12)'; rc.beginPath(); rc.moveTo(R, R); rc.arc(R, R, R, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); rc.fill();
	}
	function nearestNode(state, v) {
		let best = 0, bd = 1e9;
		for (let i = 0; i < state.nodes.length; i++) { const n = state.nodes[i], d = (n[1] - v.pos.x) ** 2 + (n[2] - v.pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
		return best;
	}
	// Buy menu: four columns of cards; number keys or clicks buy; owned and unaffordable states are shown.
	function buyMenu(state) {
		const p = state.player;
		const owned = (id) => (WEAPONS[id] ? p.weapons.includes(id) : id === 'armor' ? p.armor >= 100 : id === 'helm' ? p.helm : id === 'cutters' ? p.hasCutters : p.nades[id] >= GRENADES[id].max);
		let cols = '';
		for (const [title, items] of BUY) {
			cols += `<div class="col"><p class="lbl">${title}</p>`;
			for (const [id, key, note] of items) {
				const off = p.money < priceOf(id) || (id === 'cutters' && p.team !== 'bastion');
				cols += `<div class="it ${owned(id) ? 'own' : off ? 'off' : ''}" data-id="${id}"><kbd>${key}</kbd><b>${WEAPONS[id]?.name ?? GRENADES[id]?.name ?? note.split(' — ')[0]}</b><s>${owned(id) ? 'OWNED' : '$' + priceOf(id)}</s><small>${note}</small></div>`;
			}
			cols += '</div>';
		}
		return `<header><h3>REQUISITION</h3><span class="lbl">${Math.max(0, Math.ceil(state.roundT))} S · B CLOSES · KEYS OR CLICK</span><span class="cr">$${p.money}</span></header><div class="cols">${cols}</div>`;
	}
	let st = null;
	E.buy.addEventListener('mousedown', (e) => { const it = e.target.closest('[data-id]'); if (it && st && st.buyOpen) buyItem(st, st.player, it.dataset.id); });
	function board(state) {
		let rows = '';
		for (const team of ['strand', 'bastion']) {
			rows += `<tr class="t"><td style="color:var(--${team === 'strand' ? 'amber' : 'teal'})">${team.toUpperCase()} · ${state.score[team]}</td><td></td><td></td><td></td><td></td></tr>`;
			for (const a of state.agents) if (a.team === team) rows += `<tr class="${a.alive ? '' : 'dead'} ${a.isBot ? '' : 'me'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.kills ? Math.round(a.headshots / a.kills * 100) : 0}%</td><td>$${a.money}</td></tr>`;
		}
		return `<table><tr><th>BRINEHOLD · ROUND ${state.round}</th><th>K</th><th>D</th><th>HS</th><th>CREDITS</th></tr>${rows}</table>`;
	}
	const pips = (state, team) => { let s = ''; for (const a of state.agents) if (a.team === team) s += `<i class="${a.alive ? '' : 'd'}"></i>`; return s; };
	let feedLen = -1, feedT = -1;
	return {
		update(state, v) {
			st = state;
			const p = state.player, w = activeWeapon(v), am = v.ammo[activeId(v)];
			text('hp', String(Math.ceil(v.hp))); width('hpbar', Math.ceil(v.hp)); cls('hpbar', 'low', v.hp <= 30);
			text('ar', String(Math.round(v.armor))); width('arm', Math.round(v.armor)); text('helm', v.helm ? 'HELM' : '');
			text('money', `$${v.money}`);
			if (v.grenadeMode) html('ammo', `${v.nades[v.nadeSel]} <small>LMB THROW · RMB LOB</small>`);
			else html('ammo', w.cls === 'knife' ? '—' : `${am.mag} <small>/ ${am.reserve}</small>`);
			cls('ammo', 'low', !v.grenadeMode && w.mag > 0 && am.mag <= Math.ceil(w.mag / 5));
			text('wname', v.grenadeMode ? GRENADES[v.nadeSel].name : `${w.name}${v.reloadT > 0 || v.reloadShell > 0 ? ' · RELOADING' : ''}`);
			for (const [k, id] of [['nS', 'shard'], ['nV', 'veil'], ['nG', 'glare']]) { text(k, `${GRENADES[id].name}${v.nades[id] > 1 ? ' ×' + v.nades[id] : ''}`); cls(k, 'on', v.nades[id] > 0); cls(k, 'sel', v.grenadeMode && v.nadeSel === id); }
			text('kit', v.hasFuse ? 'FUSE' : v.hasCutters ? 'CUTTERS' : '');
			const t = Math.max(0, Math.ceil(state.roundT));
			text('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`); cls('timer', 'hot', state.phase === 'planted' || (state.phase === 'live' && t <= 10));
			text('rnd', state.phase === 'buy' ? `ROUND ${state.round} · BUY` : state.phase === 'planted' ? 'FUSE PLANTED' : `ROUND ${state.round}`);
			text('scS', String(state.score.strand)); text('scB', String(state.score.bastion));
			let mask = 0; for (let i = 0; i < state.agents.length; i++) if (state.agents[i].alive) mask |= 1 << i;
			if (mask !== last.mask) { last.mask = mask; html('pipS', pips(state, 'strand')); html('pipB', pips(state, 'bastion')); }
			if (state.killfeed.length !== feedLen || (state.killfeed.length && state.killfeed[state.killfeed.length - 1].t !== feedT)) {
				feedLen = state.killfeed.length; feedT = feedLen ? state.killfeed[feedLen - 1].t : -1;
				html('feed', state.killfeed.map((k) => {
					const m = k.text.match(/^(.+) ▸ (.+) · (.+)$/);
					return m ? `<div class="${m[1] === 'You' || m[2] === 'You' ? 'k' : ''}">${m[1]}<em>${m[3]}</em>${m[2]}${k.head ? '<b class="hs">HEAD</b>' : ''}</div>` : `<div class="r">${k.text}</div>`;
				}).join(''));
			}
			const bn = state.banner, bOn = bn && state.time - bn.t < (bn.text === 'GO' ? 1.2 : 3.5) && !state.buyOpen;
			if (show('banner', !!bOn)) { text('bT', bn.text); text('bS', bn.sub); }
			const busy = v.plantT > 0 || v.defuseT > 0;
			if (show('prog', busy)) {
				text('progL', v.plantT > 0 ? 'PLANTING THE FUSE' : v.hasCutters ? 'CUTTING THE FUSE · CUTTERS' : 'CUTTING THE FUSE');
				width('progB', Math.round(100 * (v.plantT > 0 ? v.plantT / ROUND.plantTime : v.defuseT / (v.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime))));
			}
			const f = state.fuse, nearFuse = f.planted && v.team === 'bastion' && Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 1.6;
			text('prompt', busy || v !== p ? '' : v.hasFuse && state.phase === 'live' && state.zones && inSite(state, v) ? 'HOLD E TO PLANT THE FUSE' : nearFuse ? 'HOLD E TO CUT THE FUSE' : !state.input.locked && !state.autoplay && !state.scenarioDone ? 'CLICK TO AIM' : '');
			text('spec', v !== p ? `SPECTATING ${v.name.toUpperCase()} · SPACE NEXT` : '');
			const node = nearestNode(state, v);
			if (node !== last.node) { last.node = node; text('loc', state.nodes[node][0].replace(/([a-z])([A-Z0-9])/g, '$1 $2').toUpperCase()); }
			drawRadar(state, v);
			const slow = Math.floor(state.time * 5) !== last.slow; last.slow = Math.floor(state.time * 5);
			if (show('buy', state.buyOpen) && (slow || v.money !== last.buyMoney)) { last.buyMoney = v.money; html('buy', buyMenu(state)); }
			if (show('board', state.input.scoreboard || state.phase === 'matchEnd') && slow) html('board', board(state));
			const gap = Math.round(3 + Math.tan(computeSpread(v)) * innerHeight * 0.75);
			style('cross', '--g', `${gap}px`); show('cross', !v.scoped && v.alive && !state.buyOpen);
			show('scope', v.scoped && activeId(v) === 'longbow');
			const hitOn = state.time - v.lastHit.t < 0.12;
			cls('hit', 'on', hitOn); cls('hit', 'hs', v.lastHit.head);
			const hurt = Math.max(0, 1 - (state.time - v.hurtT) / 0.8);
			style('hurt', 'opacity', (hurt * 0.9).toFixed(2)); style('hurt', 'transform', `rotate(${((v.yaw - v.hurtYaw) * 57.3 + 20).toFixed(0)}deg)`);
			style('vig', 'opacity', Math.min(1, hurt * 0.8 + (v.alive && v.hp <= 30 ? 0.55 : 0)).toFixed(2)); cls('vig', 'low', v.alive && v.hp <= 30);
			style('flash', 'opacity', Math.min(1, v.flashT / 1.6).toFixed(2));
		},
	};
}
function inSite(state, v) { const { sitePans: a, siteBoiler: b } = state.zones; return Math.hypot(v.pos.x - a.cx, v.pos.z - a.cz) < a.r || Math.hypot(v.pos.x - b.cx, v.pos.z - b.cz) < b.r; }
