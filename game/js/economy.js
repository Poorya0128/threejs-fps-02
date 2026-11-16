// SALTLINE economy.js — money (PLAN.md §4.4): round awards with a loss streak and buyItem, which the buy menu, the
// bots and the scenarios all call. Kill rewards are paid in weapons.applyHit.
import { ECON, WEAPONS, GRENADES, GEAR } from './config.js';
import { giveWeapon } from './weapons.js';

export const priceOf = (id) => GEAR[id]?.[1] ?? GRENADES[id]?.price ?? WEAPONS[id]?.price ?? -1;
export const nameOf = (id) => GEAR[id]?.[0] ?? GRENADES[id]?.name ?? WEAPONS[id]?.name;

export function awardRoundMoney(state, winner, reason) {
	const loser = winner === 'strand' ? 'bastion' : 'strand', streak = state.lossStreak[loser];
	const win = reason === 'detonation' || reason === 'defuse' ? ECON.winObjective : ECON.winElim, loss = Math.min(ECON.lossMax, ECON.loss + ECON.lossBonus * streak);
	for (const a of state.agents) {
		const bonus = a.team === 'strand' && winner === 'bastion' && state.fuse.site ? ECON.plantLossBonus : 0;
		a.money = Math.min(ECON.cap, a.money + (a.team === winner ? win : loss) + bonus);
	}
	state.lossStreak[winner] = 0; state.lossStreak[loser] = streak + 1;
}

// Is the item already owned (or full)? Weapons replace their slot; armour, helm, Cutters and grenades cap out.
export function owns(a, id) {
	return WEAPONS[id] ? a.weapons.includes(id) : id === 'armor' ? a.armor >= 100 : id === 'helm' ? a.helm && a.armor >= 100
		: id === 'cutters' ? a.hasCutters : a.nades[id] >= GRENADES[id].max;
}
export function buyItem(state, a, id) {
	const cost = priceOf(id);
	if (cost < 0 || a.money < cost || !a.alive || owns(a, id) || (id === 'cutters' && a.team !== 'bastion')) return false;
	if (id === 'armor' || id === 'helm') { a.armor = 100; a.helm ||= id === 'helm'; }
	else if (id === 'cutters') a.hasCutters = true;
	else if (GRENADES[id]) a.nades[id]++;
	else { a.active = giveWeapon(a, id); a.grenadeMode = false; }
	a.money -= cost;
	return true;
}
