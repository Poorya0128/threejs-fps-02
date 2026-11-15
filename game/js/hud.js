// SALTLINE hud.js — HUD fields with dirty-checking (PLAN.md §5.1, §12).
// M1: crosshair, health, timer, score, and a deploy hint. Ammo, radar,
// killfeed, buy menu and scoreboard land in M2/M4.
const $ = (id) => document.getElementById(id);

export function createHud() {
  const el = {
    hp: $('hud-hp'), hpBar: $('hud-hpbar'), ammo: $('hud-ammo'),
    timer: $('hud-timer'), score: $('hud-score'), round: $('hud-round'),
    hint: $('hud-hint'), cross: $('hud-cross'),
  };
  const last = {};
  function set(node, key, value) {
    if (!node || last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }
  function setBar(node, key, pct) {
    if (!node || last[key] === pct) return;
    last[key] = pct;
    node.style.width = `${pct}%`;
  }
  return {
    update(state) {
      const p = state.player;
      set(el.hp, 'hp', String(Math.max(0, Math.round(p.hp))));
      setBar(el.hpBar, 'hpbar', Math.max(0, p.hp));
      set(el.ammo, 'ammo', '— / —');
      const t = Math.max(0, Math.ceil(state.roundT));
      set(el.timer, 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      set(el.score, 'score', `${state.score.strand} — ${state.score.bastion}`);
      set(el.round, 'round', `ROUND ${state.round}`);
      set(el.hint, 'hint', state.input.locked ? '' : 'CLICK TO DEPLOY');
    },
    setCrosshairGap(px) {
      if (!el.cross) return;
      const g = Math.round(px);
      if (last.gap === g) return;
      last.gap = g;
      el.cross.style.setProperty('--gap', `${g}px`);
    },
  };
}
