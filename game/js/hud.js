// SALTLINE hud.js — HUD and menus (PLAN.md §12). Every field is dirty-checked so the DOM is written only on change.
// The crosshair gap comes from computeSpread(); the radar turns with the view; the buy menu calls economy.buyItem().
import { ROUND, BUY, GRENADES } from './config.js';
import { computeSpread, activeWeapon, activeId } from './weapons.js';
import { buyItem, priceOf, nameOf, owns } from './economy.js';
import { siteAt } from './rounds.js';
import { nearestNode, callName } from './nav.js';

const PX = 2.6, S = 190, R = S / 2, AMBER = '#f0a03c', TEAL = '#3fb0a4', INK = 'rgba(236,230,218,';
const HEAD = '<svg class="hs" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="5"/><path d="M7 0v4M7 10v4M0 7h4M10 7h4"/></svg>';
const NADES = [['nS', 'shard'], ['nV', 'veil'], ['nG', 'glare']];
const IDS = 'hp hpbar ar arm helm cash dCash mags ammo wname nS nV nG kit timer rnd scS scB pipS pipB feed cross hit hurt banner bT bS prompt prog progL progB spec buy board scope flash loc radar vig';

export function createHud(map) {
	const E = {}, last = {};
	for (const id of IDS.split(' ')) E[id] = document.getElementById(id);
	const changed = (key, v) => { if (last[key] === v) return false; last[key] = v; return true; };
	const text = (k, v) => { if (changed(k, v)) E[k].textContent = v; };
	const html = (k, v) => { if (changed(k, v)) E[k].innerHTML = v; };
	const show = (k, v) => { if (changed('s' + k, v)) E[k].hidden = !v; return v; };
	const style = (k, prop, v) => { if (changed(k + prop, v)) E[k].style.setProperty(prop, v); };
	const width = (k, v) => { if (changed('w' + k, v)) (E[k].firstChild || E[k]).style.width = `${v}%`; };
	const cls = (k, c, on) => { if (changed(k + c, on)) E[k].classList.toggle(c, on); };

	// Radar: the map drawn once north-up (tall walls filled and outlined, low cover dimmer, dashed site rings), turned
	// with the view each frame; lane names stay upright, spotted enemies are red diamonds, the Fuse pulses.
	const B = map.bounds, X = (x) => (x - B.x0) * PX, Z = (z) => (z - B.z0) * PX, bg = document.createElement('canvas'), g = bg.getContext('2d'), rc = E.radar.getContext('2d');
	bg.width = X(B.x1); bg.height = Z(B.z1);
	g.fillStyle = 'rgba(40,44,48,.6)'; g.fillRect(0, 0, bg.width, bg.height); g.strokeStyle = INK + '.9)';
	for (const b of map.boxes) if (b[4] > .4 && b[6] !== 12) {
		const tall = b[4] > 2.5, w = (b[3] - b[0]) * PX, h = (b[5] - b[2]) * PX;
		g.fillStyle = tall ? 'rgba(170,166,158,.8)' : INK + '.28)'; g.fillRect(X(b[0]), Z(b[2]), w, h);
		if (tall) g.strokeRect(X(b[0]) + .5, Z(b[2]) + .5, w - 1, h - 1);
	}
	g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = g.fillStyle = AMBER; g.lineWidth = 2; g.setLineDash([5, 4]);
	for (const [z, l] of [[map.zones.sitePans, 'A'], [map.zones.siteBoiler, 'B']]) { g.beginPath(); g.arc(X(z.cx), Z(z.cz), z.r * PX, 0, 7); g.stroke(); g.fillText(l, X(z.cx), Z(z.cz)); }
	const cone = rc.createRadialGradient(R, R, 0, R, R, R);
	cone.addColorStop(0, INK + '.3)'); cone.addColorStop(1, INK + '0)'); rc.textAlign = 'center';
	const dot = (x, z, r, c) => { rc.fillStyle = c; rc.beginPath(); rc.arc(X(x), Z(z), r, 0, 7); rc.fill(); };
	const poly = (c, ...p) => { rc.fillStyle = c; rc.beginPath(); for (let i = 0; i < p.length; i += 2) rc.lineTo(p[i], p[i + 1]); rc.fill(); };
	function drawRadar(state, v) {
		rc.clearRect(0, 0, S, S);
		rc.save(); rc.translate(R, R); rc.rotate(v.yaw); rc.translate(-X(v.pos.x), -Z(v.pos.z));
		rc.drawImage(bg, 0, 0);
		rc.font = '600 9px sans-serif'; rc.fillStyle = INK + '.8)';
		for (const [t, x, z] of map.callouts) { rc.save(); rc.translate(X(x), Z(z)); rc.rotate(-v.yaw); rc.fillText(t, 0, 0); rc.restore(); }
		const f = state.fuse;
		if (f.planted || f.dropped) dot(f.x, f.z, 5 + Math.sin(state.time * 8) * 2, AMBER);
		for (const a of state.agents) {
			if (!a.alive || a === v) continue;
			const x = X(a.pos.x), z = Z(a.pos.z);
			if (a.team === v.team) { dot(a.pos.x, a.pos.z, 4, a.team === 'strand' ? AMBER : TEAL); if (a.hasFuse) { rc.strokeStyle = '#fff'; rc.lineWidth = 1.5; rc.beginPath(); rc.arc(x, z, 7, 0, 7); rc.stroke(); } }
			else if (state.time - state.spottedT[a.id] < 2.5) poly('#ff5a4a', x, z - 6, x + 5, z, x, z + 6, x - 5, z);
		}
		rc.restore();
		rc.fillStyle = cone; rc.beginPath(); rc.moveTo(R, R); rc.arc(R, R, R, -Math.PI / 2 - .6, -Math.PI / 2 + .6); rc.fill();
		poly('#fff', R, R - 8, R + 5.5, R + 6, R, R + 2.5, R - 5.5, R + 6);
		rc.font = 'bold 11px sans-serif'; rc.fillStyle = AMBER; rc.fillText('N', R + Math.sin(v.yaw) * (R - 11), R - Math.cos(v.yaw) * (R - 11) + 4);
	}
	// Buy menu: four columns of cards; number keys or clicks buy; owned and unaffordable cards are marked.
	function buyMenu(state) {
		const p = state.player;
		const cols = BUY.map(([title, items]) => `<div><p class="lbl">${title}</p>${items.map(([id, key, note]) => {
			const own = owns(p, id), off = p.money < priceOf(id) || (id === 'cutters' && p.team !== 'bastion');
			return `<div class="it ${own ? 'own' : off ? 'off' : ''}" data-id="${id}"><kbd>${key}</kbd><b>${nameOf(id)}</b><s>${own ? 'OWNED' : '$' + priceOf(id)}</s><small>${note}</small></div>`;
		}).join('')}</div>`).join('');
		return `<header><h3>REQUISITION</h3><span class="lbl">${Math.max(0, Math.ceil(state.roundT))} S · B CLOSES · KEYS OR CLICK</span><span class="cr">$${p.money}</span></header><div class="cols">${cols}</div>`;
	}
	let st = null;
	E.buy.addEventListener('mousedown', (e) => { const it = e.target.closest('[data-id]'); if (it && st?.buyOpen) buyItem(st, st.player, it.dataset.id); });
	const board = (state) => `<table><tr><th>BRINEHOLD · ROUND ${state.round}</th><th>K</th><th>D</th><th>HS</th><th>CREDITS</th></tr>${['strand', 'bastion'].map((team) =>
		`<tr class="t"><td colspan="5" class="${team}">${team.toUpperCase()} · ${state.score[team]}</td></tr>${state.agents.filter((a) => a.team === team).map((a) =>
			`<tr class="${a.alive ? '' : 'dead'} ${a.isBot ? '' : 'me'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.kills ? Math.round(a.headshots / a.kills * 100) : 0}%</td><td>$${a.money}</td></tr>`).join('')}`).join('')}</table>`;
	const pips = (state, team) => state.agents.filter((a) => a.team === team).map((a) => `<i class="${a.alive ? '' : 'd'}"></i>`).join('');
	const feedRow = (k) => (k.text ? `<div class="r">${k.text}</div>` : `<div class="${k.a === 'You' || k.b === 'You' ? 'k' : ''}">${k.a}<em>${k.w}</em>${k.b}${k.head ? HEAD : ''}</div>`);
	return {
		update(state, v) {
			st = state;
			const p = state.player, w = activeWeapon(v), am = v.ammo[activeId(v)], nade = v.grenadeMode, f = state.fuse, t = Math.max(0, Math.ceil(state.roundT));
			text('hp', String(Math.ceil(v.hp))); width('hpbar', Math.ceil(v.hp)); cls('hpbar', 'low', v.hp <= 30);
			text('ar', String(Math.round(v.armor))); width('arm', Math.round(v.armor)); text('helm', v.helm ? 'HELM' : '');
			if (last.cash !== v.money) { // the change pops up next to the credits
				const d = v.money - (last.cash ?? v.money), e = E.dCash;
				text('cash', `$${v.money}`); last.cash = v.money;
				if (d) { e.textContent = `${d > 0 ? '+' : '−'}$${Math.abs(d)}`; e.className = ''; void e.offsetWidth; e.className = d > 0 ? 'up' : 'dn'; }
			}
			// Ammo: rounds in the magazine / magazine size, then spare magazines as icons.
			html('ammo', nade ? `${v.nades[v.nadeSel]}<small>LMB THROW · RMB LOB</small>` : w.cls === 'knife' ? '—' : `${am.mag}<small>/ ${w.mag}</small>`);
			const mags = w.cls === 'knife' || nade ? -1 : Math.ceil(am.reserve / w.mag);
			if (changed('mags', mags)) E.mags.innerHTML = mags < 0 ? '' : `<span>×${mags}</span><b>${'<i></i>'.repeat(Math.min(mags, 8))}</b>`;
			cls('ammo', 'low', !nade && w.mag > 0 && am.mag <= Math.ceil(w.mag / 5));
			text('wname', nade ? GRENADES[v.nadeSel].name : `${w.name}${v.reloadT > 0 || v.reloadShell > 0 ? ' · RELOADING' : ''}`);
			for (const [k, id] of NADES) { text(k, `${GRENADES[id].name}${v.nades[id] > 1 ? ' ×' + v.nades[id] : ''}`); cls(k, 'on', v.nades[id] > 0); cls(k, 'sel', nade && v.nadeSel === id); }
			text('kit', v.hasFuse ? 'FUSE' : v.hasCutters ? 'CUTTERS' : '');
			text('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`); cls('timer', 'hot', state.phase === 'planted' || (state.phase === 'live' && t <= 10));
			text('rnd', state.phase === 'planted' ? 'FUSE PLANTED' : `ROUND ${state.round}${state.phase === 'buy' ? ' · BUY' : ''}`);
			text('scS', String(state.score.strand)); text('scB', String(state.score.bastion));
			let mask = 0;
			for (let i = 0; i < state.agents.length; i++) if (state.agents[i].alive) mask |= 1 << i;
			if (mask !== last.mask) { last.mask = mask; html('pipS', pips(state, 'strand')); html('pipB', pips(state, 'bastion')); }
			const kf = state.killfeed, top = kf[kf.length - 1];
			if (kf.length !== last.feedN || top?.t !== last.feedT) { last.feedN = kf.length; last.feedT = top?.t; html('feed', kf.map(feedRow).join('')); }
			const bn = state.banner;
			if (show('banner', !!bn && state.time - bn.t < (bn.text === 'GO' ? 1.2 : 3.5) && !state.buyOpen)) { text('bT', bn.text); text('bS', bn.sub); }
			const busy = v.plantT > 0 || v.defuseT > 0, cut = v.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime;
			if (show('prog', busy)) {
				text('progL', v.plantT > 0 ? 'PLANTING THE FUSE' : `CUTTING THE FUSE${v.hasCutters ? ' · CUTTERS' : ''}`);
				width('progB', Math.round(100 * (v.plantT > 0 ? v.plantT / ROUND.plantTime : v.defuseT / cut)));
			}
			const nearFuse = f.planted && v.team === 'bastion' && Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 1.6;
			text('prompt', busy || v !== p ? '' : v.hasFuse && state.phase === 'live' && siteAt(state, v.pos.x, v.pos.z) ? 'HOLD E TO PLANT THE FUSE'
				: nearFuse ? 'HOLD E TO CUT THE FUSE' : !state.input.locked && !state.autoplay && !state.scenarioDone ? 'CLICK TO AIM' : '');
			text('spec', v !== p ? `SPECTATING ${v.name.toUpperCase()} · SPACE NEXT` : '');
			const node = nearestNode(state.nodes, v.pos.x, v.pos.z);
			if (changed('node', node)) E.loc.textContent = callName(state.nodes[node][0]).toUpperCase();
			drawRadar(state, v);
			const slow = Math.floor(state.time * 5); // lists rebuild five times a second
			if (show('buy', state.buyOpen) && (slow !== last.slow || v.money !== last.buyMoney)) { last.buyMoney = v.money; html('buy', buyMenu(state)); }
			if (show('board', state.input.scoreboard || state.phase === 'matchEnd') && slow !== last.slow) html('board', board(state));
			last.slow = slow;
			style('cross', '--g', `${Math.round(3 + Math.tan(computeSpread(v)) * innerHeight * .75)}px`); show('cross', !v.scoped && v.alive && !state.buyOpen);
			show('scope', v.scoped && activeId(v) === 'longbow');
			cls('hit', 'on', state.time - v.lastHit.t < .12); cls('hit', 'hs', v.lastHit.head);
			const hurt = Math.max(0, 1 - (state.time - v.hurtT) / .8), low = v.alive && v.hp <= 30;
			style('hurt', 'opacity', (hurt * .9).toFixed(2)); style('hurt', 'transform', `rotate(${((v.yaw - v.hurtYaw) * 57.3 + 20).toFixed(0)}deg)`);
			style('vig', 'opacity', Math.min(1, hurt * .8 + (low ? .55 : 0)).toFixed(2)); cls('vig', 'low', low);
			style('flash', 'opacity', Math.min(1, v.flashT / 1.6).toFixed(2));
		},
	};
}
