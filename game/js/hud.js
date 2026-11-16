// SALTLINE hud.js — HUD fields with dirty-checking (PLAN.md §5.1, §12).
// M2: ammo, weapon name, armor, killfeed, hit marker, scope overlay,
// crosshair gap derived from computeSpread (proof of the movement penalty).
const $ = (id) => document.getElementById(id);
import { computeSpread, activeWeapon, activeId } from './weapons.js';

export function createHud() {
  const el = {
    hp: $('hud-hp'), hpBar: $('hud-hpbar'), armor: $('hud-armor'),
    ammo: $('hud-ammo'), weapon: $('hud-weapon'), timer: $('hud-timer'),
    score: $('hud-score'), round: $('hud-round'), hint: $('hud-hint'),
    cross: $('hud-cross'), hitmark: $('hud-hitmark'), killfeed: $('hud-killfeed'),
    scope: $('hud-scope'),
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
  let lastKillCount = 0, hitT = -1;
  return {
    update(state) {
      const p = state.player;
      const w = activeWeapon(p), am = p.ammo[activeId(p)];
      set(el.hp, 'hp', String(Math.max(0, Math.round(p.hp))));
      setBar(el.hpBar, 'hpbar', Math.max(0, p.hp));
      set(el.armor, 'armor', p.armor > 0 ? `ARMOR ${Math.round(p.armor)}${p.helm ? ' + HELM' : ''}` : '');
      set(el.ammo, 'ammo', w.cls === 'knife' ? '—' : `${am.mag} / ${am.reserve}`);
      set(el.weapon, 'weapon', w.name);
      const t = Math.max(0, Math.ceil(state.roundT));
      set(el.timer, 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      set(el.score, 'score', `${state.score.strand} — ${state.score.bastion}`);
      set(el.round, 'round', `ROUND ${state.round}`);
      set(el.hint, 'hint', state.input.locked ? '' : 'CLICK TO DEPLOY');
      // Crosshair gap from live spread; hidden while scoped (scope overlay instead).
      const spread = computeSpread(p);
      const gap = Math.round(4 + Math.tan(spread) * 360);
      if (el.cross) {
        const show = !p.scoped;
        if (last.crossShow !== show) { last.crossShow = show; el.cross.style.display = show ? '' : 'none'; }
        if (show) this.setCrosshairGap(gap);
      }
      if (el.scope) {
        const show = p.scoped;
        // The CSS default for #hud-scope is display:none, so showing it
        // needs an explicit 'block' — '' would fall back to the hidden default.
        if (last.scopeShow !== show) { last.scopeShow = show; el.scope.style.display = show ? 'block' : 'none'; }
      }
      // Hit marker: white body, red head; fades after 0.25 s.
      if (el.hitmark) {
        if (p.lastHit && p.lastHit.t !== hitT) {
          hitT = p.lastHit.t;
          el.hitmark.style.display = '';
          el.hitmark.style.borderColor = p.lastHit.head ? '#ff4444' : '#e8e2d6';
          el.hitmark.dataset.t = String(performance.now());
        } else if (hitT >= 0 && performance.now() - Number(el.hitmark.dataset.t || 0) > 250) {
          el.hitmark.style.display = 'none';
        }
      }
      // Killfeed: one line per kill, headshot marked.
      if (el.killfeed && state.killfeed.length !== lastKillCount) {
        lastKillCount = state.killfeed.length;
        el.killfeed.innerHTML = state.killfeed.slice(-4).map((k) =>
          `<div>${k.head ? '◎ ' : ''}${k.text}</div>`).join('');
      }
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
