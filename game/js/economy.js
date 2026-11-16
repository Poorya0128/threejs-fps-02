// Round money with a loss streak; buyItem for the menu, bots and scenarios.
import { ECON, WEAPONS, GRENADES, GEAR } from './config.js';
import { giveWeapon } from './weapons.js';

export const priceOf = (id) => GEAR[id]?.[1] ?? GRENADES[id]?.price ?? WEAPONS[id].price;
export const nameOf = (id) => GEAR[id]?.[0] ?? GRENADES[id]?.name ?? WEAPONS[id].name;

export function awardRoundMoney(state, winner, reason) {
	const loser = winner === 'strand' ? 'bastion' : 'strand', streak = state.lossStreak[loser];
	const win = reason === 'detonation' || reason === 'defuse' ? ECON.winObjective : ECON.winElim, loss = Math.min(ECON.lossMax, ECON.loss + ECON.lossBonus * streak);
	for (const a of state.agents) {
		const planted = a.team === 'strand' && winner === 'bastion' && state.fuse.site ? ECON.plantLossBonus : 0;
		a.money = Math.min(ECON.cap, a.money + (a.team === winner ? win : loss) + planted);
	}
	state.lossStreak[winner] = 0; state.lossStreak[loser] = streak + 1;
}

export const owns = (a, id) => (WEAPONS[id] ? a.weapons.includes(id) : id === 'armor' ? a.armor >= 100 : id === 'helm' ? a.helm && a.armor >= 100
	: a.nades[id] >= GRENADES[id].max);

export function buyItem(state, a, id) {
	const cost = priceOf(id);
	if (a.money < cost || !a.alive || owns(a, id)) return false;
	if (id === 'armor' || id === 'helm') { a.armor = 100; a.helm ||= id === 'helm'; }
	else if (GRENADES[id]) a.nades[id]++;
	else { a.active = giveWeapon(a, id); a.grenadeMode = false; }
	a.money -= cost;
	return true;
}
