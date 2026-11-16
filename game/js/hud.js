// SALTLINE hud.js — HUD fields with dirty-checking (§5.1, §12).
// M3: money, alive pips, banners, plant/defuse progress, scoreboard,
// spectate label. update(state, view) renders the viewed agent (player
// or spectated teammate); money is always the player's.
const $ = (id) => document.getElementById(id);
import { ROUND } from './config.js';
import { computeSpread, activeWeapon, activeId } from './weapons.js';

export function createHud() {
  const el = {
    hp: $('hud-hp'), hpBar: $('hud-hpbar'), armor: $('hud-armor'),
    ammo: $('hud-ammo'), weapon: $('hud-weapon'), timer: $('hud-timer'),
    score: $('hud-score'), round: $('hud-round'), hint: $('hud-hint'),
    cross: $('hud-cross'), hitmark: $('hud-hitmark'), killfeed: $('hud-killfeed'),
    scope: $('hud-scope'), money: $('hud-money'), pips: $('hud-pips'),
    banner: $('hud-banner'), progress: $('hud-progress'), progBar: $('hud-progbar'),
    progLabel: $('hud-proglabel'), board: $('hud-scoreboard'), spec: $('hud-spectate'),
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
  let lastKillCount = 0, hitT = -1, lastBoard = '';
  return {
    update(state, view) {
      const p = state.player, v = view || p;
      const w = activeWeapon(v), am = v.ammo[activeId(v)];
      set(el.hp, 'hp', String(Math.max(0, Math.round(v.hp))));
      setBar(el.hpBar, 'hpbar', Math.max(0, v.hp));
      set(el.armor, 'armor', v.armor > 0 ? `ARMOR ${Math.round(v.armor)}${v.helm ? ' + HELM' : ''}` : '');
      set(el.ammo, 'ammo', w.cls === 'knife' ? '—' : `${am.mag} / ${am.reserve}`);
      set(el.weapon, 'weapon', w.name);
      set(el.money, 'money', `$${p.money}`);
      const t = Math.max(0, Math.ceil(state.roundT));
      set(el.timer, 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      const tColor = state.phase === 'planted' ? '#f0a03c' : '';
      if (el.timer && last.tColor !== tColor) { last.tColor = tColor; el.timer.style.color = tColor; }
      set(el.score, 'score', `${state.score.strand} — ${state.score.bastion}`);
      set(el.round, 'round', `ROUND ${state.round}`);
      let aS = 0, aB = 0;
      for (let i = 0; i < state.agents.length; i++) {
        const a = state.agents[i];
        if (a.alive) { if (a.team === 'strand') aS++; else aB++; }
      }
      set(el.pips, 'pips', `●`.repeat(aS) + `○`.repeat(5 - aS) + '  ' + `●`.repeat(aB) + `○`.repeat(5 - aB));
      set(el.hint, 'hint', state.input.locked || state.autoplay ? '' : 'CLICK TO DEPLOY');
      set(el.spec, 'spec', v !== p ? `SPECTATING ${v.name} — SPACE FOR NEXT` : '');
      // Banner: big centre text for 4 s after it is set (§12).
      if (el.banner) {
        const show = state.banner && state.time - state.banner.t < 4;
        if (last.bannerShow !== show) { last.bannerShow = show; el.banner.style.display = show ? '' : 'none'; }
        if (show) set(el.banner, 'banner', state.banner.text);
      }
      // Plant / defuse progress bar (§12).
      if (el.progress) {
        const planting = p.plantT > 0, defusing = p.defuseT > 0;
        const show = planting || defusing;
        if (last.progShow !== show) { last.progShow = show; el.progress.style.display = show ? '' : 'none'; }
        if (show) {
          const pct = planting ? p.plantT / ROUND.plantTime : p.defuseT / (p.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime);
          setBar(el.progBar, 'progbar', Math.round(pct * 100));
          set(el.progLabel, 'proglabel', planting ? 'PLANTING THE FUSE — HOLD E' : 'DEFUSING — HOLD E');
        }
      }
      // Scoreboard (Tab): kills, deaths, money, alive state per player.
      if (el.board) {
        const show = state.input.scoreboard;
        if (last.boardShow !== show) { last.boardShow = show; el.board.style.display = show ? '' : 'none'; }
        if (show) {
          let rows = '';
          for (let i = 0; i < state.agents.length; i++) {
            const a = state.agents[i];
            rows += `<div class="${a.alive ? '' : 'dead'}"><span>${a.name}</span><span>${a.kills} / ${a.deaths}</span><span>$${a.money}</span><span>${a.alive ? 'ALIVE' : 'DEAD'}</span></div>`;
          }
          const html = `<h3>SALTLINE — BRINEHOLD</h3>${rows}`;
          if (html !== lastBoard) { lastBoard = html; el.board.innerHTML = html; }
        }
      }
      // Crosshair gap from live spread; hidden while scoped.
      const spread = computeSpread(v);
      const gap = Math.round(4 + Math.tan(spread) * 360);
      if (el.cross) {
        const show = !v.scoped && v.alive;
        if (last.crossShow !== show) { last.crossShow = show; el.cross.style.display = show ? '' : 'none'; }
        if (show && last.gap !== gap) {
          last.gap = gap;
          el.cross.style.setProperty('--gap', `${gap}px`);
        }
      }
      if (el.scope) {
        const show = v.scoped;
        // The CSS default is display:none, so showing it needs an
        // explicit 'block' — '' would fall back to hidden.
        if (last.scopeShow !== show) { last.scopeShow = show; el.scope.style.display = show ? 'block' : 'none'; }
      }
      // Hit marker: white body, red head; fades after 0.25 s.
      if (el.hitmark) {
        if (v.lastHit && v.lastHit.t !== hitT) {
          hitT = v.lastHit.t;
          el.hitmark.style.display = '';
          el.hitmark.style.borderColor = v.lastHit.head ? '#ff4444' : '#e8e2d6';
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
  };
}
