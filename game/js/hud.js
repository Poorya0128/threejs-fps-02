// HUD and menus (PLAN.md §12), dirty-checked: the DOM is written only on change.
import { ROUND, BUY, GRENADES } from './config.js';
import { computeSpread, activeWeapon, activeId } from './weapons.js';
import { buyItem, priceOf, nameOf, owns } from './economy.js';
import { siteAt } from './rounds.js';

const PX = 2.6, S = 190, R = S / 2, AMBER = '#f0a03c', TEAL = '#3fb0a4', INK = 'rgba(236,230,218,', NADES = [['nS', 'shard'], ['nV', 'veil']];
const HEAD = '<svg class="hs" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="5"/><path d="M7 0v4M7 10v4M0 7h4M10 7h4"/></svg>';
const IDS = 'hp hpbar ar arm helm cash dCash mags ammo wname nS nV kit timer rnd scS scB pipS pipB feed cross hit banner bT bS prompt prog progL progB buy board scope radar vig';

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

	// Radar: the map drawn once, turned with the view; upright lane names, spotted enemies, the Fuse.
	const B = map.bounds, X = (x) => (x - B.x0) * PX, Z = (z) => (z - B.z0) * PX, bg = document.createElement('canvas'), g = bg.getContext('2d'), rc = E.radar.getContext('2d');
	bg.width = X(B.x1); bg.height = Z(B.z1);
	g.fillStyle = 'rgba(40,44,48,.6)'; g.fillRect(0, 0, bg.width, bg.height); g.strokeStyle = INK + '.9)';
	for (const b of map.boxes) if (b[4] > .4 && b[6] !== 12) {
		const tall = b[4] > 2.5, w = (b[3] - b[0]) * PX, h = (b[5] - b[2]) * PX;
		g.fillStyle = tall ? 'rgba(170,166,158,.8)' : INK + '.28)'; g.fillRect(X(b[0]), Z(b[2]), w, h);
		if (tall) g.strokeRect(X(b[0]) + .5, Z(b[2]) + .5, w - 1, h - 1);
	}
	Object.assign(g, { font: 'bold 22px sans-serif', textAlign: 'center', textBaseline: 'middle', strokeStyle: AMBER, fillStyle: AMBER, lineWidth: 2 }); g.setLineDash([5, 4]);
	for (const [z, l] of [[map.zones.sitePans, 'A'], [map.zones.siteBoiler, 'B']]) { g.beginPath(); g.arc(X(z.cx), Z(z.cz), z.r * PX, 0, 7); g.stroke(); g.fillText(l, X(z.cx), Z(z.cz)); }
	const cone = rc.createRadialGradient(R, R, 0, R, R, R);
	cone.addColorStop(0, INK + '.3)'); cone.addColorStop(1, INK + '0)'); rc.textAlign = 'center';
	const shape = (c, ...p) => { rc.fillStyle = c; rc.beginPath(); for (let i = 0; i < p.length; i += 2) rc.lineTo(p[i], p[i + 1]); rc.fill(); };
	const ring = (x, z, r, fill) => { rc.beginPath(); rc.arc(x, z, r, 0, 7); if (fill) { rc.fillStyle = fill; rc.fill(); } else rc.stroke(); };
	function drawRadar(state, v) {
		rc.clearRect(0, 0, S, S);
		rc.save(); rc.translate(R, R); rc.rotate(v.yaw); rc.translate(-X(v.pos.x), -Z(v.pos.z));
		rc.drawImage(bg, 0, 0);
		rc.font = '600 9px sans-serif'; rc.fillStyle = INK + '.8)'; rc.strokeStyle = '#fff'; rc.lineWidth = 1.5;
		for (const [t, x, z] of map.callouts) { rc.save(); rc.translate(X(x), Z(z)); rc.rotate(-v.yaw); rc.fillText(t, 0, 0); rc.restore(); }
		const f = state.fuse;
		if (f.planted || f.dropped) ring(X(f.x), Z(f.z), 5 + Math.sin(state.time * 8) * 2, AMBER);
		for (const a of state.agents) {
			const x = X(a.pos.x), z = Z(a.pos.z);
			if (!a.alive || a === v) continue;
			if (a.team === v.team) { ring(x, z, 4, a.team === 'strand' ? AMBER : TEAL); if (a.hasFuse) ring(x, z, 7); }
			else if (state.time - state.spottedT[a.id] < 2.5) shape('#ff5a4a', x, z - 6, x + 5, z, x, z + 6, x - 5, z);
		}
		rc.restore();
		rc.fillStyle = cone; rc.beginPath(); rc.moveTo(R, R); rc.arc(R, R, R, -Math.PI / 2 - .6, -Math.PI / 2 + .6); rc.fill();
		shape('#fff', R, R - 8, R + 5.5, R + 6, R, R + 2.5, R - 5.5, R + 6);
		rc.font = 'bold 11px sans-serif'; rc.fillStyle = AMBER; rc.fillText('N', R + Math.sin(v.yaw) * (R - 11), R - Math.cos(v.yaw) * (R - 11) + 4);
	}
	const card = (p, [id, key, note]) => {
		const own = owns(p, id), off = p.money < priceOf(id);
		return `<div class="it ${own ? 'own' : off ? 'off' : ''}" data-id="${id}"><kbd>${key}</kbd><b>${nameOf(id)}</b><s>${own ? 'OWNED' : '$' + priceOf(id)}</s><small>${note}</small></div>`;
	};
	const buyMenu = (state, p = state.player) => `<header><h3>REQUISITION</h3><span class="lbl">${Math.max(0, Math.ceil(state.roundT))} S · B CLOSES · KEYS OR CLICK</span><span class="cr">$${p.money}</span></header>`
		+ `<div class="cols">${BUY.map(([title, items]) => `<div><p class="lbl">${title}</p>${items.map((it) => card(p, it)).join('')}</div>`).join('')}</div>`;
	let st = null;
	E.buy.addEventListener('mousedown', (e) => { const it = e.target.closest('[data-id]'); if (it && st?.buyOpen) buyItem(st, st.player, it.dataset.id); });
	const team = (state, t, row) => state.agents.filter((a) => a.team === t).map(row).join('');
	const board = (state) => `<table><tr><th>BRINEHOLD · ROUND ${state.round}</th><th>K</th><th>D</th><th>HS</th><th>CREDITS</th></tr>${['strand', 'bastion'].map((t) => `<tr class="t"><td colspan="5" class="${t}">${t.toUpperCase()} · ${state.score[t]}</td></tr>`
		+ team(state, t, (a) => `<tr class="${a.alive ? '' : 'dead'} ${a.isBot ? '' : 'me'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.kills ? Math.round(a.headshots / a.kills * 100) : 0}%</td><td>$${a.money}</td></tr>`)).join('')}</table>`;
	const pip = (a) => `<i class="${a.alive ? '' : 'd'}"></i>`;
	const feedRow = (k) => (k.text ? `<div class="r">${k.text}</div>` : `<div class="${k.a === 'You' || k.b === 'You' ? 'k' : ''}">${k.a}<em>${k.w}</em>${k.b}${k.head ? HEAD : ''}</div>`);
	return {
		update(state, v) {
			st = state;
			const w = activeWeapon(v), am = v.ammo[activeId(v)], nade = v.grenadeMode, f = state.fuse, t = Math.max(0, Math.ceil(state.roundT)), phase = state.phase;
			text('hp', Math.ceil(v.hp)); width('hpbar', Math.ceil(v.hp)); cls('hpbar', 'low', v.hp <= 30);
			text('ar', Math.round(v.armor)); width('arm', Math.round(v.armor)); text('helm', v.helm ? 'HELM' : '');
			const d = v.money - (last.cash ?? v.money);
			if (changed('cash', v.money)) {
				E.cash.textContent = `$${v.money}`;
				if (d) { E.dCash.textContent = `${d > 0 ? '+' : '−'}$${Math.abs(d)}`; E.dCash.className = ''; void E.dCash.offsetWidth; E.dCash.className = d > 0 ? 'up' : 'dn'; }
			}
			const mags = nade ? -1 : Math.ceil(am.reserve / w.mag);
			html('ammo', nade ? `${v.nades[v.nadeSel]}<small>LMB THROW · RMB LOB</small>` : `${am.mag}<small>/ ${w.mag}</small>`);
			if (changed('mags', mags)) E.mags.innerHTML = mags < 0 ? '' : `<span>×${mags}</span><b>${'<i></i>'.repeat(Math.min(mags, 8))}</b>`;
			cls('ammo', 'low', !nade && am.mag <= Math.ceil(w.mag / 5));
			text('wname', nade ? GRENADES[v.nadeSel].name : `${w.name}${v.reloadT > 0 ? ' · RELOADING' : ''}`);
			for (const [k, id] of NADES) { text(k, `${GRENADES[id].name}${v.nades[id] > 1 ? ' ×' + v.nades[id] : ''}`); cls(k, 'on', v.nades[id] > 0); cls(k, 'sel', nade && v.nadeSel === id); }
			text('kit', v.hasFuse ? 'FUSE' : '');
			text('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`); cls('timer', 'hot', phase === 'planted' || (phase === 'live' && t <= 10));
			text('rnd', phase === 'planted' ? 'FUSE PLANTED' : `ROUND ${state.round}${phase === 'buy' ? ' · BUY' : ''}`);
			text('scS', state.score.strand); text('scB', state.score.bastion);
			let mask = 0;
			for (let i = 0; i < state.agents.length; i++) mask |= state.agents[i].alive << i;
			if (changed('mask', mask)) { E.pipS.innerHTML = team(state, 'strand', pip); E.pipB.innerHTML = team(state, 'bastion', pip); }
			const kf = state.killfeed;
			if (changed('feed', kf[kf.length - 1]?.t)) E.feed.innerHTML = kf.map(feedRow).join('');
			const bn = state.banner;
			if (show('banner', !!bn && state.time - bn.t < (bn.text === 'GO' ? 1.2 : 3.5) && !state.buyOpen)) { text('bT', bn.text); text('bS', bn.sub); }
			if (show('prog', v.plantT > 0 || v.defuseT > 0)) {
				text('progL', v.plantT > 0 ? 'PLANTING THE FUSE' : 'CUTTING THE FUSE');
				width('progB', Math.round(100 * (v.plantT > 0 ? v.plantT / ROUND.plantTime : v.defuseT / ROUND.defuseTime)));
			}
			const nearFuse = f.planted && v.team === 'bastion' && Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 1.6;
			text('prompt', v.plantT > 0 || v.defuseT > 0 ? '' : v.hasFuse && phase === 'live' && siteAt(state, v.pos.x, v.pos.z) ? 'HOLD E TO PLANT THE FUSE'
				: nearFuse ? 'HOLD E TO CUT THE FUSE' : !state.input.locked && !state.autoplay && !state.scenarioDone ? 'CLICK TO AIM' : '');
			drawRadar(state, v);
			const slow = Math.floor(state.time * 5);
			if (show('buy', state.buyOpen) && (slow !== last.slow || v.money !== last.buyMoney)) { last.buyMoney = v.money; E.buy.innerHTML = buyMenu(state); }
			if (show('board', state.input.scoreboard || phase === 'matchEnd') && slow !== last.slow) E.board.innerHTML = board(state);
			last.slow = slow;
			style('cross', '--g', `${Math.round(3 + Math.tan(computeSpread(v)) * innerHeight * .75)}px`); show('cross', !v.scoped && v.alive && !state.buyOpen);
			show('scope', v.scoped && activeId(v) === 'longbow');
			cls('hit', 'on', state.time - v.lastHit.t < .12); cls('hit', 'hs', v.lastHit.head);
			const hurt = Math.max(0, 1 - (state.time - v.hurtT) / .8), low = v.alive && v.hp <= 30;
			style('vig', 'opacity', Math.min(1, hurt * .8 + (low ? .55 : 0)).toFixed(2)); cls('vig', 'low', low);
		},
	};
}
