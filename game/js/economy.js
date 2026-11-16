// SALTLINE economy.js — money: round awards, kill rewards, buying (§4.4).
import { ECON, WEAPONS } from './config.js';
import { giveWeapon } from './weapons.js';

// Price of any buyable: weapon id, 'armor', 'helm' or 'cutters'.
export function priceOf(id) {
  if (id === 'armor') return 650;
  if (id === 'helm') return 1000;
  if (id === 'cutters') return 400;
  return WEAPONS[id] ? WEAPONS[id].price : -1;
}

// Round-end money. winner: 'strand'|'bastion', reason per §4.3.
export function awardRoundMoney(state, winner, reason) {
  const objective = reason === 'detonation' || reason === 'defuse';
  const win = objective ? ECON.winObjective : ECON.winElim;
  for (const a of state.agents) {
    if (a.team === winner) {
      a.money = Math.min(ECON.cap, a.money + win);
      state.lossStreak[a.team] = 0;
    } else {
      const streak = state.lossStreak[a.team] || 0;
      const loss = Math.min(ECON.lossMax, ECON.loss + ECON.lossBonus * streak);
      a.money = Math.min(ECON.cap, a.money + loss);
      state.lossStreak[a.team] = streak + 1;
    }
    // Planting pays the whole Strand side even if the round is lost (§4.4).
    if (reason === 'detonation' && a.team === 'strand') a.money = Math.min(ECON.cap, a.money + ECON.plantLossBonus);
  }
}

// Buy an item. Returns true on success.
export function buyItem(state, a, id) {
  const cost = priceOf(id);
  if (cost < 0 || a.money < cost) return false;
  if (id === 'armor') { if (a.armor >= 100) return false; a.armor = 100; }
  else if (id === 'helm') { if (a.helm) return false; a.helm = true; }
  else if (id === 'cutters') { if (a.hasCutters) return false; a.hasCutters = true; }
  else {
    if (a.weapons.includes(id)) return false;
    giveWeapon(a, id);
  }
  a.money -= cost;
  return true;
}
