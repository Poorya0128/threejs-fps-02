// SALTLINE economy.js — money (PLAN.md §4.4): round awards with a loss streak, kill rewards (in weapons.applyHit),
// and buyItem, which the buy menu, the bots and the scenarios all call.
import { ECON, WEAPONS, GRENADES } from './config.js';
import { giveWeapon } from './weapons.js';

export const GEAR = { armor: 650, helm: 1000, cutters: 400 };
export const priceOf = (id) => GEAR[id] ?? GRENADES[id]?.price ?? WEAPONS[id]?.price ?? -1;

export function awardRoundMoney(state, winner, reason) {
	const win = reason === 'detonation' || reason === 'defuse' ? ECON.winObjective : ECON.winElim;
	const loser = winner === 'strand' ? 'bastion' : 'strand', streak = state.lossStreak[loser];
	const loss = Math.min(ECON.lossMax, ECON.loss + ECON.lossBonus * streak);
	for (const a of state.agents) {
		let gain = a.team === winner ? win : loss;
		if (a.team === 'strand' && winner === 'bastion' && state.fuse.site) gain += ECON.plantLossBonus;
		a.money = Math.min(ECON.cap, a.money + gain);
	}
	state.lossStreak[winner] = 0; state.lossStreak[loser] = streak + 1;
}

// Returns true when bought. Weapons replace the item in their slot; armour, helm, Cutters and grenades stack to caps.
export function buyItem(state, a, id) {
	const cost = priceOf(id);
	if (cost < 0 || a.money < cost || !a.alive) return false;
	if (id === 'armor') { if (a.armor >= 100) return false; a.armor = 100; }
	else if (id === 'helm') { if (a.helm && a.armor >= 100) return false; a.armor = 100; a.helm = true; }
	else if (id === 'cutters') { if (a.hasCutters || a.team !== 'bastion') return false; a.hasCutters = true; }
	else if (GRENADES[id]) { if (a.nades[id] >= GRENADES[id].max) return false; a.nades[id]++; }
	else { if (a.weapons.includes(id)) return false; a.active = giveWeapon(a, id); a.grenadeMode = false; }
	a.money -= cost;
	return true;
}
