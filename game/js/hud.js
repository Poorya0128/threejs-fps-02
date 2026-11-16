// SALTLINE hud.js — HUD fields with dirty-checking (§5.1, §12).
const $ = (id) => document.getElementById(id);
import { ROUND, BUY, GRENADES, WEAPONS } from './config.js';
import { computeSpread, activeWeapon, activeId } from './weapons.js';
import { buyItem } from './economy.js';

export function createHud() {
  const el = {
    hp: $('hud-hp'), hpBar: $('hud-hpbar'), armor: $('hud-armor'),
    ammo: $('hud-ammo'), weapon: $('hud-weapon'), timer: $('hud-timer'),
    score: $('hud-score'), round: $('hud-round'), hint: $('hud-hint'),
    cross: $('hud-cross'), hitmark: $('hud-hitmark'), killfeed: $('hud-killfeed'),
    scope: $('hud-scope'), money: $('hud-money'), pips: $('hud-pips'),
    banner: $('hud-banner'), progress: $('hud-progress'), progBar: $('hud-progbar'),
    progLabel: $('hud-proglabel'), board: $('hud-scoreboard'), spec: $('hud-spectate'),
    buy: $('hud-buy'), flash: $('hud-flash'),
  };
  const radar = $('hud-radar'), rctx = radar ? radar.getContext('2d') : null;
  const radarBg = document.createElement('canvas'); radarBg.width = radarBg.height = 140;
  let radarBounds = null, bgReady = false, lastBuyHtml = '';
  let curState = null;
  if (el.buy) el.buy.addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-id]');
    if (!row || !curState || !curState.buyOpen) return;
    buyItem(curState, curState.player, row.dataset.id);
  });
  function drawRadar(state) {
    if (!rctx) return;
    if (!bgReady) {
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      for (const b of state.boxes) {
        minX = Math.min(minX, b.min.x); maxX = Math.max(maxX, b.max.x);
        minZ = Math.min(minZ, b.min.z); maxZ = Math.max(maxZ, b.max.z);
      }
      radarBounds = { minX, maxX, minZ, maxZ };
      const b = radarBg.getContext('2d');
      b.fillStyle = 'rgba(10,12,14,0.72)'; b.fillRect(0, 0, 140, 140);
      b.fillStyle = 'rgba(232,226,214,0.35)';
      for (const box of state.boxes) {
        b.fillRect((box.min.x - minX) / (maxX - minX) * 140, (box.min.z - minZ) / (maxZ - minZ) * 140,
          Math.max(1, (box.max.x - box.min.x) / (maxX - minX) * 140), Math.max(1, (box.max.z - box.min.z) / (maxZ - minZ) * 140));
      }
      bgReady = true;
    }
    const B = radarBounds;
    const px = (x) => (x - B.minX) / (B.maxX - B.minX) * 140;
    const pz = (z) => (z - B.minZ) / (B.maxZ - B.minZ) * 140;
    const dot = (x, y, r, c) => { rctx.fillStyle = c; rctx.beginPath(); rctx.arc(x, y, r, 0, 7); rctx.fill(); };
    rctx.clearRect(0, 0, 140, 140);
    rctx.drawImage(radarBg, 0, 0);
    const z = state.zones;
    rctx.fillStyle = '#e8e2d6'; rctx.font = 'bold 10px sans-serif'; rctx.textAlign = 'center';
    rctx.fillText('P', px(z.sitePans.cx), pz(z.sitePans.cz));
    rctx.fillText('B', px(z.siteBoiler.cx), pz(z.siteBoiler.cz));
    if (state.fuse && state.fuse.planted) dot(px(state.fuse.x), pz(state.fuse.z), 3 + Math.sin(state.time * 6) * 1.5, '#f0a03c');
    for (const a of state.agents) {
      if (!a.alive) continue;
      const x = px(a.pos.x), y = pz(a.pos.z);
      if (a === state.player) {
        rctx.save(); rctx.translate(x, y); rctx.rotate(-a.yaw);
        rctx.fillStyle = '#e8e2d6';
        rctx.beginPath(); rctx.moveTo(0, -6); rctx.lineTo(4, 5); rctx.lineTo(-4, 5); rctx.closePath(); rctx.fill();
        rctx.restore();
        if (a.hasFuse) { rctx.strokeStyle = '#f0a03c'; rctx.beginPath(); rctx.arc(x, y, 7, 0, 7); rctx.stroke(); }
      } else if (a.team === state.player.team) {
        dot(x, y, 3, '#f0a03c');
        if (a.hasFuse) { rctx.strokeStyle = '#f0a03c'; rctx.beginPath(); rctx.arc(x, y, 6, 0, 7); rctx.stroke(); }
      } else if (state.time - state.spottedT[a.id] < 3) {
        dot(x, y, 3, '#ff4444');
      }
    }
  }
  function buyHtml(state) {
    const p = state.player;
    let rows = '';
    for (const [id, label, price, key] of BUY) {
      const owned = WEAPONS[id] ? p.weapons.includes(id)
        : id === 'armor' ? p.armor >= 100 : id === 'helm' ? p.helm : id === 'cutters' ? p.hasCutters
        : p.nades[id] >= GRENADES[id].max;
      const teamOk = id !== 'cutters' || p.team === 'bastion';
      const cls = !teamOk || p.money < price ? 'off' : owned ? 'owned' : '';
      rows += `<div class="buy-row ${cls}" data-id="${id}"><span class="buy-key">${key || '·'}</span><span>${label}</span><span>$${price}</span><span>${owned ? 'OWNED' : ''}</span></div>`;
    }
    return `<h3>BUY — ROUND ${state.round}</h3><div class="buy-money">$${p.money} · B TO CLOSE</div>${rows}`;
  }
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
      curState = state;
      const p = state.player, v = view || p;
      const w = activeWeapon(v), am = v.ammo[activeId(v)];
      set(el.hp, 'hp', String(Math.max(0, Math.round(v.hp))));
      setBar(el.hpBar, 'hpbar', Math.max(0, v.hp));
      set(el.armor, 'armor', v.armor > 0 ? `ARMOR ${Math.round(v.armor)}${v.helm ? ' + HELM' : ''}` : '');
      set(el.ammo, 'ammo', v.grenadeMode ? 'LMB THROW · RMB LOB' : w.cls === 'knife' ? '—' : `${am.mag} / ${am.reserve}`);
      set(el.weapon, 'weapon', v.grenadeMode ? `${GRENADES[v.nadeSel].name} ×${v.nades[v.nadeSel]}` : w.name);
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
      if (el.banner) {
        const show = state.banner && state.time - state.banner.t < 4;
        if (last.bannerShow !== show) { last.bannerShow = show; el.banner.style.display = show ? '' : 'none'; }
        if (show) set(el.banner, 'banner', state.banner.text);
      }
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
      if (el.board) {
        const show = state.input.scoreboard;
        if (last.boardShow !== show) { last.boardShow = show; el.board.style.display = show ? '' : 'none'; }
        if (show) {
          let rows = '';
          for (let i = 0; i < state.agents.length; i++) {
            const a = state.agents[i];
            rows += `<div class="${a.alive ? '' : 'dead'}"><span>${a.name}</span><span>${a.kills} / ${a.deaths} / ${a.headshots}</span><span>$${a.money}</span><span>${a.alive ? 'ALIVE' : 'DEAD'}</span></div>`;
          }
          const html = `<h3>SALTLINE — BRINEHOLD</h3>${rows}`;
          if (html !== lastBoard) { lastBoard = html; el.board.innerHTML = html; }
        }
      }
      drawRadar(state);
      if (el.buy) {
        const show = state.buyOpen;
        if (last.buyShow !== show) { last.buyShow = show; el.buy.style.display = show ? '' : 'none'; }
        if (show) {
          const html = buyHtml(state);
          if (html !== lastBuyHtml) { lastBuyHtml = html; el.buy.innerHTML = html; }
        }
      }
      if (el.flash) {
        const op = Math.round(Math.min(0.95, Math.max(0, p.flashT / 2.5)) * 20) / 20;
        if (last.flashOp !== op) { last.flashOp = op; el.flash.style.opacity = String(op); }
      }
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
        if (last.scopeShow !== show) { last.scopeShow = show; el.scope.style.display = show ? 'block' : 'none'; }
      }
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
      if (el.killfeed && state.killfeed.length !== lastKillCount) {
        lastKillCount = state.killfeed.length;
        el.killfeed.innerHTML = state.killfeed.slice(-4).map((k) =>
          `<div>${k.head ? '◎ ' : ''}${k.text}</div>`).join('');
      }
    },
  };
}
